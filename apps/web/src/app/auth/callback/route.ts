import { NextResponse, type NextRequest } from "next/server"
import { LANGUAGE_COOKIE, LANGUAGE_COOKIE_OPTIONS, languageOf, safeNext } from "@pbgo/accounts"
import { createAuthClient } from "@pbgo/accounts/server"

/**
 * Where the provider sends the visitor back, with a one-time `code` that this exchanges for a session (the cookies are set on the way out), then on to
 * the page they came from (`next`, a path of this site: `safeNext`). The language their account keeps goes out with the session, in the cookie the server reads, so that the page
 * they land on, a game's perhaps, is drawn in it on a device that has never seen the account; an account that keeps none yet takes the language in use once the page is there
 * (`LanguageSync`). Anything that goes wrong sends them to the sign-in page with a sentence.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const next = safeNext(searchParams.get("next"))
  const code = searchParams.get("code")
  const supabase = await createAuthClient()
  if (supabase && code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const response = NextResponse.redirect(new URL(next, origin))
      const language = languageOf(data.user)
      if (language) response.cookies.set(LANGUAGE_COOKIE, language, LANGUAGE_COOKIE_OPTIONS)
      return response
    }
  }
  return NextResponse.redirect(new URL(`/login?error=signin&next=${encodeURIComponent(next)}`, origin))
}
