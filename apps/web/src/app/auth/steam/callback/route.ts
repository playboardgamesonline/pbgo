import { NextResponse, type NextRequest } from "next/server"
import {
  ACCOUNT_SETTINGS_PATH,
  LANGUAGE_COOKIE,
  LANGUAGE_COOKIE_OPTIONS,
  STATE_PATTERN,
  STEAM_STATE_COOKIE,
  assertionOf,
  checkAssertion,
  externalLink,
  externalSignIn,
  fetchSteamProfile,
  languageOf,
  safeNext,
  sameSecret,
  steamConfirms,
  steamReturnTo,
} from "@pbgo/accounts"
import { isDemoAccount } from "@pbgo/accounts/demo"
import { createAdminClient, createAuthClient, externalDeps, externalProvidersOn, getAccount, secondStepPendingAfterSignIn } from "@pbgo/accounts/server"
import { trackAnonymously } from "@pbgo/core/server/analytics"
import { rateLimit } from "@pbgo/core/server/rate-limit"

/**
 * Where Steam sends the visitor back after its login (docs/accounts.md): `?openid.…` fields it signed, the page to go on to (`next`) and the state of `/auth/steam`. Nothing in them is believed until it has been checked, in this order:
 * the state is the one in this browser's cookie; the response is Steam's positive answer, for this callback, for a SteamID64, with a signature that covers what matters and a time that is recent (`checkAssertion`); Steam itself says the signature
 * is its own (`steamConfirms`); only then is the number taken for who the visitor is. Their name and picture are asked of Steam's Web API (`fetchSteamProfile`, which may fail without failing the sign-in), the member who holds the number is
 * found or made (`externalSignIn`), and the one-time token that comes of it is spent for a session on the spot, the same call as the link of the sign-up's e-mail (the cookies are set on the way out). Anything that goes wrong sends the visitor to
 * the sign-in with a sentence and leaves only the step in the log, never what Steam or Supabase said. A visitor who gave up at Steam goes back to the sign-in as they left it. Whatever happens, the state cookie is spent.
 *
 * With `link=1` (a field of the address Steam signed: `steamReturnTo`) the visitor is a member who asked to link this Steam account to theirs from their settings (PLT-133): they must still be signed in, and not as the demo account, when
 * Steam brings them back, the number is linked to that member and no one else (`externalLink`: an account that another member holds is refused, and so is a second one for the same member), and the way back is always their account settings,
 * with `?steam=` saying how it went (`linked`, `taken`, `has-another` or `failed`: `linkNoticeOf`). No session is made or changed.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const link = searchParams.get("link") === "1"
  const next = link ? ACCOUNT_SETTINGS_PATH : safeNext(searchParams.get("next"))

  const finish = (response: NextResponse) => {
    response.cookies.set(STEAM_STATE_COOKIE, "", { httpOnly: true, sameSite: "lax", secure: origin.startsWith("https://"), path: "/auth/steam", maxAge: 0 })
    // The answer holds a session or the secrets of a sign-in: nothing keeps it
    response.headers.set("Cache-Control", "no-store")
    return response
  }
  const to = (path: string) => finish(NextResponse.redirect(new URL(path, origin)))
  const failed = (reason: string) => {
    console.warn(`[auth/steam] ${link ? "link" : "sign-in"} failed: ${reason}`)
    return to(link ? `${ACCOUNT_SETTINGS_PATH}?steam=failed` : `/login?error=signin&next=${encodeURIComponent(next)}`)
  }

  if (searchParams.get("openid.mode") === "cancel") return to(link ? ACCOUNT_SETTINGS_PATH : `/login?next=${encodeURIComponent(next)}`)

  try {
    await rateLimit(null, request, "externalSignIn")
  } catch {
    return failed("rate limited")
  }

  const state = searchParams.get("state") ?? ""
  if (!STATE_PATTERN.test(state) || !sameSecret(state, request.cookies.get(STEAM_STATE_COOKIE)?.value ?? "")) return failed("state")

  // A link is the signed-in member's: asked of the Auth server (`getAccount`) before Steam is asked anything, so that a session that ended on the way, or none, costs no call
  let memberId: string | null = null
  if (link) {
    const account = await getAccount()
    if (!account || isDemoAccount(account)) return to(`/login?next=${encodeURIComponent(ACCOUNT_SETTINGS_PATH)}`)
    memberId = account.id
  }

  const assertion = assertionOf(searchParams)
  if (!assertion) return failed("no assertion")
  const apiKey = process.env.STEAM_WEB_API_KEY?.trim()
  const admin = createAdminClient()
  if (!apiKey || !admin || !externalProvidersOn().includes("steam")) return failed("not set up")

  const checked = checkAssertion(assertion, { returnTo: steamReturnTo(origin, { next, state, link }), now: Date.now() })
  if (!checked.ok) return failed(`assertion: ${checked.problem}`)
  if (!(await steamConfirms(assertion))) return failed("steam did not confirm")

  const profile = await fetchSteamProfile(checked.steamId, apiKey)
  // A profile that could not be read stays null: it is not written over what the member already has, and a new member gets the provider's fallback name. The sign-in goes on, and the log says so, since a key that Steam refuses
  // would otherwise give every new member the fallback name without anything saying why
  if (!profile) console.warn(`[auth/steam] profile not read: the ${link ? "link" : "sign-in"} goes on without it`)

  if (memberId !== null) {
    const linked = await externalLink({ provider: "steam", subject: checked.steamId, profile }, memberId, externalDeps(admin))
    if (!linked.ok && linked.reason === "failed") console.warn(`[auth/steam] link failed: ${linked.step}`)
    return to(`${ACCOUNT_SETTINGS_PATH}?steam=${linked.ok ? "linked" : linked.reason}`)
  }

  const result = await externalSignIn({ provider: "steam", subject: checked.steamId, profile }, externalDeps(admin))
  if (!result.ok) return failed(`member: ${result.step}`)

  const supabase = await createAuthClient()
  const session = supabase ? await supabase.auth.verifyOtp({ token_hash: result.tokenHash, type: "email" }) : null
  // The Auth server refuses the token of an account that its member closed (PLT-36: it is banned), and says why. Only the owner of that Steam account gets this far, so the sign-in page can say where the link that reopens it is
  if (session?.error?.code === "user_banned") return to(`/login?error=closed&next=${encodeURIComponent(next)}`)
  if (!session || session.error || !session.data.user || !session.data.session) return failed("session")

  // Counted without a word of who: the provider and whether this sign-in made the account
  trackAnonymously("signed_in", { method: "steam", new_account: result.created })
  // A member whose account asks for a second step (PLT-129) goes to the sign-in, which asks for the code and brings them on to `next`: it can be a page that anybody sees, where they would be left as a guest
  const second = supabase !== null && (await secondStepPendingAfterSignIn(supabase, session.data.session.access_token))
  const response = to(second ? `/login?next=${encodeURIComponent(next)}` : next)
  // As for every sign-in, the language the account keeps goes out with the session (`/auth/callback`)
  const language = languageOf(session.data.user)
  if (language) response.cookies.set(LANGUAGE_COOKIE, language, LANGUAGE_COOKIE_OPTIONS)
  return response
}
