import Link from "next/link"
import { ArrowRight01Icon, Clock01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { AchievementBadge } from "@pbgo/ui/platform/achievement-tile"
import { Badge } from "@pbgo/ui/platform/badge"
import { Button } from "@pbgo/ui/platform/button"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@pbgo/ui/platform/hover-card"
import { Progress } from "@pbgo/ui/platform/progress"
import { RankEmblem } from "@pbgo/ui/platform/rank-emblem"
import { StatBar, StatBarItem, StatBarNote, StatBarValue } from "@pbgo/ui/platform/stat-bar"
import { nextRank, rankLabel } from "@pbgo/ui/ranks"
import { resultWord, timePlayed, type Result } from "@pbgo/ui/results"
import type { HistoryEntry, PlayerStats } from "@/lib/game-activity"
import { dayOf, lastGameOf } from "@/lib/game-activity-props"

// What the signed-in visitor has done in a game, as the first section under the head of its page and above the tables: one bar of four cells (`StatBar`), the rank in the spotlight. Their rank, first and widest (its emblem at 5rem, its name at 1.875rem, a dot and the points they have toward the next division over the ones it
// takes, "36/100", centred on the name, muted, at 1.25rem, and a thin bar under them), how long they have played, in hours, as big as their rank's name, with a light clock at its left and, under it, how many games they have played ("Played 24 games"), the achievements they have earned (each as the badge that `AchievementBadge` draws, with no name written, the latest first, `BADGES_SHOWN` at most and a "+n" for
// the rest; its name, what it was for and the day are in a card under the pointer and in words for a screen reader) and, last, "Last played": the day of their last game with its year, then where they came ("1st", at the left of the badge) and how it ended as a badge (green for a win, red for a loss, grey for a draw or a game left before its end), and under them a button to their history, which is the visitor's own page, `/me/games`, at its
// History section, with the game to filter by in `?game=`. A figure that is not known says so in words: "Unranked", "No game yet", "None yet" (and "0 h" for the time). The page gives the bar to a visitor who is signed in, in a game that is live: the figures of a visitor who is not signed in, and of a game that cannot be played, are
// nobody's. The emblem of a rank is a stand-in until the owner hands over the crests (`RankEmblem`). From `xl` the four cells are in one row, the play time's and the last played's as wide as what they hold and the rank's and the achievements' sharing the rest, the rank's the widest; under it they are two by two, and one over the other on a phone. The room is the same in every cell: 1.25rem above and under, a label
// on one line across the row, 0.75rem of air under it, then the figure, 0.5rem to 1rem before what is under it, so that the tallest cell, about 96px of text (the last played's), sets a bar 136px high.

/** How many of the earned achievements the bar draws, the latest first, each 4rem wide: three badges and the "+n" fit the cell at `xl`, where it is the narrowest of the row. */
const BADGES_SHOWN = 3

/** How a game ended, as a badge: a win is green, a loss red, and a draw or a game left before its end grey. */
const RESULT_BADGE: Record<Result, "success" | "destructive" | "secondary"> = { won: "success", lost: "destructive", draw: "secondary", abandoned: "secondary" }

export function GamePlayerBar({ slug, stats, latest }: { slug: string; stats: PlayerStats; latest: HistoryEntry | null }) {
  const { rank, rankProgress, secondsPlayed, gamesPlayed, achievements, achievementsTotal } = stats
  const next = rank ? nextRank(rank) : null
  const earned = [...achievements].sort((a, b) => b.earnedAt.localeCompare(a.earnedAt))
  const count = achievementsTotal > 0 ? `${earned.length}/${achievementsTotal}` : earned.length > 0 ? String(earned.length) : null
  const last = latest ? lastGameOf(latest) : null

  return (
    <StatBar aria-label="Your progress" className="sm:grid-cols-2 xl:grid-cols-[minmax(0,1.7fr)_auto_minmax(0,1.3fr)_auto]">
      <StatBarItem label="Rank" visual={<RankEmblem rank={rank} className="size-20 rounded-3xl text-4xl" />}>
        {rank && next && rankProgress && rankProgress.needed > 0 ? (
          <>
            <div className="flex items-center gap-2">
              <StatBarValue className="text-3xl leading-9">{rankLabel(rank)}</StatBarValue>
              <span aria-hidden="true" className="text-xl leading-7 text-muted-foreground/60">
                ·
              </span>
              <StatBarValue className="text-muted-foreground">
                {rankProgress.points}/{rankProgress.needed}
              </StatBarValue>
            </div>
            <Progress
              value={Math.min(100, Math.max(0, (rankProgress.points / rankProgress.needed) * 100))}
              aria-label="Rank rating"
              aria-valuetext={`${rankProgress.points} of ${rankProgress.needed}`}
              className="mt-2 h-1"
            />
          </>
        ) : (
          <>
            <StatBarValue className="text-3xl leading-9">{rank ? rankLabel(rank) : "Unranked"}</StatBarValue>
            <StatBarNote>{!rank ? "Play ranked games to get a rank" : next ? `Next: ${rankLabel(next)}` : "Top of the board"}</StatBarNote>
          </>
        )}
      </StatBarItem>

      <StatBarItem label="Play time" className="pr-10">
        <div className="flex items-center gap-2">
          <HugeiconsIcon icon={Clock01Icon} strokeWidth={1.5} aria-hidden="true" className="size-8 shrink-0 text-muted-foreground" />
          <StatBarValue className="text-3xl leading-9">{timePlayed(secondsPlayed)}</StatBarValue>
        </div>
        <StatBarNote>{gamesPlayed === 0 ? "No game yet" : `Played ${gamesPlayed} ${gamesPlayed === 1 ? "game" : "games"}`}</StatBarNote>
      </StatBarItem>

      <StatBarItem label={count === null ? "Achievements" : `Achievements · ${count}`}>
        {earned.length > 0 ? (
          <ul className="flex flex-wrap items-center gap-2">
            {earned.slice(0, BADGES_SHOWN).map(({ id, name, description, earnedAt }) => (
              <li key={id}>
                <HoverCard>
                  <HoverCardTrigger asChild>
                    <button type="button" className="block cursor-default rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/30">
                      <AchievementBadge seed={id} className="size-16" />
                      <span className="sr-only">
                        {name}: {description} Earned {dayOf(earnedAt)}.
                      </span>
                    </button>
                  </HoverCardTrigger>
                  <HoverCardContent className="w-64">
                    <p className="font-heading">{name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                    <p className="mt-3 text-xs text-muted-foreground">Earned {dayOf(earnedAt)}</p>
                  </HoverCardContent>
                </HoverCard>
              </li>
            ))}
            {earned.length > BADGES_SHOWN && (
              <li>
                <StatBarNote>+{earned.length - BADGES_SHOWN}</StatBarNote>
              </li>
            )}
          </ul>
        ) : (
          <StatBarValue>None yet</StatBarValue>
        )}
      </StatBarItem>

      <StatBarItem label="Last played" className="pr-10">
        {last ? (
          <>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <StatBarValue>{last.day}</StatBarValue>
              <div className="flex items-center gap-2">
                {last.place && <span className="text-sm text-muted-foreground">{last.place}</span>}
                <Badge variant={RESULT_BADGE[last.result]}>{resultWord(last.result)}</Badge>
              </div>
            </div>
            <Button variant="outline" size="sm" asChild className="self-start">
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
    </StatBar>
  )
}
