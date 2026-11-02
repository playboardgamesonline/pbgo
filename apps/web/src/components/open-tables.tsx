"use client"

import { useEffect, useId, useRef, useState, type ReactNode } from "react"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@pbgo/ui/platform/empty"
import { Button } from "@pbgo/ui/platform/button"
import { LobbyDetail, type LobbyDetailProps } from "@pbgo/ui/platform/lobby-panel"
import { TableEntries, TableEntry, type TableEntryProps } from "@pbgo/ui/platform/table-entry"
import { PlusSignIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

// The open tables of a game and the space beside them, as a list and what it opens: on the left a card with the tables as rows, on the right the panel, which shows the details of the row that is picked and, when none is, what the page puts
// there (`lobby`: the lobby the visitor is in, or the space to open one). A press on a row picks it and a second press, the button of the details, or Escape puts it down. Both cards are as tall as the row they stand in, which the page
// sets, and start at the same height; the list scrolls inside its card. On a narrow screen the panel is above the list, so a row that is picked brings it into view. Which rows there are, and what they say, is the page's (`GamePlay`). The
// page may give the panel a name to be reached by (`lobbyId`: the button at the top of a game's page that creates a game leads to it); the specimens do not, since a name is one per page.

/** A row of the list and the details that it opens, both worded by the page. */
export type OpenTableRow = { id: string; entry: Omit<TableEntryProps, "selected" | "onSelect" | "controls">; detail: Omit<LobbyDetailProps, "onClose"> }

export function OpenTables({
  rows,
  summary,
  lobby,
  createHref,
  emptyTitle,
  emptyDescription,
  lobbyId,
}: {
  rows: readonly OpenTableRow[]
  /** What the list says of itself next to its title ("2 waiting"). */
  summary?: string
  /** What the panel shows when no row is picked: it is rendered by the server, and keeps its own look. */
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
  const picked = rows.find((row) => row.id === pickedId) ?? null

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
    setPickedId((current) => (current === id ? null : id))
    // Under `lg` the panel is above the list: bring it into view
    if (pickedId !== id && !window.matchMedia("(min-width: 1024px)").matches) panel.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" })
  }

  return (
    <>
      <section
        aria-labelledby={headingId}
        className="flex min-h-0 flex-col overflow-hidden rounded-4xl bg-card text-card-foreground shadow-surface ring-1 ring-foreground/10 lg:col-span-7"
      >
        <header className="flex items-baseline justify-between gap-4 px-8 pt-8 pb-4">
          <h2 id={headingId} className="font-heading text-2xl">
            Open tables
          </h2>
          {summary && <p className="text-sm text-muted-foreground">{summary}</p>}
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 lg:[scrollbar-width:thin]">
          {rows.length > 0 ? (
            <TableEntries aria-label="Open tables">
              {rows.map(({ id, entry }) => (
                <TableEntry key={id} {...entry} selected={id === picked?.id} controls={panelId} onSelect={() => pick(id)} />
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
      </section>
      <div id={panelId} ref={panel} aria-live="polite" className="order-first min-h-0 scroll-mt-navbar lg:order-none lg:col-span-5">
        {picked ? <LobbyDetail key={picked.id} {...picked.detail} onClose={() => setPickedId(null)} /> : lobby}
      </div>
    </>
  )
}
