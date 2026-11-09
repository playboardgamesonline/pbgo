import { NextResponse, type NextRequest } from "next/server"
import {
  LANGUAGE_COOKIE,
  LANGUAGE_COOKIE_OPTIONS,
  STATE_PATTERN,
  STEAM_STATE_COOKIE,
  assertionOf,
  checkAssertion,
  externalSignIn,
  fetchSteamProfile,
  languageOf,
  safeNext,
  sameSecret,
  steamConfirms,
  steamReturnTo,
} from "@pbgo/accounts"
import { createAdminClient, createAuthClient, externalDeps, externalProvidersOn } from "@pbgo/accounts/server"
import { rateLimit } from "@pbgo/core/server/rate-limit"

/**
 * Where Steam sends the visitor back after its login (docs/accounts.md): `?openid.…` fields it signed, the page to go on to (`next`) and the state of `/auth/steam`. Nothing in them is believed until it has been checked, in this order:
 * the state is the one in this browser's cookie; the response is Steam's positive answer, for this callback, for a SteamID64, with a signature that covers what matters and a time that is recent (`checkAssertion`); Steam itself says the signature
 * is its own (`steamConfirms`); only then is the number taken for who the visitor is. Their name and picture are asked of Steam's Web API (`fetchSteamProfile`, which may fail without failing the sign-in), the member who holds the number is
 * found or made (`externalSignIn`), and the one-time token that comes of it is spent for a session on the spot, the same call as the link of the sign-up's e-mail (the cookies are set on the way out). Anything that goes wrong sends the visitor to
 * the sign-in with a sentence and leaves only the step in the log, never what Steam or Supabase said. A visitor who gave up at Steam goes back to the sign-in as they left it. Whatever happens, the state cookie is spent.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const next = safeNext(searchParams.get("next"))

  const finish = (response: NextResponse) => {
    response.cookies.set(STEAM_STATE_COOKIE, "", { httpOnly: true, sameSite: "lax", secure: origin.startsWith("https://"), path: "/auth/steam", maxAge: 0 })
    // The answer holds a session or the secrets of a sign-in: nothing keeps it
    response.headers.set("Cache-Control", "no-store")
    return response
  }
  const failed = (reason: string) => {
    console.warn(`[auth/steam] sign-in failed: ${reason}`)
    return finish(NextResponse.redirect(new URL(`/login?error=signin&next=${encodeURIComponent(next)}`, origin)))
  }

  if (searchParams.get("openid.mode") === "cancel") return finish(NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(next)}`, origin)))

  try {
    await rateLimit(null, request, "externalSignIn")
  } catch {
    return failed("rate limited")
  }

  const state = searchParams.get("state") ?? ""
  if (!STATE_PATTERN.test(state) || !sameSecret(state, request.cookies.get(STEAM_STATE_COOKIE)?.value ?? "")) return failed("state")

  const assertion = assertionOf(searchParams)
  if (!assertion) return failed("no assertion")
  const apiKey = process.env.STEAM_WEB_API_KEY?.trim()
  const admin = createAdminClient()
  if (!apiKey || !admin || !externalProvidersOn().includes("steam")) return failed("not set up")

  const checked = checkAssertion(assertion, { returnTo: steamReturnTo(origin, { next, state }), now: Date.now() })
  if (!checked.ok) return failed(`assertion: ${checked.problem}`)
  if (!(await steamConfirms(assertion))) return failed("steam did not confirm")

  const profile = await fetchSteamProfile(checked.steamId, apiKey)
  // A profile that could not be read stays null: it is not written over what the member already has, and a new member gets the provider's fallback name. The sign-in goes on, and the log says so, since a key that Steam refuses
  // would otherwise give every new member the fallback name without anything saying why
  if (!profile) console.warn("[auth/steam] profile not read: the sign-in goes on without it")
  const result = await externalSignIn({ provider: "steam", subject: checked.steamId, profile }, externalDeps(admin))
  if (!result.ok) return failed(`member: ${result.step}`)

  const supabase = await createAuthClient()
  const session = supabase ? await supabase.auth.verifyOtp({ token_hash: result.tokenHash, type: "email" }) : null
  if (!session || session.error || !session.data.user || !session.data.session) return failed("session")

  const response = finish(NextResponse.redirect(new URL(next, origin)))
  // As for every sign-in, the language the account keeps goes out with the session (`/auth/callback`)
  const language = languageOf(session.data.user)
  if (language) response.cookies.set(LANGUAGE_COOKIE, language, LANGUAGE_COOKIE_OPTIONS)
  return response
}
