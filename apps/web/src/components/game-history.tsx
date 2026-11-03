import { Clock01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { initials } from "@pbgo/ui/friends"
import { Avatar, AvatarFallback, AvatarGroup, AvatarImage } from "@pbgo/ui/platform/avatar"
import { Badge } from "@pbgo/ui/platform/badge"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@pbgo/ui/platform/empty"
import type { Result } from "@pbgo/ui/results"
import { namesOf } from "@pbgo/ui/tables"
import type { Expansion, HistoryEntry } from "@/lib/game-activity"
import { historyRows, type HistoryRow } from "@/lib/game-activity-props"

// The latest games of the signed-in visitor in a game, in the window that the button of the banner under the head opens (`GameHistoryStats`): the last ten at most, one row each, in no card of their own (the window is the card). A row is called by the name of the game, with the expansions it was played with after it, and shows
// the pictures of the others at the table (no names: the group is labelled for a screen reader, and the pointer says each). On its right, how long ago it was, what it scored and the experience it gave, and at the far end how it ended, in a dark tint: green for a win, red for a loss, outlined for a draw
// or a game that was left. There is no change of rating: a rating is never shown. A visitor with no game has an empty state in its place.

/** How many games the window lists. */
const LATEST = 10

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

/** `name` is the game's and `expansions` the ones it has, which a row says it was played with. `now` is when how long ago each was is counted from: the page's own by default, a fixed one for the docs' specimens, which are built once. */
export function GameHistory({
  entries,
  name,
  expansions = [],
  now,
}: {
  entries: readonly HistoryEntry[]
  name: string
  expansions?: readonly Expansion[]
  now?: number
}) {
  const rows = historyRows(entries, { name, expansions }, now)
  if (rows.length === 0) {
    return (
      <Empty className="h-full border-0 p-6">
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
  return (
    <ul aria-label="Your latest games" className="@container flex flex-col [&>li:last-child]:border-b-0">
      {rows.slice(0, LATEST).map((row) => (
        <HistoryItem key={row.id} row={row} />
      ))}
    </ul>
  )
}
