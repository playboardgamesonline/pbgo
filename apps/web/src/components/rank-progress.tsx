import { DicesIcon, MedalFirstPlaceIcon } from "@hugeicons/core-free-icons"
import { Metric } from "@pbgo/ui/platform/metric"
import { Progress } from "@pbgo/ui/platform/progress"
import { RankEmblem } from "@pbgo/ui/platform/rank-emblem"
import { StatBarLabel, StatBarNote, StatBarValue } from "@pbgo/ui/platform/stat-bar"
import { rankLabel, type Rank } from "@pbgo/ui/ranks"
import { winRate } from "@pbgo/ui/results"
import { cn } from "@pbgo/ui/utils"

// What a member's rank in a game says, as the content of a card: the emblem (2.5rem: its crest where the owner has handed it over, and a stand-in where not, `RankEmblem`) at the left of the rank's name (1.5rem, on one line whatever the room: the longest, "Grandmaster III", needs 174px), so that the
// name, the emblem and the thin bar under them share one left edge; under the bar, "Pts" in small capitals at its left and the points they have toward the next division over the ones it takes at its right ("36/100", muted, 0.875rem, 99 at the most since they move up at 100). The bar and that
// line stop 1rem short of the right of the card's content (`mr-4`), so that the bar does not run along the whole card and the line ends where the bar does. They are always there, whatever the rank: the bar is empty and the points say "—" where the progress is not known (an unranked
// member, a rank with no points) and the bar is full at Legend, which has nothing above it; no line says which rank is next. Where `metrics` is given, two smaller figures follow, each with a picto at its left (`Metric`): the games they played and their win rate (the games they won over the
// games they played, "58%", "—" before any game). The first card of a game's page draws it with them. `centered` is the rank on its own, as the heart of a card (the career of one game): the emblem big (7rem) in the middle, the rank's name under it (1.875rem) 1.5rem lower, then the bar as wide as the card's
// content, with its points under it as before. A fragment: the parts are the card's own children, and the label of the card, if it has one, is the caller's.

/** The bar of a rank and the words that say it: how full it is (the points over the 100 of a division; empty where they are not known, full at Legend), the points over what it takes ("36/100", null where not known) and the sentence a screen reader gets. */
export function rankBarOf(rank: Rank | null, progress: { points: number; needed: number } | null): { value: number; points: string | null; text: string } {
  const known = progress && progress.needed > 0 ? progress : null
  return {
    value: known ? Math.min(100, Math.max(0, (known.points / known.needed) * 100)) : rank?.tier === "Legend" ? 100 : 0,
    points: known ? `${Math.min(known.points, known.needed - 1)}/${known.needed}` : null,
    text: known ? `${known.points} of ${known.needed}` : rank?.tier === "Legend" ? "Top of the board" : "Not known",
  }
}

export function RankProgress({
  rank,
  progress,
  metrics,
  centered = false,
}: {
  rank: Rank | null
  progress: { points: number; needed: number } | null
  metrics?: { gamesPlayed: number; wins: number }
  centered?: boolean
}) {
  const bar = rankBarOf(rank, progress)
  const rate = metrics ? winRate(metrics.wins, metrics.gamesPlayed) : null
  const name = rank ? rankLabel(rank) : "Unranked"

  return (
    <>
      {centered ? (
        <div className="flex flex-col items-center gap-6 text-center">
          <RankEmblem rank={rank} className="size-28 text-6xl" />
          <StatBarValue className="text-3xl leading-9">{name}</StatBarValue>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <RankEmblem rank={rank} className="size-10 text-xl" />
          <StatBarValue className="text-2xl leading-8 whitespace-nowrap">{name}</StatBarValue>
        </div>
      )}
      <div className={cn("flex flex-col", centered ? "gap-3" : "mt-1 mr-4 gap-2")}>
        <Progress value={bar.value} aria-label="Rank points" aria-valuetext={bar.text} className="h-1" />
        <div className="flex items-center justify-between gap-3">
          <StatBarLabel>Pts</StatBarLabel>
          <StatBarNote className="text-sm leading-5 tabular-nums">{bar.points ?? "—"}</StatBarNote>
        </div>
      </div>
      {metrics && (
        <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-3">
          <Metric icon={DicesIcon} label="Games played" value={metrics.gamesPlayed} />
          <Metric icon={MedalFirstPlaceIcon} label="Win rate" value={rate === null ? "—" : `${rate}%`} />
        </dl>
      )}
    </>
  )
}
