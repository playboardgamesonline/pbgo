import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Card, CardContent, CardHeader, CardTitle } from "@pbgo/ui/platform/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@pbgo/ui/platform/empty"
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@pbgo/ui/platform/item"
import { cn } from "@pbgo/ui/utils"
import type { OpenTable } from "@/lib/game-activity"

// What a game's page offers right under its head, before anything else: a big zone to create a game, which is the way into the game itself (a plain <a> to `/<slug>`, another root layout, loaded whole: the hub knows nothing
// of the game's options, they are in its own site) and, next to it, the tables that are being created. The zone is the link, so it has no button of its own. A game that is not live has the same zone, half transparent and not a
// link, and no list of tables; one that is live has the list, empty until there is something to list (`getOpenTables`).

/** The zone's own look: a card of the platform with the hover of a game's card. */
const ZONE =
  "group/play relative flex min-h-56 flex-col justify-between gap-8 overflow-hidden rounded-4xl bg-card p-8 text-card-foreground shadow-surface ring-1 ring-foreground/10 outline-none md:p-10"

export function GamePlay({ slug, name, live, players, tables }: { slug: string; name: string; live: boolean; players: string | null; tables: readonly OpenTable[] }) {
  return (
    <section aria-labelledby="play" className="grid gap-4 lg:grid-cols-3">
      <h2 id="play" className="sr-only">
        Play {name}
      </h2>
      {live ? (
        <a
          href={`/${slug}`}
          className={cn(ZONE, "transition-[box-shadow,background-color] hover:bg-secondary hover:shadow-float hover:ring-foreground/20 focus-visible:ring-3 focus-visible:ring-ring/30 lg:col-span-2")}
        >
          <span className="font-heading text-3xl md:text-5xl">Create a game</span>
          <span className="flex items-end justify-between gap-6">
            <span className="flex flex-col gap-1">
              <span className="max-w-md text-muted-foreground">Open a table, share its link and play with your friends.</span>
              {players && <span className="text-sm text-muted-foreground">{players}</span>}
            </span>
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-foreground text-background transition-transform duration-slow ease-standard group-hover/play:translate-x-1">
              <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} aria-hidden="true" className="size-6" />
            </span>
          </span>
        </a>
      ) : (
        <div aria-disabled="true" className={cn(ZONE, "opacity-50 lg:col-span-3")}>
          <span className="font-heading text-3xl md:text-5xl">Coming soon</span>
          <span className="max-w-md text-muted-foreground">You will be able to open a table of {name} here.</span>
        </div>
      )}

      {live && (
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="font-heading text-lg">Tables being created</CardTitle>
          </CardHeader>
          <CardContent>
            {tables.length > 0 ? (
              <ul className="flex flex-col gap-3">
                {tables.map((table) => (
                  <li key={table.code}>
                    <Item variant="outline" size="sm" asChild>
                      <a href={`/${slug}/game/${table.code}`}>
                        <ItemContent>
                          <ItemTitle>{table.host}</ItemTitle>
                          <ItemDescription>
                            {table.taken} / {table.seats} players
                          </ItemDescription>
                        </ItemContent>
                        <ItemActions>
                          <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} aria-hidden="true" className="size-5 text-muted-foreground" />
                        </ItemActions>
                      </a>
                    </Item>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty className="p-2 md:p-4">
                <EmptyHeader>
                  <EmptyTitle>No table is waiting</EmptyTitle>
                  <EmptyDescription>The tables that wait for players will be listed here.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </CardContent>
        </Card>
      )}
    </section>
  )
}
