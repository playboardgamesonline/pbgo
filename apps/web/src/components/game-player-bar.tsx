import Link from "next/link"
import { ArrowRight01Icon, ClockFadingIcon, DicesIcon, MedalFirstPlaceIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { AchievementsCard } from "@pbgo/ui/platform/achievements-card"
import { Badge } from "@pbgo/ui/platform/badge"
import { Button } from "@pbgo/ui/platform/button"
import { Metric } from "@pbgo/ui/platform/metric"
import { Progress } from "@pbgo/ui/platform/progress"
import { RankEmblem } from "@pbgo/ui/platform/rank-emblem"
import { StatBar, StatBarItem, StatBarLabel, StatBarNote, StatBarValue } from "@pbgo/ui/platform/stat-bar"
import { nextRank, rankLabel } from "@pbgo/ui/ranks"
import { resultWord, timePlayed, type Result } from "@pbgo/ui/results"
import type { HistoryEntry, PlayerStats } from "@/lib/game-activity"
import { dayOf, lastGameOf } from "@/lib/game-activity-props"

// What the signed-in visitor has done in a game, as the first section under the head of its page and above the tables: three cards a little apart, each its own block (`StatBar`), in this order: the rank's progress, the recent games and the achievements.
// Rank progress: its emblem (2.5rem: its crest where the owner has handed it over, Grandmaster's so far, and a stand-in where not, `RankEmblem`) at the left of its name (1.5rem, on one line whatever the room: the longest, "Grandmaster III", needs 174px), so that the label, the emblem and the thin bar under them share
// one left edge, then, under the bar, "Pts" in small capitals at its left and the points they have toward the next division over the ones it takes at its right ("36/100", muted, 0.875rem, 99 at the most since they move up at 100). Under them, three smaller figures, each with a picto at its left (`Metric`, `sm`): their play time
// (in hours with a decimal, "38.4 h", with the clock that fades), the games they played and their win rate (the games they won over the games they played, "58%", "—" before any game). Recent: their latest games, the latest first, `RECENT_MAX` of them, a row each: at its left the day with its year over the number of players, at its right, stuck to the edge, where they came ("1st") and how it ended as a badge (green for a
// win, red for a loss, grey for a draw or a game left before its end), and, at the top right of the card, level with its label, a "View history" button to the visitor's own page, `/me/games`, at its History section, with the game to filter by in `?game=`. Achievements (`AchievementsCard`): the badges they have earned, the latest first, in up to two rows of 4.75rem badges, as many as the card holds, with a "View all" button at the top right of the card, level with its label, and under the badges how many are earned over how many there are ("9/12"). The button and
// each badge open the list of all of them; the name, what it was for and the day are in that window, in a card under the pointer on a badge and in words for a screen reader. A figure that is not known says so in words: "Unranked", "No game yet", "None yet", "0 h" and "—" for a win rate. The page gives the cards to a visitor who is
// signed in, in a game that is live: the figures of a visitor who is not signed in, and of a game that cannot be played, are nobody's.
// From 80rem (1280px) of width the three cards are in one row: the rank's 22rem wide (its three figures side by side need 302px, so it stays as narrow as that), the recent games' and the achievements' sharing the rest, 1 and 1.4 fr (the places of a row of badges are counted from its width: four at 1280px, six from about 1400px),
// with 1rem between them; under 80rem the rank's and the recent games' are side by side, half the width each, the achievements' under them on the whole width, and on a phone the three are one over the other. In each card the label is at its top and what it says at its foot, at least 1rem under it (`StatBarItem`: the labels
// stand on one line across the row and what each says ends on one line), with 1.5rem round them. The achievements' content is the tallest, 184px (two rows of badges, 0.5rem, the count), as is the recent games' (four rows of 2.5rem, 0.5rem apart), so the cards are 264px high; the rank's content, 142px (its emblem and name, the bar 0.75rem under them, 0.5rem between the bar and what it
// reads, then its three figures), and the recent games' four rows of 2.5rem, 184px, end where it does.

/** How many of the latest games the recent card says: four rows of 2.5rem with 0.5rem between them are as tall as what the achievements' card holds, 184px. */
const RECENT_MAX = 4


/** How a game ended, as a badge: a win is green, a loss red, and a draw or a game left before its end grey. */
const RESULT_BADGE: Record<Result, "success" | "destructive" | "secondary"> = { won: "success", lost: "destructive", draw: "secondary", abandoned: "secondary" }

export function GamePlayerBar({ slug, stats, recent }: { slug: string; stats: PlayerStats; recent: readonly HistoryEntry[] }) {
  const { rank, rankProgress, secondsPlayed, gamesPlayed, wins, achievements, achievementsTotal } = stats
  const next = rank ? nextRank(rank) : null
  const earned = [...achievements].sort((a, b) => b.earnedAt.localeCompare(a.earnedAt))
  const winRate = gamesPlayed > 0 ? `${Math.round((wins / gamesPlayed) * 100)}%` : "—"

  return (
    <StatBar aria-label="Your progress" className="sm:grid-cols-2 min-[80rem]:grid-cols-[22rem_minmax(0,1fr)_minmax(0,1.4fr)]">
      <StatBarItem label="Rank progress">
        {rank && next && rankProgress && rankProgress.needed > 0 ? (
          <>
            <div className="flex items-center gap-3">
              <RankEmblem rank={rank} className="size-10 text-xl" />
              <StatBarValue className="text-2xl leading-8 whitespace-nowrap">{rankLabel(rank)}</StatBarValue>
            </div>
            <Progress
              value={Math.min(100, Math.max(0, (rankProgress.points / rankProgress.needed) * 100))}
              aria-label="Rank points"
              aria-valuetext={`${rankProgress.points} of ${rankProgress.needed}`}
              className="mt-1 h-1"
            />
            <div className="flex items-center justify-between gap-3">
              <StatBarLabel>Pts</StatBarLabel>
              <StatBarNote className="text-sm leading-5 tabular-nums">
                {Math.min(rankProgress.points, rankProgress.needed - 1)}/{rankProgress.needed}
              </StatBarNote>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <RankEmblem rank={rank} className="size-10 text-xl" />
              <StatBarValue className="text-2xl leading-8 whitespace-nowrap">{rank ? rankLabel(rank) : "Unranked"}</StatBarValue>
            </div>
            <StatBarNote>{!rank ? "Play ranked games to get a rank" : next ? `Next: ${rankLabel(next)}` : "Top of the board"}</StatBarNote>
          </>
        )}
        <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-3">
          <Metric size="sm" icon={ClockFadingIcon} label="Play time" value={timePlayed(secondsPlayed)} />
          <Metric size="sm" icon={DicesIcon} label="Games played" value={gamesPlayed} />
          <Metric size="sm" icon={MedalFirstPlaceIcon} label="Win rate" value={winRate} />
        </dl>
      </StatBarItem>

      <StatBarItem
        label="Recent"
        action={
          recent.length > 0 && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/me/games?game=${slug}#history`}>
                View history
                <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} data-icon="inline-end" aria-hidden="true" />
              </Link>
            </Button>
          )
        }
      >
        {recent.length > 0 ? (
          <ul aria-label="Your latest games" className="flex flex-col gap-2">
            {recent.slice(0, RECENT_MAX).map((entry) => {
              const game = lastGameOf(entry)
              return (
                <li key={entry.tableId} className="flex h-10 items-center justify-between gap-3 whitespace-nowrap">
                  <div className="flex flex-col">
                    <span className="font-heading text-sm leading-5 tabular-nums">{game.day}</span>
                    <span className="text-xs leading-4 text-muted-foreground">{entry.playerCount === 1 ? "1 player" : `${entry.playerCount} players`}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">{game.place}</span>
                    <Badge variant={RESULT_BADGE[game.result]}>{resultWord(game.result)}</Badge>
                  </div>
                </li>
              )
            })}
          </ul>
        ) : (
          <>
            <StatBarValue>—</StatBarValue>
            <StatBarNote>No game yet</StatBarNote>
          </>
        )}
      </StatBarItem>

      <AchievementsCard
        achievements={earned.map(({ id, name, description, earnedAt }) => ({ id, name, description, date: dayOf(earnedAt) }))}
        total={achievementsTotal}
        className="sm:col-span-2 min-[80rem]:col-span-1"
      />
    </StatBar>
  )
}
