import { NextResponse, type NextRequest } from "next/server"
import { ACCOUNT_SETTINGS_PATH, LANGUAGE_COOKIE, LANGUAGE_COOKIE_OPTIONS, languageOf, providerSignInOf, safeNext } from "@pbgo/accounts"
import { createAuthClient, secondStepPendingAfterSignIn } from "@pbgo/accounts/server"
import { trackAnonymously } from "@pbgo/core/server/analytics"

/**
 * Where the provider sends the visitor back, with a one-time `code` that this exchanges for a session (the cookies are set on the way out), then on to
 * the page they came from (`next`, a path of this site: `safeNext`). The language their account keeps goes out with the session, in the cookie the server reads, so that the page
 * they land on, a game's perhaps, is drawn in it on a device that has never seen the account; an account that keeps none yet takes the language in use once the page is there
 * (`LanguageSync`). A member whose account asks for a second step (PLT-129) is sent to the sign-in instead, which asks for the code and brings them on to `next`: `next` can be a page that anybody sees, and they would be left there as
 * a guest. Anything that goes wrong sends them to the sign-in page with a sentence. A provider's sign-in to an account that the member closed (PLT-36: the Auth server bans it, and sends the visitor back with `error_code=user_banned`)
 * says so, and where the link that reopens it is: only the owner of that provider's account gets this far, so it tells a stranger nothing.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const next = safeNext(searchParams.get("next"))
  const code = searchParams.get("code")
  const supabase = await createAuthClient()
  if (supabase && code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // The provider and whether it made the account, counted without a word of who: the same way back brings a member who links a service or confirms a new address, and that is no sign-in
      const signIn = next === ACCOUNT_SETTINGS_PATH ? null : providerSignInOf(data.user)
      if (signIn) trackAnonymously("signed_in", signIn)
      const second = await secondStepPendingAfterSignIn(supabase, data.session?.access_token)
      const response = NextResponse.redirect(new URL(second ? `/login?next=${encodeURIComponent(next)}` : next, origin))
      const language = languageOf(data.user)
      if (language) response.cookies.set(LANGUAGE_COOKIE, language, LANGUAGE_COOKIE_OPTIONS)
      return response
    }
  }
  const problem = searchParams.get("error_code") === "user_banned" ? "closed" : "signin"
  return NextResponse.redirect(new URL(`/login?error=${problem}&next=${encodeURIComponent(next)}`, origin))
}
