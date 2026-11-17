import Link from "next/link"
import { ArrowRight01Icon, Calendar03Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import type { TimeFormat } from "@pbgo/accounts"
import { Button } from "@pbgo/ui/platform/button"
import { Pager } from "@pbgo/ui/platform/pager"
import { cn } from "@pbgo/ui/utils"
import { pagesOf, type HomeTournament } from "@/lib/home-aside"
import { EmptyBlock } from "./empty-block"
import { TournamentRow } from "./tournament-row"

// The open tournaments of the signed-in home, the second block of its right column: a heading with the way to the page of the tournaments, and the tournaments as rows, in pages that scroll sideways with a dot under them for each (`Pager`). How many rows a page holds, up to four, is
// the column's to say (`HomeAside` measures it with the article, which takes the height that the tournaments leave: `fitAside`), and the pages are the ones that the rows do not fit in. The block is what is left of the column's height from `xl`, the dots are under the rows, at the foot
// of the list and not of the card, which the block need not reach. With no tournament open it says so, in a frame.

export function HomeTournaments({ tournaments, perPage, timeFormat = "auto", className }: { tournaments: readonly HomeTournament[]; perPage: number; timeFormat?: TimeFormat; className?: string }) {
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
      <div data-slot="tournaments-area" className="flex min-h-0 flex-col xl:grow xl:basis-0">
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
