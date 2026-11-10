import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { safeNext } from "@pbgo/accounts"
import { supabaseAuthConfig } from "@pbgo/accounts/config"
import { getSessionState, signInProviders } from "@pbgo/accounts/server"
import { AuthShell } from "@/components/auth-shell"
import { LoginCard } from "@/components/login-card"
import { MfaChallengeCard } from "@/components/mfa-challenge-card"

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
  alternates: { canonical: "/login" },
}

/**
 * The sign-in page: a username and a password, or the providers it offers (Google and Discord when the project has switched them on, Steam when the server is set up for it: `signInProviders`; Twitch is only linked), in the frame of the sign-in and the sign-up (`AuthShell`: no navbar, the logo alone, the brand's lettering behind the card, a quiet foot). `?next=` is the page the visitor asked for (they come back to it, `safeNext`), `?error=`
 * is a sign-in that did not work (`signin`) or an account that its member closed (`closed`, PLT-36). A visitor who is signed in already has nothing to do here and goes to where they were going. One who has signed in with a first factor, whichever way, and whose account asks for a second (multi-factor
 * authentication, PLT-129) is not signed in yet: the card is the one that asks for the code of their authenticator app (`MfaChallengeCard`), and the same page takes them on to `next` once they give it. The page reads the
 * session, so it is rendered per request; the proxy renews that session first (`proxy.ts`).
 */
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams
  const target = safeNext(next)
  const [{ account, secondStep }, providers] = await Promise.all([getSessionState(), signInProviders()])
  if (account) redirect(target)

  return (
    <AuthShell>
      {secondStep ? (
        <MfaChallengeCard next={target} />
      ) : (
        <LoginCard next={target} enabled={supabaseAuthConfig() !== null} providers={providers} problem={error === "closed" ? "closed" : error === "signin" ? "signin" : null} />
      )}
    </AuthShell>
  )
}
