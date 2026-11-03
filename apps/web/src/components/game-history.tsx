import { useId } from "react"
import { ArrowDown01Icon, Clock01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { initials } from "@pbgo/ui/friends"
import { Avatar, AvatarFallback, AvatarGroup, AvatarImage } from "@pbgo/ui/platform/avatar"
import { Badge } from "@pbgo/ui/platform/badge"
import { Button } from "@pbgo/ui/platform/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@pbgo/ui/platform/collapsible"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@pbgo/ui/platform/empty"
import type { Result } from "@pbgo/ui/results"
import { namesOf } from "@pbgo/ui/tables"
import { cn } from "@pbgo/ui/utils"
import type { Expansion, HistoryEntry } from "@/lib/game-activity"
import { historyRows, type HistoryRow } from "@/lib/game-activity-props"

// The latest games of the signed-in visitor in a game, on the left of their stats (`GameHistoryStats`): the first three at once, the third fading out at the bottom (a mask on the list, as in `SectionPreview`) under a button that unrolls the rest, ten games at most. A row is
// called by the name of the game, with the expansions it was played with after it, and shows the pictures of the others at the table (no names: the group is labelled for a screen reader, and the pointer says each). On its right, how long ago it was,
// what it scored and the experience it gave, and at the far end how it ended, in a dark tint: green for a win, red for a loss, outlined for a draw or a game that was left. There is no change of rating: a rating is never shown. The colour of the
// result. A visitor with no game has an empty state in its place, and one with three or fewer has no fade and no button.

/** How many games are there before the rest is asked for. */
const PEEK = 3

/** How a game ended, as a badge: a win in green, a loss in red, both dark tints, and a draw or a game that was left outlined. */
function ResultBadge({ result }: { result: Result }) {
  return result === "won" ? (
    <Badge variant="success" className="w-12">
      Won
    </Badge>
  ) : result === "lost" ? (
    <Badge variant="destructive" className="w-12">
      Lost
    </Badge>
  ) : (
    <Badge variant="outline" className="w-12">
      {result === "draw" ? "Draw" : "Left"}
    </Badge>
  )
}

function HistoryItem({ row }: { row: HistoryRow }) {
  return (
    <li className="flex items-center gap-4 border-b px-6 py-4">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="shrink-0">{row.title}</span>
          {row.expansions.length > 0 && <span className="truncate text-sm text-muted-foreground">+ {row.expansions.join(", ")}</span>}
        </span>
        <AvatarGroup role="img" aria-label={`Played with ${namesOf(row.opponents)}`}>
          {row.opponents.map((opponent, index) => (
            <Avatar key={index} size="sm" title={opponent.name}>
              {opponent.avatarUrl && <AvatarImage src={opponent.avatarUrl} alt="" />}
              <AvatarFallback>{initials(opponent.name)}</AvatarFallback>
            </Avatar>
          ))}
        </AvatarGroup>
        <span className="sr-only">{row.place}</span>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5 text-sm">
        <span className="text-muted-foreground">{row.when}</span>
        <span className="flex items-center gap-3 tabular-nums">
          {row.score && <span className="hidden @sm:inline">{row.score}</span>}
          {row.xp && <span className="hidden text-muted-foreground @md:inline">{row.xp}</span>}
        </span>
      </div>
      <ResultBadge result={row.result} />
    </li>
  )
}

/** `name` is the game's and `expansions` the ones it has, which a row says it was played with. `now` is when how long ago each was is counted from, and `defaultOpen` draws it unrolled: both for the docs' specimens, a visitor finds the first games, and asks for the rest. */
export function GameHistory({
  entries,
  name,
  expansions = [],
  now,
  defaultOpen = false,
}: {
  entries: readonly HistoryEntry[]
  name: string
  expansions?: readonly Expansion[]
  now?: number
  defaultOpen?: boolean
}) {
  const headingId = useId()
  const rows = historyRows(entries, { name, expansions }, now)
  if (rows.length === 0) {
    return (
      <Empty className="border p-6">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <HugeiconsIcon icon={Clock01Icon} strokeWidth={2} aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>No game yet</EmptyTitle>
          <EmptyDescription>The games you play in {name} will be listed here, the latest first.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }
  const rest = rows.slice(PEEK)
  return (
    <Collapsible defaultOpen={defaultOpen} className="group/history @container overflow-hidden rounded-3xl bg-card text-card-foreground shadow-surface ring-1 ring-foreground/10">
      <h3 id={headingId} className="px-6 py-4">
        Your latest games
      </h3>
      <ul
        aria-labelledby={headingId}
        className={cn(
          "border-t",
          rest.length > 0
            ? "mask-b-from-65% transition-[--tw-mask-bottom-from-position] duration-slow ease-standard group-data-[state=open]/history:mask-b-from-100% motion-reduce:transition-none"
            : "[&>li:last-child]:border-b-0"
        )}
      >
        {rows.slice(0, PEEK).map((row) => (
          <HistoryItem key={row.id} row={row} />
        ))}
      </ul>
      {rest.length > 0 && (
        <>
          <CollapsibleContent>
            <ul aria-label="Earlier games">
              {rest.map((row) => (
                <HistoryItem key={row.id} row={row} />
              ))}
            </ul>
          </CollapsibleContent>
          {/* Closed, the button is pulled up over the fade by its own height (2.25rem) and the 1rem under it; open, it comes down under the last game. Both margins move with the rows that unroll */}
          <div className="relative -mt-13 flex justify-center px-6 pb-4 transition-[margin,padding] duration-slow ease-standard group-data-[state=open]/history:mt-0 group-data-[state=open]/history:pt-4 motion-reduce:transition-none">
            <CollapsibleTrigger asChild>
              <Button variant="secondary" className="shadow-float">
                <span className="group-data-[state=open]/history:hidden">Show more</span>
                <span className="hidden group-data-[state=open]/history:inline">Show less</span>
                <HugeiconsIcon
                  icon={ArrowDown01Icon}
                  strokeWidth={2}
                  data-icon="inline-end"
                  aria-hidden="true"
                  className="transition-transform duration-base ease-standard group-data-[state=open]/history:rotate-180"
                />
              </Button>
            </CollapsibleTrigger>
          </div>
        </>
      )}
    </Collapsible>
  )
}
