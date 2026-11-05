import { ClockFadingIcon, DicesIcon, MedalFirstPlaceIcon } from "@hugeicons/core-free-icons"
import { AchievementStrip } from "@pbgo/ui/platform/achievement-strip"
import { Badge } from "@pbgo/ui/platform/badge"
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
// one left edge, then, under the bar, "Pts" in small capitals at its left and the points they have toward the next division over the ones it takes at its right ("36/100", muted, 0.875rem, 99 at the most since they move up at 100). Under them, three smaller figures, each with a picto at its left (`Metric`, `sm`): the games
// they played, their win rate (the games they won over the games they played, "58%", "—" before any game) and their play time (in hours with a decimal, "38.4 h", with the clock that fades). Recent: their latest games, the latest first, `RECENT_MAX` of them, a row each: the day with its year, where they came ("1st") and how it ended as a badge (green for a
// win, red for a loss, grey for a draw or a game left before its end). Achievements: the badges they have earned, the latest first, in one row of 4.75rem badges that holds as many as fit (`AchievementStrip`): the number of those that are left ("+7", with no outline: a round background under the pointer shows that it can be
// pressed) takes the last place when there are more, and a press on it or on a badge opens the list of all of them. The count of all of them is in the label; the name, what it was for and the day are in a card under the pointer, in the window and in words for a screen reader. A figure that is not known says so in words:
// "Unranked", "No game yet", "None yet", "0 h" and "—" for a win rate. The page gives the cards to a visitor who is signed in, in a game that is live: the figures of a visitor who is not signed in, and of a game that cannot be played, are nobody's.
// From 80rem (1280px) of width the three cards are in one row, 1.5, 1.1 and 1.6 fr wide (the rank's holds its three figures side by side, 304px; the achievements' holds four badges from about 1260px and up to eight at 1920px, the places being counted from the width of the row), with 1rem between them; under 80rem the rank's
// takes the whole width and the two others share the row under it, and on a phone the three are one over the other. In each card the label is at its top and what it says at its foot, at least 1rem under it (`StatBarItem`: the labels stand on one line across the row and what each says ends on one line), with 1.5rem round them. The rank's
// content is the tallest, 142px (its emblem and name, the bar 0.75rem under them, 0.5rem between the bar and what it reads, then its three figures), so the cards are 222px high; the recent games, four rows of 1.75rem, 136px, and the badges, 76px, end where it does, on the line of its figures.

/** How many of the latest games the recent card says: four rows of 1.75rem with 0.5rem between them are as tall as what the rank's card holds. */
const RECENT_MAX = 4


/** How a game ended, as a badge: a win is green, a loss red, and a draw or a game left before its end grey. */
const RESULT_BADGE: Record<Result, "success" | "destructive" | "secondary"> = { won: "success", lost: "destructive", draw: "secondary", abandoned: "secondary" }

export function GamePlayerBar({ stats, recent }: { stats: PlayerStats; recent: readonly HistoryEntry[] }) {
  const { rank, rankProgress, secondsPlayed, gamesPlayed, wins, achievements, achievementsTotal } = stats
  const next = rank ? nextRank(rank) : null
  const earned = [...achievements].sort((a, b) => b.earnedAt.localeCompare(a.earnedAt))
  const count = achievementsTotal > 0 ? `${earned.length}/${achievementsTotal}` : earned.length > 0 ? String(earned.length) : null
  const winRate = gamesPlayed > 0 ? `${Math.round((wins / gamesPlayed) * 100)}%` : "—"

  return (
    <StatBar aria-label="Your progress" className="sm:grid-cols-2 min-[80rem]:grid-cols-[minmax(0,1.5fr)_minmax(0,1.1fr)_minmax(0,1.6fr)]">
      <StatBarItem label="Rank progress" className="sm:col-span-2 min-[80rem]:col-span-1">
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
          <Metric size="sm" icon={DicesIcon} label="Games played" value={gamesPlayed} />
          <Metric size="sm" icon={MedalFirstPlaceIcon} label="Win rate" value={winRate} />
          <Metric size="sm" icon={ClockFadingIcon} label="Play time" value={timePlayed(secondsPlayed)} />
        </dl>
      </StatBarItem>

      <StatBarItem label="Recent">
        {recent.length > 0 ? (
          <ul aria-label="Your latest games" className="flex flex-col gap-2">
            {recent.slice(0, RECENT_MAX).map((entry) => {
              const game = lastGameOf(entry)
              return (
                <li key={entry.tableId} className="flex h-7 items-center gap-3 whitespace-nowrap">
                  <span className="w-26 font-heading text-sm tabular-nums">{game.day}</span>
                  <span className="w-9 text-sm text-muted-foreground">{game.place}</span>
                  <Badge variant={RESULT_BADGE[game.result]}>{resultWord(game.result)}</Badge>
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

      <StatBarItem label={count === null ? "Achievements" : `Achievements · ${count}`}>
        {earned.length > 0 ? (
          <AchievementStrip
            achievements={earned.map(({ id, name, description, earnedAt }) => ({ id, name, description, date: dayOf(earnedAt) }))}
            total={achievementsTotal}
          />
        ) : (
          <StatBarValue>None yet</StatBarValue>
        )}
      </StatBarItem>
    </StatBar>
  )
}
