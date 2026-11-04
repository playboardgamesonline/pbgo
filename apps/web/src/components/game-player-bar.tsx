import Link from "next/link"
import { ArrowRight01Icon, Clock01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { AchievementStrip } from "@pbgo/ui/platform/achievement-strip"
import { Badge } from "@pbgo/ui/platform/badge"
import { Button } from "@pbgo/ui/platform/button"
import { Progress } from "@pbgo/ui/platform/progress"
import { RankEmblem } from "@pbgo/ui/platform/rank-emblem"
import { StatBar, StatBarItem, StatBarLabel, StatBarNote, StatBarValue } from "@pbgo/ui/platform/stat-bar"
import { nextRank, rankLabel } from "@pbgo/ui/ranks"
import { resultWord, timePlayed, type Result } from "@pbgo/ui/results"
import type { HistoryEntry, PlayerStats } from "@/lib/game-activity"
import { dayOf, lastGameOf } from "@/lib/game-activity-props"

// What the signed-in visitor has done in a game, as the first section under the head of its page and above the tables: one bar of four cells (`StatBar`), in this order.
// Rank: its emblem (4rem: its crest where the owner has handed it over, Grandmaster's so far, and a stand-in where not, `RankEmblem`), its name at 1.5rem, a thin bar under it and, under the bar, "Points" in small capitals at its left and the points they
// have toward the next division over the ones it takes at its right ("36/100", muted, 0.875rem, 99 at the most since they move up at 100). Last played: the day of their last game with its year, where they came ("1st") and how it ended as a badge (green for a win, red for a loss,
// grey for a draw or a game left before its end), all on one line (the cell holds the longest, "28 Sept 2026 12th Abandoned"), and under them a button to their history, which is the visitor's own page, `/me/games`, at its History section, with the game
// to filter by in `?game=`; the button stands 0.25rem out to the left of the text above it, so that its outline, which has rounded corners, lines up with it by eye. Achievements: the badges they have earned, the latest first, in one row
// of 4.75rem badges, as tall as the text of the cells beside it, that holds as many as fit (`AchievementStrip`): a tile that says how many are left ("+7") takes the last place when there are more, and a press on it or on a badge opens the list of all of them. The count of all of them is in the label; the name,
// what it was for and the day are in a card under the pointer, in the window and in words for a screen reader. Play time: in hours, as big as 1.875rem, with a
// light clock at its left and, under it, how many games they have played ("Played 24 games", at 0.875rem). A figure that is not known says so in words: "Unranked", "No game yet", "None yet" (and "0 h" for the time). The page gives the bar to a visitor
// who is signed in, in a game that is live: the figures of a visitor who is not signed in, and of a game that cannot be played, are nobody's.
// From 82.5rem (1320px) of width the four cells are in one row (in rem, like `sm`, so that the stylesheet puts the breakpoint after it): the rank's and the last played's 1.2fr, the achievements' 1.05fr (the three badges that the row holds need 236px) and the play time's 0.75fr (the least wide:
// its figure and its line need about 200px), so that the last played's line, up to about 245px, stays on one line, and so does the longest name of a rank. Under that width they are two by two, and one over the other on a phone. The room is the same in every
// cell: 1.5rem on every side, a label on one line across the row, 0.75rem of air under it, then the figure on a row 2rem high (the rank's name, the last played's date, the play time's hours), so that what is under the figure, the rank's bar, the
// History button and the play time's line, starts at the same height in the three cells, 0.75rem under the row (0.5rem between a bar and what it reads). The four cells have 104px of text and set a bar 152px high: the achievements' badges are as tall as what stands under the figure of the rank and of the last played, and the play
// time's line stands at the foot of its cell, on the line of the rank's points and of the foot of the History button, 0.75rem under its figure at the least.

/** How a game ended, as a badge: a win is green, a loss red, and a draw or a game left before its end grey. */
const RESULT_BADGE: Record<Result, "success" | "destructive" | "secondary"> = { won: "success", lost: "destructive", draw: "secondary", abandoned: "secondary" }

export function GamePlayerBar({ slug, stats, latest }: { slug: string; stats: PlayerStats; latest: HistoryEntry | null }) {
  const { rank, rankProgress, secondsPlayed, gamesPlayed, achievements, achievementsTotal } = stats
  const next = rank ? nextRank(rank) : null
  const earned = [...achievements].sort((a, b) => b.earnedAt.localeCompare(a.earnedAt))
  const count = achievementsTotal > 0 ? `${earned.length}/${achievementsTotal}` : earned.length > 0 ? String(earned.length) : null
  const last = latest ? lastGameOf(latest) : null

  return (
    <StatBar aria-label="Your progress" className="sm:grid-cols-2 min-[82.5rem]:grid-cols-[repeat(2,minmax(0,1.2fr))_minmax(0,1.05fr)_minmax(0,0.75fr)]">
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
              <StatBarLabel>Points</StatBarLabel>
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

      <StatBarItem label="Last played">
        {last ? (
          <>
            <div className="flex h-8 items-center gap-x-3 whitespace-nowrap">
              <StatBarValue>{last.day}</StatBarValue>
              <div className="flex items-center gap-2">
                {last.place && <span className="text-sm text-muted-foreground">{last.place}</span>}
                <Badge variant={RESULT_BADGE[last.result]}>{resultWord(last.result)}</Badge>
              </div>
            </div>
            <Button variant="outline" size="sm" asChild className="-ml-1 mt-1 self-start">
              <Link href={`/me/games?game=${slug}#history`}>
                History
                <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} data-icon="inline-end" aria-hidden="true" />
              </Link>
            </Button>
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

      <StatBarItem label="Play time">
        <div className="flex items-center gap-2">
          <HugeiconsIcon icon={Clock01Icon} strokeWidth={1.5} aria-hidden="true" className="size-8 shrink-0 text-muted-foreground" />
          <StatBarValue className="text-3xl leading-8 whitespace-nowrap">{timePlayed(secondsPlayed)}</StatBarValue>
        </div>
        <StatBarNote className="mt-auto pt-1 text-sm leading-5">{gamesPlayed === 0 ? "No game yet" : `Played ${gamesPlayed} ${gamesPlayed === 1 ? "game" : "games"}`}</StatBarNote>
      </StatBarItem>
    </StatBar>
  )
}
