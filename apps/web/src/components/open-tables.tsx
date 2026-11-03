"use client"

import { useEffect, useId, useRef, useState, type ReactNode } from "react"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@pbgo/ui/platform/empty"
import { Badge } from "@pbgo/ui/platform/badge"
import { Button } from "@pbgo/ui/platform/button"
import { LobbyDetail, type LobbyDetailProps } from "@pbgo/ui/platform/lobby-panel"
import { TableEntries, TableEntry, type TableEntryProps } from "@pbgo/ui/platform/table-entry"
import { PlusSignIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

// The open tables of a game and the panel that goes with them, in one container: a card with two sides, on the left the tables as rows, on the right the panel, which shows the details of the row that is selected. The visitor's own table is the first row, whatever it
// is (a lobby they opened or joined, or a game they play), and it is the selected one when nothing else is picked, so that the panel shows it; a visitor who sits at no table has no row of their own and the panel is the space to open one (`lobby`). A press on another row picks it
// and a second press, the button of the details, or Escape puts it down, which gives the panel back to the visitor's own table. The row that is selected is highlighted in the colour of the panel and runs into it, so that the two read as one: the list says which, and the panel what.
// Both sides are as tall as the container, which the panel's content sets (the list takes that height and adds nothing to it, `lg:h-0 lg:min-h-full`), and the list scrolls inside, with no scrollbar beside the panel (a fade at its foot says there is more), so that the row that is selected can run into it. On a narrow screen the panel is above the list, so a row that is picked brings it into view. Which rows there are,
// and what they say, is the page's (`GamePlay`). The title, "Tables" with the number of rows in a pill, stands over the container, as the titles of the page's other sections do. The page may give the panel a name to be reached by (`lobbyId`: the button at the top of a game's page that creates a game leads to it); the specimens do not, since a name is one per page.

/** A row of the list and the details that it opens, both worded by the page. `own` is the visitor's own table: the first row, selected while nothing else is. */
export type OpenTableRow = { id: string; own?: boolean; entry: Omit<TableEntryProps, "selected" | "onSelect" | "controls">; detail: Omit<LobbyDetailProps, "onClose"> }

export function OpenTables({
  rows,
  lobby,
  createHref,
  emptyTitle,
  emptyDescription,
  lobbyId,
}: {
  rows: readonly OpenTableRow[]
  /** What the panel shows when no row is picked: it is rendered by the server (the visitor's own table, or the space to open one), and draws no surface of its own (`flat`). */
  lobby: ReactNode
  /** Where a table is opened: the empty state has a button that leads there. */
  createHref: string
  emptyTitle: string
  emptyDescription: string
  /** The `id` of the panel beside it, for a link to reach it: the rows say they control it. */
  lobbyId?: string
}) {
  const headingId = useId()
  const generatedPanelId = useId()
  const panelId = lobbyId ?? generatedPanelId
  const panel = useRef<HTMLDivElement>(null)
  const [pickedId, setPickedId] = useState<string | null>(null)
  const ownId = rows.find((row) => row.own)?.id ?? null
  // The visitor's own table is what the panel shows when nothing is picked, so it is never "picked" itself
  const picked = pickedId === null || pickedId === ownId ? null : (rows.find((row) => row.id === pickedId) ?? null)
  const selectedId = picked?.id ?? ownId

  // Escape puts the picked table down
  useEffect(() => {
    if (!picked) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPickedId(null)
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [picked])

  const pick = (id: string) => {
    const next = id === ownId || pickedId === id ? null : id
    setPickedId(next)
    // Under `lg` the panel is above the list: bring it into view
    if (next !== null && !window.matchMedia("(min-width: 1024px)").matches) panel.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" })
  }

  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className="mb-6 flex items-center gap-3 font-heading text-2xl">
        Tables
        <Badge variant="secondary" className="h-6 px-2.5 text-sm">
          {rows.length}
        </Badge>
      </h2>
      <div className="grid overflow-hidden rounded-4xl bg-card text-card-foreground shadow-surface ring-1 ring-foreground/10 lg:grid-cols-12">
        <div className="flex min-h-0 flex-col lg:col-span-7 lg:h-0 lg:min-h-full">
          <div className="min-h-0 flex-1 overflow-y-auto p-4 lg:[mask-image:linear-gradient(to_bottom,black_calc(100%-2rem),transparent)] lg:[scrollbar-width:none] lg:[&::-webkit-scrollbar]:hidden">
            {rows.length > 0 ? (
              <TableEntries aria-label="Tables">
                {rows.map(({ id, entry }) => (
                  <TableEntry
                    key={id}
                    {...entry}
                    selected={id === selectedId}
                    controls={panelId}
                    onSelect={() => pick(id)}
                    // The row that is selected is the colour of the panel and runs into it, over the room that the list keeps at its right
                    className="data-[selected]:bg-muted/40 data-[selected]:hover:bg-muted/40 lg:data-[selected]:-mr-4 lg:data-[selected]:rounded-r-none"
                  />
                ))}
              </TableEntries>
            ) : (
              <Empty className="h-full p-6">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} aria-hidden="true" />
                  </EmptyMedia>
                  <EmptyTitle>{emptyTitle}</EmptyTitle>
                  <EmptyDescription>{emptyDescription}</EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button variant="outline" asChild>
                    <a href={createHref}>Open a table</a>
                  </Button>
                </EmptyContent>
              </Empty>
            )}
          </div>
        </div>
        <div id={panelId} ref={panel} aria-live="polite" className="order-first min-h-0 scroll-mt-navbar bg-muted/40 lg:order-none lg:col-span-5">
          {picked ? <LobbyDetail key={picked.id} flat {...picked.detail} onClose={() => setPickedId(null)} /> : lobby}
        </div>
      </div>
    </section>
  )
}
