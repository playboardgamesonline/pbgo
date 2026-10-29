import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { safeNext } from "@pbgo/accounts"
import { supabaseAuthConfig } from "@pbgo/accounts/config"
import { getAccount } from "@pbgo/accounts/server"
import { Tabletop } from "@pbgo/ui/platform/tabletop"
import { LoginCard } from "@/components/login-card"
import { SiteFooter } from "@/components/site-footer"

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
  alternates: { canonical: "/login" },
}

/**
 * The sign-in page: Google or Discord, on the hub's backdrop. `?next=` is the page the visitor asked for (they come back to it, `safeNext`), `?error=`
 * is a sign-in that did not work. A visitor who is signed in already has nothing to do here and goes to where they were going. The page reads the
 * session, so it is rendered per request; the proxy renews that session first (`proxy.ts`).
 */
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams
  const target = safeNext(next)
  if (await getAccount()) redirect(target)

  return (
    <div className="flex min-h-[calc(100svh-var(--consent-h,0px))] flex-col">
      <main className="relative flex flex-1 items-center justify-center bg-linear-to-b from-card to-background px-gutter pt-navbar pb-section">
        <Tabletop />
        <LoginCard next={target} enabled={supabaseAuthConfig() !== null} failed={error === "signin"} className="relative" />
      </main>
      <SiteFooter />
    </div>
  )
}
