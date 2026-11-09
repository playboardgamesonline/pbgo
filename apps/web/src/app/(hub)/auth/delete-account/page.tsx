import type { Metadata } from "next"
import { deletionLinkOf, maskEmail } from "@pbgo/accounts"
import { DEMO_ACCOUNT, demoAllowed } from "@pbgo/accounts/demo"
import { peekDeletionLink } from "@pbgo/core/server/account-deletion"
import { DeletionConfirm, type LinkState } from "@/components/deletion-confirm"
import { SiteFooter } from "@/components/site-footer"

// The address of this page holds a token that is worth an account for an hour: no search engine, and no Referer for whatever the page loads (the analytics skip it too: `isExcludedPath`)
export const metadata: Metadata = { title: "Delete your account", robots: { index: false, follow: false }, referrer: "no-referrer" }

// It reads the query and the database, and says something different to each link
export const dynamic = "force-dynamic"

/**
 * The page the link of the e-mail opens (PLT-36): it works on any device, signed in or not, since the link's token is the proof. It only looks at the link (`peek_account_deletion` changes nothing, so a mail scanner that opens it
 * spends nothing) and asks for a last confirmation; the button is `POST /api/hub/account/deletion`, intent `confirm`. A link that is not the one awaited, has expired or was used says so and sends the member back to their settings for
 * a new one. In development, `?u=demo&t=demo` is the page the demo account's link would open.
 */
export default async function DeleteAccountPage({ searchParams }: { searchParams: Promise<{ u?: string | string[]; t?: string | string[] }> }) {
  const query = await searchParams
  const demo = demoAllowed() && query.u === "demo"
  const link = demo ? null : deletionLinkOf(query)

  let state: LinkState
  if (demo) state = { status: "good", to: maskEmail(DEMO_ACCOUNT.email ?? "ore@example.com") }
  else if (!link) state = { status: "invalid" }
  else {
    try {
      const email = await peekDeletionLink(link.user, link.token)
      state = email ? { status: "good", to: maskEmail(email) } : { status: "invalid" }
    } catch (error) {
      console.error("Deletion link not checked", error instanceof Error ? error.message : "unknown error")
      state = { status: "unreadable" }
    }
  }

  return (
    <div className="flex min-h-[calc(100svh-var(--consent-h,0px))] flex-col">
      <main className="flex flex-1 items-center justify-center px-gutter pt-navbar pb-section">
        <DeletionConfirm state={state} link={link} demo={demo} />
      </main>
      <SiteFooter />
    </div>
  )
}
