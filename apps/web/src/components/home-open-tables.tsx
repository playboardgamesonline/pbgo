import Link from "next/link"
import { Section, SectionAction } from "@pbgo/ui/platform/section"
import { TableEntries, TableEntry, type TableEntryProps } from "@pbgo/ui/platform/table-entry"
import { EmptySection } from "@/components/home-sections"
import { JoinableTableEntry } from "@/components/join-table"

/** A table of the member, as its row draws it: the same row as the tables of a game's page, which leads to the table. */
export type HomeTableRow = {
  id: string
  /** The table the row's Join button sits the member down at, for a table open to everyone that they are not at. */
  join?: { game: string; code: string }
  entry: Omit<TableEntryProps, "selected" | "onSelect" | "controls">
}

/**
 * The tables on the signed-in home (PLT-21): the member's own, the one written last first, since a member can sit at several lobbies and none of them is a table they are taken to (a game in progress is, from every page of the hub: PLT-120).
 * A row says which game it is, who hosts it, who sits at it and how long ago it was opened or how long it has been played, and leads to its page: the lobby of a table that waits, the board of one that is played. The free seats of a lobby
 * invite a friend. The tables open to everyone (PLT-21) follow them, the newest first, each leading to its page, with a Join button (and the plus of its free seats) that sits the member down at it and takes them there; until there are some, a member who sits at no table sees the empty state. A server component, whose open tables are client rows (`JoinableTableEntry`).
 */
export function HomeOpenTables({ rows }: { rows: readonly HomeTableRow[] }) {
  if (rows.length === 0) {
    return (
      <EmptySection
        id="home-open-tables"
        label="Open tables"
        href="/tables"
        action="See all tables"
        heading="No table to join yet"
        description="Your tables and the ones their hosts open to everyone are listed here, yours first."
      />
    )
  }
  return (
    <Section aria-labelledby="home-open-tables" className="items-center gap-6">
      <h2 id="home-open-tables" className="sr-only">
        Open tables
      </h2>
      <TableEntries className="grid w-full md:grid-cols-2 xl:grid-cols-3">
        {rows.map((row) => (row.join ? <JoinableTableEntry key={row.id} game={row.join.game} code={row.join.code} signedIn {...row.entry} /> : <TableEntry key={row.id} {...row.entry} />))}
      </TableEntries>
      <SectionAction asChild>
        <Link href="/tables">See all tables</Link>
      </SectionAction>
    </Section>
  )
}
