"use client"

import { useState, type MouseEvent } from "react"
import Link from "next/link"
import { isGameSlug } from "@pbgo/analytics"
import { trackClient, useSearchReport } from "@pbgo/analytics/client"
import { Button } from "@pbgo/ui/platform/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@pbgo/ui/platform/empty"
import { TableEntries } from "@pbgo/ui/platform/table-entry"
import { JoinableTableEntry } from "@/components/join-table"
import { ListPageHeader } from "@/components/list-page-header"
import { PageSearch } from "@/components/page-search"
import type { PublicTableRow } from "@/lib/public-table-rows"
import { COMING_SOON } from "@/lib/coming-soon"

// The Tables tab (PLT-21): the head of the pages of the tabs (the title, and the search bar of what the page lists) and the public tables under it, the tables that their hosts opened to everyone and that wait for players, the newest first, each as the row
// of a game's list: which game it is, who hosts it, who sits at it, what it asks and is played with, and how long ago it was opened. A press on a row leads to the table's page, and its Join button, or the plus of a free seat, sits the visitor down at it and takes them there (`JoinableTableEntry`). The text of the search narrows the list to the tables
// of the games and the hosts it names, in the browser. A page with no table says so, and leads to the games, where one is opened.

/** A press on a row leads to the table's page, `/game/<slug>/<code>`: the game is the second segment of that address, and the code is never read. The page is about to change, so the count leaves at once. */
function countRowClick(event: MouseEvent<HTMLUListElement>) {
  const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href^="/game/"]') : null
  const game = link?.getAttribute("href")?.split("/")[2]
  if (isGameSlug(game)) trackClient("public_table_clicked", { game, from: "tables_tab" }, { instant: true })
}

export function PublicTables({ rows, signedIn }: { rows: readonly PublicTableRow[]; signedIn: boolean }) {
  const [query, setQuery] = useState("")
  const text = query.trim().toLowerCase()
  const shown = text === "" ? rows : rows.filter((row) => row.gameName.toLowerCase().includes(text) || row.host.toLowerCase().includes(text))
  // A search that stopped for a second: that a text was typed and how many tables it left, never the text
  useSearchReport(text === "" ? null : { list: "tables", with_text: true, filters: 0 }, shown.length)
  return (
    <>
      <ListPageHeader title="Tables">
        <PageSearch label="Search tables" placeholder="Search tables..." query={query} onQueryChange={setQuery} />
      </ListPageHeader>
      <section id="results" aria-label="Tables" className="mx-auto w-full max-w-page scroll-mt-navbar px-gutter pt-10 pb-section">
        {shown.length > 0 ? (
          <TableEntries aria-label="Tables" className="grid w-full md:grid-cols-2 xl:grid-cols-3" onClick={countRowClick}>
            {shown.map((row) => (
              <JoinableTableEntry key={row.id} game={row.game} code={row.code} signedIn={signedIn} {...row.entry} />
            ))}
          </TableEntries>
        ) : (
          <Empty className="border">
            <EmptyHeader>
              <EmptyTitle>{rows.length === 0 ? COMING_SOON.tables.heading : "No table matches"}</EmptyTitle>
              <EmptyDescription>{rows.length === 0 ? COMING_SOON.tables.description : "Try the name of a game or of a host."}</EmptyDescription>
            </EmptyHeader>
            {rows.length === 0 && (
              <EmptyContent>
                <Button asChild variant="outline">
                  <Link href="/games">Pick a game</Link>
                </Button>
              </EmptyContent>
            )}
          </Empty>
        )}
      </section>
    </>
  )
}
