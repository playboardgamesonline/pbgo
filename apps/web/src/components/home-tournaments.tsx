"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ArrowRight01Icon, Calendar03Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import type { TimeFormat } from "@pbgo/accounts"
import { Button } from "@pbgo/ui/platform/button"
import { Pager } from "@pbgo/ui/platform/pager"
import { cn } from "@pbgo/ui/utils"
import { PAGER_DOTS_ROOM, pagesOf, perPageFor, TOURNAMENTS_PER_PAGE_MAX, type HomeTournament } from "@/lib/home-aside"
import { EmptyBlock } from "./empty-block"
import { TournamentRow } from "./tournament-row"

// The open tournaments of the signed-in home, the second block of its right column: a heading with the way to the page of the tournaments, and the tournaments as rows, in pages that scroll sideways with a dot under them for each (`Pager`). From `xl` the column is beside the
// card and as tall as it, and this block has what is left of its height: a page then holds as many rows as that height lets it, up to four, and the pages are the ones that the rows do not fit in. The dots are under the rows, at the foot of the list and not of the card, which the block
// need not reach. Under `xl` the block has no height of its own, so every page holds the most. With no tournament open it says so, in a frame.

/** From this width the column is beside the card, as tall as it (`xl`: 80rem). */
const BESIDE = "(min-width: 80rem)"

export function HomeTournaments({ tournaments, timeFormat = "auto", className }: { tournaments: readonly HomeTournament[]; timeFormat?: TimeFormat; className?: string }) {
  const [perPage, setPerPage] = useState(TOURNAMENTS_PER_PAGE_MAX)
  const area = useRef<HTMLDivElement>(null)

  // How many rows fit what is left of the column's height, less the dots, which is set by the column and not by what the rows are, so that more rows on a page do not change it
  useEffect(() => {
    const element = area.current
    if (!element) return
    const beside = window.matchMedia(BESIDE)
    const measure = () => {
      // The tallest row there is, so that a page of rows that are not all as tall as the first is never cut
      const rowHeight = Math.max(0, ...Array.from(element.querySelectorAll<HTMLElement>('[data-slot="item"]'), (row) => Math.ceil(row.getBoundingClientRect().height)))
      setPerPage(beside.matches ? perPageFor(element.clientHeight - PAGER_DOTS_ROOM, rowHeight) : TOURNAMENTS_PER_PAGE_MAX)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    beside.addEventListener("change", measure)
    return () => {
      observer.disconnect()
      beside.removeEventListener("change", measure)
    }
  }, [tournaments.length])

  return (
    <section aria-labelledby="open-tournaments" className={cn("flex min-h-0 flex-col gap-3", className)}>
      <div className="flex items-center justify-between gap-4">
        <h2 id="open-tournaments" className="font-heading text-lg">
          Open tournaments
        </h2>
        <Button asChild variant="ghost" size="sm">
          <Link href="/tournaments">
            See all
            <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} data-icon="inline-end" aria-hidden="true" />
          </Link>
        </Button>
      </div>
      <div ref={area} className="flex min-h-0 flex-col xl:grow xl:basis-0">
        {tournaments.length === 0 ? (
          <EmptyBlock title="No tournament is open" icon={Calendar03Icon} />
        ) : (
          <Pager
            className="gap-2"
            label="Open tournaments"
            pages={pagesOf(tournaments, perPage).map((rows, page) => (
              <ul key={page} className="flex flex-col gap-3">
                {rows.map((tournament) => (
                  <li key={tournament.id}>
                    <TournamentRow tournament={tournament} timeFormat={timeFormat} game={tournament.game} compact />
                  </li>
                ))}
              </ul>
            ))}
          />
        )}
      </div>
    </section>
  )
}
