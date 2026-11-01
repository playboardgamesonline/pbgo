import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { MoreHorizontalIcon, TrophyIcon } from "@hugeicons/core-free-icons"
import { cn } from "../utils"
import { initials } from "../friends"
import { boardOf, type LeaderboardRow } from "../leaderboard"
import { Avatar, AvatarFallback, AvatarImage } from "./avatar"
import { Badge } from "./badge"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "./empty"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./table"

// The best players of a game, as its page on the hub lists them: their place, who they are, their rating and how many games they won out of how many they played. It is drawn from the rows it is given and decides nothing: who is on
// the board and in which order is the page's (`@pbgo/ui/leaderboard` has the rule for which rows are drawn). The signed-in visitor finds themselves on it, in the top or after it. The board is as tall as its rows, up to the height the page gives
// it (`className`, `max-h-176`): past it the board scrolls, its header staying at the top and the visitor's own row in view, under the header or at the bottom, wherever they stand on the board.

type LeaderboardProps = Omit<React.ComponentProps<"div">, "children"> & {
  /** The best players, best first. The board draws the first `size` of them. */
  rows: readonly LeaderboardRow[]
  /** The signed-in visitor, when they have played the game: their row is marked, and drawn after the top when they are not in it. */
  you?: LeaderboardRow | null
  /** How many players the board draws: all of `rows` by default. */
  size?: number
  /** What a screen reader calls the table. */
  label?: string
  /** What the empty state says when nobody is ranked yet. */
  emptyTitle?: string
  emptyDescription?: string
}

/** The medal of the top three is no colour (the platform has none to give): their place and their name are in the full colour of the text, and the others' place is quiet. */
const PODIUM = 3

function LeaderboardLine({ row, you }: { row: LeaderboardRow; you: boolean }) {
  const podium = row.rank !== null && row.rank <= PODIUM
  return (
    <TableRow
      data-slot="leaderboard-row"
      data-you={you ? "" : undefined}
      aria-current={you ? "true" : undefined}
      // The visitor's row is `sticky` on both edges: it keeps its place in the list, and stays in view under the header or at the bottom when the board is scrolled away from it
      className={cn(you && "bg-muted hover:bg-muted [&>td]:sticky [&>td]:top-12 [&>td]:bottom-0 [&>td]:z-10 [&>td]:bg-muted")}
    >
      <TableCell data-slot="leaderboard-rank" className={cn("w-12 pr-0 pl-4 tabular-nums @sm:w-16 @sm:pl-6", podium ? "font-heading text-base" : "text-muted-foreground")}>
        {row.rank ?? <span aria-label="Not ranked yet">–</span>}
      </TableCell>
      <TableCell data-slot="leaderboard-player" className="w-full max-w-0 px-2 @sm:px-3">
        <div className="flex items-center gap-2 @sm:gap-3">
          <Avatar>
            {row.avatarUrl && <AvatarImage src={row.avatarUrl} alt="" />}
            <AvatarFallback>{initials(row.name)}</AvatarFallback>
          </Avatar>
          <span className={cn("truncate", !podium && !you && "text-muted-foreground")}>{row.name}</span>
          {you && <Badge variant="secondary" className="hidden @sm:inline-flex">You</Badge>}
        </div>
      </TableCell>
      <TableCell data-slot="leaderboard-rating" className="px-2 text-right tabular-nums @sm:px-3">
        {Math.round(row.rating)}
      </TableCell>
      <TableCell data-slot="leaderboard-wins" className="pr-4 pl-2 text-right tabular-nums @sm:pr-6 @sm:pl-3 @md:px-3">
        {row.wins}
      </TableCell>
      <TableCell data-slot="leaderboard-played" className="hidden pr-6 text-right text-muted-foreground tabular-nums @md:table-cell">
        {row.played}
      </TableCell>
    </TableRow>
  )
}

/**
 * The leaderboard of a game: a table of the players (their place, their name and picture, their rating, their wins and the games they played), the top three in the full colour of the text and the rest quiet. The visitor's own row is
 * marked (the `muted` fill, `aria-current`, and a "You" badge where the board is wide enough for it) and, when they are not among the rows, comes after them, behind a gap that says other players stand between. It is a card as tall as its rows, up to
 * the `max-h-…` that `className` gives it: past that the rows scroll inside it, by the wheel, the finger or the keyboard (the scrolling part is a focusable region), under a header that stays and with the visitor's row always in view. With nobody
 * ranked it is an empty state that says what it will hold. The container decides what fits (`@container`): the column of the games played is left out of a narrow board, the third of a page, so that the name still has room.
 */
function Leaderboard({ rows, you, size = rows.length, label = "Leaderboard", emptyTitle = "No ranked game yet", emptyDescription = "The best players of this game will be listed here.", className, ...props }: LeaderboardProps) {
  const { rows: top, own, gap } = boardOf(rows, you, size)
  if (top.length === 0 && !own) {
    return (
      <div data-slot="leaderboard" data-empty="" className={className} {...props}>
        <Empty className="border p-6">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeiconsIcon icon={TrophyIcon} strokeWidth={2} aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>{emptyTitle}</EmptyTitle>
            <EmptyDescription>{emptyDescription}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }
  return (
    <div data-slot="leaderboard" className={cn("@container flex flex-col overflow-hidden rounded-4xl bg-card py-2 text-card-foreground shadow-surface ring-1 ring-foreground/10", className)} {...props}>
      {/* The borders are the cells' (`border-separate`): a collapsed border belongs to the whole table and would scroll away from a `sticky` cell */}
      <Table
        className="border-separate border-spacing-0 [&_td]:border-b [&_th]:border-b [&_tbody_tr:last-child>td]:border-b-0"
        container={{
          role: "region",
          "aria-label": label,
          tabIndex: 0,
          className: "min-h-0 overflow-y-auto outline-none focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:ring-inset lg:[scrollbar-width:thin]",
        }}
      >
        <caption className="sr-only">{label}</caption>
        <TableHeader>
          <TableRow className="hover:bg-transparent [&>th]:sticky [&>th]:top-0 [&>th]:z-10 [&>th]:bg-card">
            <TableHead className="w-12 pr-0 pl-4 text-muted-foreground @sm:w-16 @sm:pl-6">
              <span aria-hidden="true">#</span>
              <span className="sr-only">Rank</span>
            </TableHead>
            <TableHead className="px-2 text-muted-foreground @sm:px-3">Player</TableHead>
            <TableHead className="px-2 text-right text-muted-foreground @sm:px-3">Rating</TableHead>
            <TableHead className="pr-4 pl-2 text-right text-muted-foreground @sm:pr-6 @sm:pl-3 @md:px-3">Wins</TableHead>
            <TableHead className="hidden pr-6 text-right text-muted-foreground @md:table-cell">Games</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {top.map((row) => (
            <LeaderboardLine key={row.id} row={row} you={row.id === you?.id} />
          ))}
          {gap && (
            <TableRow aria-hidden="true" className="hover:bg-transparent">
              <TableCell colSpan={5} className="py-0 text-center text-muted-foreground">
                <HugeiconsIcon icon={MoreHorizontalIcon} strokeWidth={2} className="mx-auto size-4" />
              </TableCell>
            </TableRow>
          )}
          {own && <LeaderboardLine row={own} you />}
        </TableBody>
      </Table>
    </div>
  )
}

export { Leaderboard }
export type { LeaderboardProps }
