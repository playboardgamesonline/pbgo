import { ClockFadingIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { AchievementStrip } from "@pbgo/ui/platform/achievement-strip"
import { Badge } from "@pbgo/ui/platform/badge"
import { Progress } from "@pbgo/ui/platform/progress"
import { RankEmblem } from "@pbgo/ui/platform/rank-emblem"
import { StatBar, StatBarItem, StatBarLabel, StatBarNote, StatBarValue } from "@pbgo/ui/platform/stat-bar"
import { nextRank, rankLabel } from "@pbgo/ui/ranks"
import { resultWord, timePlayed, type Result } from "@pbgo/ui/results"
import type { HistoryEntry, PlayerStats } from "@/lib/game-activity"
import { dayOf, lastGameOf } from "@/lib/game-activity-props"

// What the signed-in visitor has done in a game, as the first section under the head of its page and above the tables: one bar of four cells (`StatBar`), in this order: the rank, the play time, the last played and the achievements.
// Rank: its emblem (4rem: its crest where the owner has handed it over, Grandmaster's so far, and a stand-in where not, `RankEmblem`), its name at 1.5rem, a thin bar under it and, under the bar, "Pts" in small capitals at its left and the points they
// have toward the next division over the ones it takes at its right ("36/100", muted, 0.875rem, 99 at the most since they move up at 100). Play time: in hours, as big as 2.25rem, with a light clock that fades at its left. Last played: the day of their last game with its year and, under it, where they came ("1st") and how it ended as a badge (green for a win, red for a loss,
// grey for a draw or a game left before its end), two lines of their own. Achievements: the badges they have earned, the latest first, in one row
// of 4.75rem badges, as tall as the text of the cells beside it, that holds as many as fit (`AchievementStrip`): the number of those that are left ("+7", with no outline: a round background under the pointer shows that it can be pressed) takes the last place when there are more, and a press on it or on a badge opens the list of all of them. The count of all of them is in the label; the name,
// what it was for and the day are in a card under the pointer, in the window and in words for a screen reader. A figure that is not known says so in words: "Unranked", "No game yet", "None yet" (and "0 h" for the time). The page gives the bar to a visitor
// who is signed in, in a game that is live: the figures of a visitor who is not signed in, and of a game that cannot be played, are nobody's.
// From 82.5rem (1320px) of width the four cells are in one row (in rem, like `sm`, so that the stylesheet puts the breakpoint after it): the rank's 1.2fr, the play time's 0.8fr (the least wide: its clock and its figure need about 195px, 215px at three digits of hours), the last played's 1fr (its day, with its year, needs about 220px) and the achievements' 1.2fr (the three badges that the row holds need
// 236px, four need 316px, which it has from about 1420px), so that the longest name of a rank stays on one line. Under that width they are two by two, and one over the other on a phone. The room is the same in every
// cell: 1.5rem on every side, the label at its top and what it says at its foot with at least 1rem between them (`StatBarItem`: the labels stand on one line across the row and what each says ends on one line), the rank's name on a row 2rem high with
// the bar 0.75rem under it (0.5rem between the bar and what it reads). The texts of the rank and of the achievements are 76px high (the badges are as tall as the name and what is under it) and set a bar 156px high. The last played's two lines and the play time's hours are blocks
// of their own, shorter, which end where the others do: on the line of the rank's points and of the foot of the badges.

/** How a game ended, as a badge: a win is green, a loss red, and a draw or a game left before its end grey. */
const RESULT_BADGE: Record<Result, "success" | "destructive" | "secondary"> = { won: "success", lost: "destructive", draw: "secondary", abandoned: "secondary" }

export function GamePlayerBar({ stats, latest }: { stats: PlayerStats; latest: HistoryEntry | null }) {
  const { rank, rankProgress, secondsPlayed, achievements, achievementsTotal } = stats
  const next = rank ? nextRank(rank) : null
  const earned = [...achievements].sort((a, b) => b.earnedAt.localeCompare(a.earnedAt))
  const count = achievementsTotal > 0 ? `${earned.length}/${achievementsTotal}` : earned.length > 0 ? String(earned.length) : null
  const last = latest ? lastGameOf(latest) : null

  return (
    <StatBar aria-label="Your progress" className="sm:grid-cols-2 min-[82.5rem]:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1.2fr)]">
      <StatBarItem label="Rank" visual={<RankEmblem rank={rank} />}>
        {rank && next && rankProgress && rankProgress.needed > 0 ? (
          <>
            <StatBarValue className="text-2xl leading-8">{rankLabel(rank)}</StatBarValue>
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
            <StatBarValue className="text-2xl leading-8">{rank ? rankLabel(rank) : "Unranked"}</StatBarValue>
            <StatBarNote>{!rank ? "Play ranked games to get a rank" : next ? `Next: ${rankLabel(next)}` : "Top of the board"}</StatBarNote>
          </>
        )}
      </StatBarItem>

      <StatBarItem label="Play time">
        <div className="flex items-center gap-2">
          <HugeiconsIcon icon={ClockFadingIcon} strokeWidth={1.5} aria-hidden="true" className="size-8 shrink-0 text-muted-foreground" />
          <StatBarValue className="text-4xl leading-10 whitespace-nowrap">{timePlayed(secondsPlayed)}</StatBarValue>
        </div>
      </StatBarItem>

      <StatBarItem label="Last played">
        {last ? (
          <>
            <StatBarValue className="whitespace-nowrap">{last.day}</StatBarValue>
            <div className="flex items-center gap-2 whitespace-nowrap">
              {last.place && <span className="text-sm text-muted-foreground">{last.place}</span>}
              <Badge variant={RESULT_BADGE[last.result]}>{resultWord(last.result)}</Badge>
            </div>
          </>
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
