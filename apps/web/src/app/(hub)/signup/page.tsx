import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { safeNext } from "@pbgo/accounts"
import { supabaseAuthConfig } from "@pbgo/accounts/config"
import { getAccount, signInProviders } from "@pbgo/accounts/server"
import { SignupCard } from "@/components/signup-card"
import { SiteFooter } from "@/components/site-footer"

export const metadata: Metadata = {
  title: "Create an account",
  robots: { index: false, follow: false },
  alternates: { canonical: "/signup" },
}

/**
 * The sign-up page, on the hub's backdrop like the sign-in's: an e-mail address and a password, or the providers it offers (`signInProviders`: Google and Discord when the project has switched them on, Steam when the server is set up for it; Twitch is only linked), which make an account too. `?next=` is the page the visitor asked for (they come back
 * to it, `safeNext`), `?error=confirm` is a link of the confirmation e-mail that did not work (`/auth/confirm` sends the visitor here). A visitor who is signed in already has nothing to do here and goes to where they were
 * going. The page reads the session, so it is rendered per request; the proxy renews that session first (`proxy.ts`). It is `noindex` and out of the sitemap, like the sign-in.
 */
export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams
  const target = safeNext(next)
  const [account, providers] = await Promise.all([getAccount(), signInProviders()])
  if (account) redirect(target)

  return (
    <div className="flex min-h-[calc(100svh-var(--consent-h,0px))] flex-col">
      <main className="flex flex-1 items-center justify-center px-gutter pt-navbar pb-section">
        <SignupCard next={target} enabled={supabaseAuthConfig() !== null} providers={providers} linkFailed={error === "confirm"} />
      </main>
      <SiteFooter />
    </div>
  )
}
