import { NextResponse, type NextRequest } from "next/server"
import { STEAM_STATE_COOKIE, STEAM_STATE_MAX_AGE, newState, safeNext, steamLoginUrl, steamReturnTo } from "@pbgo/accounts"
import { externalProvidersOn } from "@pbgo/accounts/server"

/**
 * The start of a sign-in with Steam: the visitor is sent to Steam's login, which brings them back to `/auth/steam/callback` (docs/accounts.md). Steam does not speak OAuth, so the hub does this itself. A state is made, put in a
 * cookie that only this browser holds (`httpOnly`, ten minutes) and in the address Steam signs and brings back: the way back is refused unless the two are the same, so a link someone else started cannot sign the visitor in
 * as them. `next` is the page to go on to (a path of this site: `safeNext`). When the server is not set up for Steam, or anything goes wrong, the visitor goes back to the sign-in with a sentence.
 */
export function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const next = safeNext(searchParams.get("next"))
  if (!externalProvidersOn().includes("steam")) return NextResponse.redirect(new URL(`/login?error=signin&next=${encodeURIComponent(next)}`, origin))

  const state = newState()
  const response = NextResponse.redirect(steamLoginUrl({ returnTo: steamReturnTo(origin, { next, state }), realm: origin }))
  // Lax: the way back is a navigation from Steam's site to this one, which carries a Lax cookie. The path keeps it from every other page.
  response.cookies.set(STEAM_STATE_COOKIE, state, { httpOnly: true, sameSite: "lax", secure: origin.startsWith("https://"), path: "/auth/steam", maxAge: STEAM_STATE_MAX_AGE })
  response.headers.set("Cache-Control", "no-store")
  return response
}
