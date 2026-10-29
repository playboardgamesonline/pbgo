import { NextResponse, type NextRequest } from "next/server"
import { DEMO_COOKIE, demoAllowed } from "@pbgo/accounts/demo"
import { updateSession } from "@pbgo/accounts/proxy"

// Runs before the pages of a signed-in visitor: it renews their session (`@pbgo/accounts/proxy`) and sends a visitor who is not signed in to the sign-in,
// which brings them back to the page they asked for. Only the pages of an account and the sign-in itself: the hub's public pages and every game stay
// static, and no request to them touches the accounts. (Each page checks again: `requireAccount`.)
export async function proxy(request: NextRequest) {
  const { response, signedIn } = await updateSession(request)
  const { pathname, search } = request.nextUrl
  const demo = demoAllowed() && request.cookies.get(DEMO_COOKIE)?.value === "1"
  if (!signedIn && !demo && pathname.startsWith("/me")) {
    return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(pathname + search)}`, request.url))
  }
  return response
}

export const config = { matcher: ["/me/:path*", "/login"] }
