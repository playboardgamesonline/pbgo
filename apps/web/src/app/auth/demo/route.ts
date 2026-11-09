import { NextResponse, type NextRequest } from "next/server"
import { safeNext } from "@pbgo/accounts"
import { DEMO_COOKIE, DEMO_HELD, demoAllowed } from "@pbgo/accounts/demo"

/**
 * The demo account of development: `/auth/demo` signs the visitor in as a made-up account (`DEMO_ACCOUNT`) to see the pages of a signed-in visitor on a machine with
 * no provider set up, `/auth/demo?held=1` as the same account ON HOLD, waiting to be deleted (the sign-in page then offers to keep it or to delete it now: PLT-36), and `/auth/demo?off=1` signs them out of it. It exists in
 * development alone: a build answers 404, and the cookie it sets is ignored there anyway (`demoAllowed`). Nothing is stored anywhere.
 */
export function GET(request: NextRequest) {
  if (!demoAllowed()) return new NextResponse(null, { status: 404 })
  const { searchParams, origin } = request.nextUrl
  const response = NextResponse.redirect(new URL(searchParams.has("off") ? "/" : safeNext(searchParams.get("next")), origin))
  if (searchParams.has("off")) response.cookies.delete(DEMO_COOKIE)
  else response.cookies.set(DEMO_COOKIE, searchParams.has("held") ? DEMO_HELD : "1", { path: "/", sameSite: "lax" })
  return response
}
