import Link from "next/link"
import { ArrowRight01Icon, DicesIcon, MedalFirstPlaceIcon, UserMultipleIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { AchievementsCard } from "@pbgo/ui/platform/achievements-card"
import { Badge } from "@pbgo/ui/platform/badge"
import { Button } from "@pbgo/ui/platform/button"
import { Metric } from "@pbgo/ui/platform/metric"
import { Progress } from "@pbgo/ui/platform/progress"
import { RankEmblem } from "@pbgo/ui/platform/rank-emblem"
import { StatBar, StatBarItem, StatBarLabel, StatBarNote, StatBarValue } from "@pbgo/ui/platform/stat-bar"
import { nextRank, rankLabel } from "@pbgo/ui/ranks"
import { pointsLabel, pointsTone, winRate } from "@pbgo/ui/results"
import type { Expansion, HistoryEntry, PlayerStats } from "@/lib/game-activity"
import { dayOf, lastGameOf } from "@/lib/game-activity-props"

// What the signed-in visitor has done in a game, as the first section under the head of its page and above the tables: three cards a little apart (`StatBar`), in this order: the rank, the recent games and the achievements.
// Rank: its emblem (2.5rem: its crest where the owner has handed it over, Grandmaster's so far, and a stand-in where not, `RankEmblem`) at the left of its name (1.5rem, on one line whatever the room: the longest, "Grandmaster III", needs 174px), so that the label, the emblem and the thin bar under them share one left edge,
// then, under the bar, "Pts" in small capitals at its left and the points they have toward the next division over the ones it takes at its right ("36/100", muted, 0.875rem, 99 at the most since they move up at 100). Under them, two smaller figures, each with a picto at its left (`Metric`, `sm`): the games they played and their win
// rate (the games they won over the games they played, "58%", "—" before any game). Recent: their latest games, the latest first, `RECENT_MAX` of them, a row each: at its left the day with its year over the group icon and the number of players, then, to the right of that number, the expansions the game was played with ("+" and their names, cut when they are long), at its right, stuck to the edge, where they came ("1st") and the rank points it
// gave or took as a badge in the same colours as a win and a loss were ("+32" in green, "−11" in red, "0" or "—" in grey), and, at the top right of the card, level with its label, a "View history" button to the visitor's own page, `/me/games`, at its History section, with the game to filter by in `?game=`. Achievements (`AchievementsCard`): the badges they have earned, the latest first, in at most two
// rows of three, with a "View all" button at the top right of the card, how many are earned over how many there are in brackets after the label ("Achievements (9/12)"), and, when there are more than six, "+5" for the sixth place, at the bottom right, over the first five; the button, that number and each badge open the list of all of them. A figure that is
// not known says so in words: "Unranked", "No game yet", "None yet" and "—" for a win rate. The page gives the cards to a visitor who is signed in, in a game that is live: the figures of a visitor who is not signed in, and of a game that cannot be played, are nobody's.
// From 80rem (1280px) of width the three cards are in one row: the rank's 20rem wide (its name row needs 226px of room, its two figures 204px), the achievements' 21rem (its label with the count and its button need 283px, its three badges 236px) and the recent games' the rest, with 1rem between them;
// from `md` and under 80rem the rank's and the achievements' are side by side, half the width each, and the recent games' under them on the whole width; under `md` the three are one over the other. In each card the label is at its top and what it says at its foot, at least 1rem under it (`StatBarItem`: the labels stand on one line
// across the row and what each says ends on one line), with 1.5rem round them. The recent games' content is the tallest, four rows of 2.5rem with 0.5rem between them, 184px, so the cards are 264px high; the achievements' two rows, 156px, and the rank's content, 142px (its emblem and name, the bar 0.75rem under them, 0.5rem between the bar and what it
// reads, then its two figures), end where it does.

/** How many of the latest games the recent card says: four rows of 2.5rem with 0.5rem between them, 184px. */
const RECENT_MAX = 4

export function GamePlayerBar({ slug, stats, recent, expansions }: { slug: string; stats: PlayerStats; recent: readonly HistoryEntry[]; expansions: readonly Expansion[] }) {
  const { rank, rankProgress, gamesPlayed, wins, achievements, achievementsTotal } = stats
  const next = rank ? nextRank(rank) : null
  const earned = [...achievements].sort((a, b) => b.earnedAt.localeCompare(a.earnedAt))
  const rate = winRate(wins, gamesPlayed)

  return (
    <StatBar aria-label="Your progress" className="md:grid-cols-2 min-[80rem]:grid-cols-[20rem_minmax(0,1fr)_21rem]">
      <StatBarItem label="Rank">
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
        <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-3">
          <Metric size="sm" icon={DicesIcon} label="Games played" value={gamesPlayed} />
          <Metric size="sm" icon={MedalFirstPlaceIcon} label="Win rate" value={rate === null ? "—" : `${rate}%`} />
        </dl>
      </StatBarItem>

      <StatBarItem
        label="Recent"
        className="md:order-last md:col-span-2 min-[80rem]:order-none min-[80rem]:col-span-1"
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
              const names = entry.expansions.flatMap((id) => expansions.find((expansion) => expansion.id === id)?.name ?? [])
              return (
                <li key={entry.tableId} className="flex h-10 items-center justify-between gap-3 whitespace-nowrap">
                  <div className="flex min-w-0 flex-col">
                    <span className="font-heading text-sm leading-5 tabular-nums">{game.day}</span>
                    <span className="flex min-w-0 items-center gap-1 text-xs leading-4 text-muted-foreground">
                      <HugeiconsIcon icon={UserMultipleIcon} strokeWidth={2} className="size-3.5 shrink-0" aria-hidden="true" />
                      <span aria-hidden="true">{entry.playerCount}</span>
                      <span className="sr-only">{entry.playerCount === 1 ? "1 player" : `${entry.playerCount} players`}</span>
                      {names.length > 0 && (
                        <span className="ml-1 truncate" title={names.join(", ")}>
                          + {names.join(", ")}
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-sm text-muted-foreground">{game.place}</span>
                    <Badge variant={pointsTone(entry.points)} className="tabular-nums">
                      {pointsLabel(entry.points)}
                    </Badge>
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
      />
    </StatBar>
  )
}
