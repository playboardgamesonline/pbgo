import { NextResponse, type NextRequest } from "next/server"
import { DEMO_COOKIE, demoAllowed } from "@pbgo/accounts/demo"
import { hasSessionCookie, updateSession } from "@pbgo/accounts/proxy"

// Runs before the pages of a signed-in visitor: it renews their session (`@pbgo/accounts/proxy`) and sends a visitor who is not signed in to the sign-in,
// which brings them back to the page they asked for. Only the pages of an account, the sign-in and sign-up themselves and the front page: the hub's other public pages and every game stay
// static, and no request to them touches the accounts. (Each page checks again: `requireAccount`.)
// The visitor's language is not synced here: the claims of the token keep the account's metadata as it was when the token was issued, up to an hour ago, so rewriting the cookie
// from them would undo a choice made a minute before; the pages that would need it are not matched; and a device meets an account at its sign-in (`/auth/callback`,
// `signInWithPassword`) and in the browser afterwards (`LanguageSync`). See "The visitor's language" in docs/accounts.md.
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const demo = demoAllowed() && request.cookies.get(DEMO_COOKIE)?.value === "1"
  if (pathname === "/") return frontPage(request, demo)

  const { response, signedIn } = await updateSession(request)
  if (!signedIn && !demo && pathname.startsWith("/me")) {
    return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(pathname + search)}`, request.url))
  }
  return response
}

/**
 * The front page: a member sees their home (`/home`, shown at `/` by a rewrite, so the address does not change), anybody else the public home, which stays the static page. A visitor with no session cookie, the crawlers
 * included, goes straight through without a call to anything. One with a session cookie has it renewed (the rewrite carries the new cookies) and, if it holds, the member home takes the place of the public one.
 */
async function frontPage(request: NextRequest, demo: boolean) {
  if (!demo && !hasSessionCookie(request.cookies.getAll().map((cookie) => cookie.name))) return NextResponse.next()
  const { response, signedIn } = await updateSession(request)
  if (!signedIn && !demo) return response
  const rewrite = NextResponse.rewrite(new URL("/home", request.url), { request })
  for (const cookie of response.cookies.getAll()) rewrite.cookies.set(cookie)
  return rewrite
}

export const config = { matcher: ["/", "/me/:path*", "/login", "/signup"] }
