import { NextResponse, type NextRequest } from "next/server"
import { ACCOUNT_SETTINGS_PATH, STEAM_STATE_COOKIE, STEAM_STATE_MAX_AGE, newState, safeNext, steamLoginUrl, steamReturnTo } from "@pbgo/accounts"
import { isDemoAccount } from "@pbgo/accounts/demo"
import { externalProvidersOn, getAccount } from "@pbgo/accounts/server"

/**
 * The start of a sign-in with Steam, or, with `?link=1`, of the link of a Steam account to the member who is signed in (their settings, PLT-133): the visitor is sent to Steam's login, which brings them back to
 * `/auth/steam/callback` (docs/accounts.md). Steam does not speak OAuth, so the hub does this itself. A state is made, put in a cookie that only this browser holds (`httpOnly`, ten minutes) and in the address Steam signs and
 * brings back: the way back is refused unless the two are the same, so a link someone else started cannot sign the visitor in as them, or link their account to someone else's. `next` is the page to go on to (a path of this site:
 * `safeNext`); a link always comes back to the member's account settings, and `link` is inside the address Steam signs too (`steamReturnTo`). A link is for a member who is signed in and not the demo account: anybody else is sent to the sign-in.
 * When the server is not set up for Steam, or anything goes wrong, the visitor goes back to the sign-in with a sentence (a link, to the settings with one).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const link = searchParams.get("link") === "1"
  const next = link ? ACCOUNT_SETTINGS_PATH : safeNext(searchParams.get("next"))
  const to = (path: string) => NextResponse.redirect(new URL(path, origin))

  if (!externalProvidersOn().includes("steam")) return to(link ? `${ACCOUNT_SETTINGS_PATH}?steam=failed` : `/login?error=signin&next=${encodeURIComponent(next)}`)
  if (link) {
    const account = await getAccount()
    if (!account || isDemoAccount(account)) return to(`/login?next=${encodeURIComponent(ACCOUNT_SETTINGS_PATH)}`)
  }

  const state = newState()
  const response = NextResponse.redirect(steamLoginUrl({ returnTo: steamReturnTo(origin, { next, state, link }), realm: origin }))
  // Lax: the way back is a navigation from Steam's site to this one, which carries a Lax cookie. The path keeps it from every other page.
  response.cookies.set(STEAM_STATE_COOKIE, state, { httpOnly: true, sameSite: "lax", secure: origin.startsWith("https://"), path: "/auth/steam", maxAge: STEAM_STATE_MAX_AGE })
  response.headers.set("Cache-Control", "no-store")
  return response
}
