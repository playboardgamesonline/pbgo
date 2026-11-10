import type { Metadata } from "next"
import { deletionDate, maskEmail, reopenLinkOf } from "@pbgo/accounts"
import { DEMO_ACCOUNT, demoAllowed } from "@pbgo/accounts/demo"
import { accountDeletionDate } from "@pbgo/core/lib/retention"
import { peekReopenLink } from "@pbgo/core/server/account-deletion"
import { ReopenCard, type LinkState } from "@/components/reopen-card"
import { SiteFooter } from "@/components/site-footer"

// The address of this page holds a token that reopens, or deletes, an account for as long as the link works: no search engine, and no Referer for whatever the page loads (the analytics skip it too: `isExcludedPath`)
export const metadata: Metadata = { title: "Reopen your account", robots: { index: false, follow: false }, referrer: "no-referrer" }

// It reads the query and the database, and says something different to each link
export const dynamic = "force-dynamic"

/**
 * The page the link of the e-mail opens (PLT-36): it works on any device, signed in or not (a closed account cannot be signed in to), since the link's token is the proof. It only looks at the link (`peek_reopen_link` changes nothing, so a mail
 * scanner that opens it spends nothing) and offers to reopen the account or to delete it now: the buttons are `POST /api/hub/account/deletion`, intents `reopen` and `now`. A link that is not the one of a closed account, or whose days are over,
 * says so. In development, `?u=demo&t=demo` is the page the demo account's link would open.
 */
export default async function ReopenAccountPage({ searchParams }: { searchParams: Promise<{ u?: string | string[]; t?: string | string[] }> }) {
  const query = await searchParams
  const demo = demoAllowed() && query.u === "demo"
  const link = demo ? null : reopenLinkOf(query)

  let state: LinkState
  if (demo) state = { status: "good", to: maskEmail(DEMO_ACCOUNT.email ?? "ore@example.com"), until: deletionDate(accountDeletionDate().toISOString()) }
  else if (!link) state = { status: "invalid" }
  else {
    try {
      const found = await peekReopenLink(link.user, link.token)
      state = found ? { status: "good", to: maskEmail(found.email ?? ""), until: deletionDate(found.reopensUntil.toISOString()) } : { status: "invalid" }
    } catch (error) {
      console.error("Reopen link not checked", error instanceof Error ? error.message : "unknown error")
      state = { status: "unreadable" }
    }
  }

  return (
    <div className="flex min-h-[calc(100svh-var(--consent-h,0px))] flex-col">
      <main className="flex flex-1 items-center justify-center px-gutter pt-navbar pb-section">
        <ReopenCard state={state} link={link} demo={demo} />
      </main>
      <SiteFooter />
    </div>
  )
}
