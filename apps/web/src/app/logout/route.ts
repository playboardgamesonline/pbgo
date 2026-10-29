import { NextResponse, type NextRequest } from "next/server"
import { DEMO_COOKIE } from "@pbgo/accounts/demo"
import { createAuthClient } from "@pbgo/accounts/server"

/**
 * Signs the visitor out: the session ends at the Auth server and its cookies go, then the browser is sent to the home (303, so it asks for it with a
 * GET). A POST and never a link: a page, an image or a prefetch must not be able to sign anyone out. The demo account of development goes too.
 */
export async function POST(request: NextRequest) {
  const supabase = await createAuthClient()
  await supabase?.auth.signOut()
  const response = NextResponse.redirect(new URL("/", request.nextUrl.origin), 303)
  response.cookies.delete(DEMO_COOKIE)
  return response
}
