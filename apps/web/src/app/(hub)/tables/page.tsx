import type { Metadata } from "next"
import { LiveRefresh } from "@/components/live-refresh"
import { PublicTables } from "@/components/public-tables"
import { SiteFooter } from "@/components/site-footer"
import { publicTableRows } from "@/lib/public-table-rows"

// The tables are read per request: they come and go by the minute. The page stays out of the search engines, as a list of tables that are gone by the time it is found has nothing to say to them
export const dynamic = "force-dynamic"
export const metadata: Metadata = { title: "Tables", alternates: { canonical: "/tables" }, robots: { index: false } }

/**
 * The tables open to everyone (PLT-21): the lobbies whose hosts made them public, of every game, the newest first (`publicTableRows`), which the page asks for again now and then while it is in view (`LiveRefresh`). Searching narrows them by game and by
 * host. A press on a table leads to its page, where the visitor sits down at it; one that asks for a rank or a language says so on its row and refuses whoever does not meet it there.
 */
export default async function TablesPage() {
  const rows = await publicTableRows()
  return (
    <div className="flex min-h-[calc(100svh-var(--consent-h,0px))] flex-col">
      <main className="flex-1">
        <PublicTables rows={rows} />
      </main>
      <LiveRefresh />
      <SiteFooter />
    </div>
  )
}
