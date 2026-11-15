import Link from "next/link"
import { figuresOf, type GameFigures, type GameTotals } from "@pbgo/accounts"
import { Card, CardContent } from "@pbgo/ui/platform/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@pbgo/ui/platform/empty"
import { Progress } from "@pbgo/ui/platform/progress"
import { RankEmblem } from "@pbgo/ui/platform/rank-emblem"
import { StatBarLabel } from "@pbgo/ui/platform/stat-bar"
import { rankLabel } from "@pbgo/ui/ranks"
import { lengthOf } from "@pbgo/ui/results"
import { GameThumb } from "@/components/game-record"
import { RankProgress, rankBarOf } from "@/components/rank-progress"
import type { MemberRank } from "@/lib/member-games"

// What the career says beside the history. For every game, two cards one under the other: the rank the member has in each game they rated, one row for each (the game's picture, its name, its rank and how far they are through its division, and the rank's emblem at the right), compact so that one game and sixteen both
// fit, each leading to that game's career; then their figures over all of them, as a list. For one game (the one the history is narrowed to, or the only one they played), a single card, since the history is that game's already and its name is not said again: its rank in the middle, the
// emblem big with the rank's name under it and the bar under that (`RankProgress`, `centered`), and that game's figures in a list well under them, with no line between. The cards keep 2rem round their content (`ROOM`) and the rows of a list are
// 3.5rem high. A member who rated no game has an empty state in place of the ranks. A server component.

/** The room round the content of a card of the career: 2rem, where a card of a game's page keeps 1.5rem. */
const ROOM = "[--card-spacing:--spacing(8)]"

/** One game's rank as a row: the game's picture, then its name with its rank at the right and, under them, the bar with the points over what the division takes, and the rank's emblem at the far right. A press narrows the career to the game. */
function RankRow({ entry }: { entry: MemberRank }) {
  const bar = rankBarOf(entry.rank, entry.progress)
  return (
    <li>
      <Link
        href={`/me/career?game=${encodeURIComponent(entry.slug)}`}
        scroll={false}
        className="-mx-3 flex items-center gap-3 rounded-2xl px-3 py-3 outline-none transition-colors duration-fast hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/30"
      >
        <GameThumb slug={entry.slug} name={entry.name} />
        <span className="flex min-w-0 flex-1 flex-col gap-2">
          <span className="flex items-baseline justify-between gap-3">
            <span title={entry.name} className="truncate text-sm">{entry.name}</span>
            <span className="shrink-0 font-heading">{rankLabel(entry.rank)}</span>
          </span>
          <span className="flex items-center gap-3">
            <Progress value={bar.value} aria-label={`${entry.name}: rank points`} aria-valuetext={bar.text} className="h-1 flex-1" />
            {bar.points && <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{bar.points}</span>}
          </span>
        </span>
        <RankEmblem rank={entry.rank} className="size-10 text-xl" />
      </Link>
    </li>
  )
}

/** The rank in every game the member rated, the highest first. */
function Ranks({ ranks }: { ranks: readonly MemberRank[] }) {
  if (ranks.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyTitle>No rank yet</EmptyTitle>
          <EmptyDescription>Your rank on each game is shown here once you have played ranked.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }
  return (
    <Card className={ROOM}>
      <CardContent className="flex flex-col gap-4">
        <StatBarLabel>Ranks</StatBarLabel>
        <ul className="flex flex-col">
          {ranks.map((entry) => (
            <RankRow key={entry.slug} entry={entry} />
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

/** The figures as a list, a row for each: its name at the left, quiet, and what it counts at the right. The game they played the most is for every game, since it says nothing of one. */
function StatList({ figures, favourite }: { figures: GameFigures; favourite: string | null }) {
  const rows: [string, string][] = [
    ["Games played", String(figures.played)],
    ["Ranked games", String(figures.rated)],
    ["Wins", String(figures.wins)],
    ["Win rate", figures.winRate === null ? "—" : `${figures.winRate}%`],
    ["Time played", figures.seconds > 0 ? lengthOf(figures.seconds) : "—"],
    ...(favourite ? ([["Most played", favourite]] as [string, string][]) : []),
  ]
  return (
    <dl className="flex flex-col">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-baseline justify-between gap-4 border-b py-3.5 first:pt-0 last:border-b-0 last:pb-0">
          <dt className="text-sm text-muted-foreground">{label}</dt>
          <dd className="min-w-0 truncate font-heading tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

/** The figures over every game, as a card of their own. */
function Figures({ figures, favourite }: { figures: GameFigures; favourite: string | null }) {
  return (
    <Card className={ROOM}>
      <CardContent className="flex flex-col gap-5">
        <StatBarLabel>Stats</StatBarLabel>
        <StatList figures={figures} favourite={favourite} />
      </CardContent>
    </Card>
  )
}

/** One game, in a single card: its rank in the middle (a game they never rated is "Unranked") and, well under it, with air and no line, its figures. */
function GameCareer({ entry, figures }: { entry: MemberRank | null; figures: GameFigures }) {
  return (
    <Card className={ROOM}>
      <CardContent className="flex flex-col gap-12">
        <div className="flex min-w-0 flex-col gap-8">
          <RankProgress centered rank={entry?.rank ?? null} progress={entry?.progress ?? null} />
        </div>
        {figures.played > 0 && <StatList figures={figures} favourite={null} />}
      </CardContent>
    </Card>
  )
}

/** `selected` is the game the career is narrowed to (its slug), null for every game; `favourite` is the name of the game they played the most. */
export function CareerPanel({ selected, ranks, perGame, favourite }: { selected: string | null; ranks: readonly MemberRank[]; perGame: readonly GameTotals[]; favourite: string | null }) {
  const game = selected === null ? null : (perGame.find((row) => row.slug === selected) ?? null)
  const figures = figuresOf(game ? [game] : perGame)
  return (
    <aside aria-label="Ranks and stats" className="flex flex-col gap-6">
      {game ? (
        <GameCareer entry={ranks.find((entry) => entry.slug === game.slug) ?? null} figures={figures} />
      ) : (
        <>
          <Ranks ranks={ranks} />
          {figures.played > 0 && <Figures figures={figures} favourite={favourite} />}
        </>
      )}
    </aside>
  )
}
