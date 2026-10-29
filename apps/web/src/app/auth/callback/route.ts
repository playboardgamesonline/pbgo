import { NextResponse, type NextRequest } from "next/server"
import { safeNext } from "@pbgo/accounts"
import { createAuthClient } from "@pbgo/accounts/server"

/**
 * Where the provider sends the visitor back, with a one-time `code` that this exchanges for a session (the cookies are set on the way out), then on to
 * the page they came from (`next`, a path of this site: `safeNext`). Anything that goes wrong sends them to the sign-in page with a sentence.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const next = safeNext(searchParams.get("next"))
  const code = searchParams.get("code")
  const supabase = await createAuthClient()
  if (supabase && code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(new URL(next, origin))
  }
  return NextResponse.redirect(new URL(`/login?error=signin&next=${encodeURIComponent(next)}`, origin))
}
