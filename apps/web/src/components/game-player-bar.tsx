import Link from "next/link"
import { ArrowRight01Icon, DicesIcon, HourglassIcon, MedalFirstPlaceIcon, UserMultipleIcon, ZapIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { AchievementsCard } from "@pbgo/ui/platform/achievements-card"
import { Badge } from "@pbgo/ui/platform/badge"
import { Button } from "@pbgo/ui/platform/button"
import { Metric } from "@pbgo/ui/platform/metric"
import { Progress } from "@pbgo/ui/platform/progress"
import { RankEmblem } from "@pbgo/ui/platform/rank-emblem"
import { StatBar, StatBarItem, StatBarLabel, StatBarNote, StatBarValue } from "@pbgo/ui/platform/stat-bar"
import { rankLabel } from "@pbgo/ui/ranks"
import { lengthOf, pointsLabel, pointsTone, winRate } from "@pbgo/ui/results"
import { cn } from "@pbgo/ui/utils"
import type { Expansion, HistoryEntry, PlayerStats } from "@/lib/game-activity"
import { dayOf, lastGameOf } from "@/lib/game-activity-props"

// What the signed-in visitor has done in a game, as the first section under the head of its page and above the tables: three cards a little apart (`StatBar`), in this order: the rank progress, the recent games and the achievements.
// Rank progress: its emblem (2.5rem: its crest where the owner has handed it over, Grandmaster's so far, and a stand-in where not, `RankEmblem`) at the left of its name (1.5rem, on one line whatever the room: the longest, "Grandmaster III", needs 174px), so that the label, the emblem and the thin bar under them share one left edge,
// then, under the bar, "Pts" in small capitals at its left and the points they have toward the next division over the ones it takes at its right ("36/100", muted, 0.875rem, 99 at the most since they move up at 100). The bar and that line are always there, whatever the rank: the bar is empty and the points say "—" where the progress is not known (an unranked visitor, a rank with no points) and the bar is full at Legend, which has nothing above it; no line says which rank is next. Under them, two smaller figures, each with a picto at its left (`Metric`): the games they played and their win
// rate (the games they won over the games they played, "58%", "—" before any game). Recent games: their latest games, the latest first (sorted here by the time they ended, as the achievements are, so that the three that are shown are the latest whatever order the page gives them), `RECENT_MAX` (three) of them, a row each, 4.25rem high, with a background under the pointer and a hairline between one row and the next (as wide as the content, in the 0.25rem between them): at its left the time it ended and the day with its year, in the same type (UTC) with a dot between them, and, at the right of the day, an hourglass and how long the game lasted, over the group icon and the number of players, the speed it was played at, a lightning icon and its word ("Slow", "Normal", "Fast", "No timer", "Async") whatever it was, and the expansions it was played with ("+" and their names, cut when they are long; on a list narrower than 21rem the length does not fit at the right of the day and goes after the players, and the expansions have a line of their own under them), at its right, stuck to the edge, where they came ("1st") and the rank points it
// gave or took as a badge in the same colours as a win and a loss were ("+32" in green, "−11" in red, "0" or "—" in grey), and, at the top right of the card, level with its label, a "See history" button to the visitor's own page, `/me/games`, at its History section, with the game to filter by in `?game=`. Achievements (`AchievementsCard`): the badges they have earned, the latest first, in at most two
// rows of three, with a "See all" button at the top right of the card, how many are earned over how many there are in brackets after the label ("Achievements (9/12)"), and, when there are more than six, "+5" for the sixth place, at the bottom right, over the first five; the button, that number and each badge open the list of all of them. A figure that is
// not known says so in words: "Unranked", "No game yet", "None yet" and "—" for a win rate. The page gives the cards to a visitor who is signed in, in a game that is live: the figures of a visitor who is not signed in, and of a game that cannot be played, are nobody's.
// From 80rem (1280px) of width the three cards are in one row and share its width, none of them taking what the window gives: the rank's and the achievements' one share each and the recent games' a share and a quarter, with 1rem between them, down to the least that each needs (the rank's 20rem: its name row needs 226px of room, its two figures 204px; the recent games' 22rem; the achievements' 21rem: its label with the count and its button need 283px, its three badges 236px), which is 344px, 431px and 344px at 1280px and 423px, 529px and 423px where the page stops growing (1536px);
// from `md` and under 80rem the rank's and the recent games' are side by side, half the width each, and the achievements' under them on the whole width, where its badges have the room to be in as many columns as fit; under `md` the three are one over the other. In each card the label is at its top and what it says at its foot, at least 1rem under it (`StatBarItem`: the labels stand on one line
// across the row and what each says ends on one line), with 1.5rem round them. The recent games' content is the tallest, three rows of 4.25rem (two lines of text 0.5rem apart with 0.75rem over and under them: `py-3`) with 0.25rem between them, less the 0.75rem under the last one: the list goes down into the card's padding by it (`-mb-3`), so that the box of the last game is as far from the bottom of the card as every row is from its sides (1.5rem of padding less the 0.75rem that a row goes out by, `-mx-3`: 0.75rem) and the text of the last game ends where what the other cards say does, 1.5rem from the bottom; the games are at the foot of their card, under the label. That is 200px, so the cards are 280px high; the achievements' two rows, 156px, and the rank's content, 142px (its emblem and name, the bar 0.75rem under them, 0.5rem between the bar and what it
// reads, then its two figures), end where it does.

/** How many of the latest games the recent card says: three rows of 4.25rem with 0.25rem between them, 212px (200px for the card: the list goes 0.75rem down into its padding). */
const RECENT_MAX = 3

/** How long a game lasted, small and quiet, with an hourglass at its left (the head's, which says how long a game takes): the hourglass is centred on the line and the figure stands on the baseline of the text around it. */
function Duration({ seconds, className }: { seconds: number; className?: string }) {
  return (
    <span className={cn("flex items-baseline gap-1 text-xs text-muted-foreground tabular-nums", className)}>
      <HugeiconsIcon icon={HourglassIcon} strokeWidth={2} className="size-3.5 shrink-0 self-center" aria-hidden="true" />
      <span>{lengthOf(seconds)}</span>
    </span>
  )
}

export function GamePlayerBar({ slug, stats, recent, expansions }: { slug: string; stats: PlayerStats; recent: readonly HistoryEntry[]; expansions: readonly Expansion[] }) {
  const { rank, rankProgress, gamesPlayed, wins, achievements, achievementsTotal } = stats
  // The bar is always drawn: where the progress is known it is the points over the 100 of a division; where it is not (an unranked visitor, a rank with no points) it is empty, and at Legend, which has nothing above it, it is full
  const progress = rankProgress && rankProgress.needed > 0 ? rankProgress : null
  const barValue = progress ? Math.min(100, Math.max(0, (progress.points / progress.needed) * 100)) : rank?.tier === "Legend" ? 100 : 0
  const earned = [...achievements].sort((a, b) => b.earnedAt.localeCompare(a.earnedAt))
  const latest = [...recent].sort((a, b) => b.finishedAt.localeCompare(a.finishedAt)).slice(0, RECENT_MAX)
  const rate = winRate(wins, gamesPlayed)

  return (
    <StatBar aria-label="Your progress" className="md:grid-cols-2 min-[80rem]:grid-cols-[minmax(20rem,1fr)_minmax(22rem,1.25fr)_minmax(21rem,1fr)]">
      <StatBarItem label="Rank progress">
        <div className="flex items-center gap-3">
          <RankEmblem rank={rank} className="size-10 text-xl" />
          <StatBarValue className="text-2xl leading-8 whitespace-nowrap">{rank ? rankLabel(rank) : "Unranked"}</StatBarValue>
        </div>
        <Progress
          value={barValue}
          aria-label="Rank points"
          aria-valuetext={progress ? `${progress.points} of ${progress.needed}` : rank?.tier === "Legend" ? "Top of the board" : "Not known"}
          className="mt-1 h-1"
        />
        <div className="flex items-center justify-between gap-3">
          <StatBarLabel>Pts</StatBarLabel>
          <StatBarNote className="text-sm leading-5 tabular-nums">{progress ? `${Math.min(progress.points, progress.needed - 1)}/${progress.needed}` : "—"}</StatBarNote>
        </div>
        <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-3">
          <Metric icon={DicesIcon} label="Games played" value={gamesPlayed} />
          <Metric icon={MedalFirstPlaceIcon} label="Win rate" value={rate === null ? "—" : `${rate}%`} />
        </dl>
      </StatBarItem>

      <StatBarItem
        label="Recent games"
        action={
          recent.length > 0 && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/me/games?game=${slug}#history`}>
                See history
                <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} data-icon="inline-end" aria-hidden="true" />
              </Link>
            </Button>
          )
        }
      >
        {recent.length > 0 ? (
          <ul aria-label="Your latest games" className="@container -mb-3 flex flex-col gap-1">
            {latest.map((entry, index) => {
              const game = lastGameOf(entry)
              const names = entry.expansions.flatMap((id) => expansions.find((expansion) => expansion.id === id)?.name ?? [])
              return (
                <li
                  key={entry.tableId}
                  className={cn(
                    "-mx-3 flex items-center justify-between gap-3 rounded-2xl px-3 py-3 whitespace-nowrap transition-colors duration-fast hover:bg-muted/50",
                    index > 0 && "relative before:absolute before:inset-x-3 before:-top-0.5 before:h-px before:bg-border"
                  )}
                >
                  <div className="flex min-w-0 flex-col gap-2">
                    <div className="flex items-baseline gap-3 text-sm leading-5">
                      <time dateTime={entry.finishedAt} className="flex items-baseline gap-2 font-heading tabular-nums">
                        <span>{game.time}</span>
                        <span aria-hidden="true" className="text-muted-foreground">·</span>
                        <span>{game.day}</span>
                      </time>
                      {entry.durationSeconds !== null && <Duration seconds={entry.durationSeconds} className="hidden @min-[21rem]:flex" />}
                    </div>
                    <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-xs leading-4 text-muted-foreground @min-[21rem]:flex-nowrap">
                      <span className="flex shrink-0 items-center gap-1">
                        <HugeiconsIcon icon={UserMultipleIcon} strokeWidth={2} className="size-3.5 shrink-0" aria-hidden="true" />
                        <span aria-hidden="true">{entry.playerCount}</span>
                        <span className="sr-only">{entry.playerCount === 1 ? "1 player" : `${entry.playerCount} players`}</span>
                      </span>
                      <span data-pace={game.pace.value} className="flex shrink-0 items-center gap-1">
                        <HugeiconsIcon icon={ZapIcon} strokeWidth={2} className="size-3.5 shrink-0" aria-hidden="true" />
                        <span>{game.pace.label}</span>
                      </span>
                      {entry.durationSeconds !== null && <Duration seconds={entry.durationSeconds} className="@min-[21rem]:hidden" />}
                      {names.length > 0 && (
                        <span className="max-w-full basis-full truncate @min-[21rem]:basis-auto" title={names.join(", ")}>
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
        className="md:col-span-2 min-[80rem]:col-span-1"
        achievements={earned.map(({ id, name, description, earnedAt }) => ({ id, name, description, date: dayOf(earnedAt) }))}
        total={achievementsTotal}
      />
    </StatBar>
  )
}
