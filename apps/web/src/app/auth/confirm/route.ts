import { NextResponse, type NextRequest } from "next/server"
import { confirmEmailSession, confirmFailedPath, confirmNext, confirmRequestOf } from "@pbgo/accounts"
import { createAuthClient, secondStepPendingAfterSignIn } from "@pbgo/accounts/server"

/**
 * Where the link of the confirmation e-mail leads: `?token_hash=…&type=email`, a token that is single-use and proves the address is the visitor's. This spends it on the server, which confirms the address and signs the visitor in (the cookies of
 * the session are set on the way out), and sends them on to the page they came from (`next`, a path of this site: `confirmNext`). The token never reaches a page: the answer is always a redirect, to the page or, when the link does not work
 * (expired, spent already, altered, not a sign-up's), to the sign-up with a sentence. A member whose account asks for a second step (PLT-129) goes to the sign-in instead, which asks for the code and brings them on to `next`. Nothing here
 * logs the request, which holds the token.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const next = confirmNext(searchParams.get("next"), origin)
  const asked = confirmRequestOf(searchParams)
  const supabase = await createAuthClient()
  const confirmed = asked !== null && supabase !== null ? await confirmEmailSession(supabase, asked) : null
  const second = confirmed !== null && supabase !== null && (await secondStepPendingAfterSignIn(supabase, confirmed.accessToken))
  const response = NextResponse.redirect(new URL(confirmed === null ? confirmFailedPath(next) : second ? `/login?next=${encodeURIComponent(next)}` : next, origin))
  // The link held a secret and the answer holds a session: nothing keeps either
  response.headers.set("Cache-Control", "no-store")
  return response
}
