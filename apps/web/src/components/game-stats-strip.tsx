import { Calendar03Icon, Clock01Icon, Medal01Icon, TrophyIcon } from "@hugeicons/core-free-icons"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@pbgo/ui/platform/dialog"
import { StatStrip } from "@pbgo/ui/platform/stat-strip"
import { rankLabel } from "@pbgo/ui/ranks"
import { timePlayed } from "@pbgo/ui/results"
import type { Expansion, HistoryEntry, PlayerStats } from "@/lib/game-activity"
import { dayOf } from "@/lib/game-activity-props"
import { GameHistory } from "./game-history"

// What the signed-in visitor has done in a game, in the head of its page, at the right of the rules: when they last played it (the day of their latest game), how long they have played, their rank and how many of the game's achievements they have earned, with a small bar that shows how far they are
// (`StatStrip`). A figure that is not known is a dash ("—": no game yet, no rank yet); the achievements are the count alone, with no bar, while the game's total is not known. The strip is one button, and what it opens is their latest games, ten at most, in a window (`GameHistory`: how each ended, the day, who they
// played with and what it scored; it has an empty state while they have none). The page gives it to a visitor who is signed in, in a game that is live: the figures of a visitor who is not signed in, and of a game that cannot be played, are nobody's.

export function GameStatsStrip({
  name,
  stats,
  history,
  expansions,
  className,
}: {
  /** The game's name: a game of the history is called by it. */
  name: string
  stats: PlayerStats
  /** Their latest games, the latest first. */
  history: readonly HistoryEntry[]
  /** The expansions the game has, which a game of the history says it was played with. */
  expansions: readonly Expansion[]
  className?: string
}) {
  const latest = history[0]
  const { achievements, achievementsTotal } = stats
  return (
    <Dialog>
      <DialogTrigger asChild>
        <StatStrip
          title="See your latest games"
          className={className}
          items={[
            { label: "Last played", icon: Calendar03Icon, value: latest ? dayOf(latest.finishedAt) : "—" },
            { label: "Play time", icon: Clock01Icon, value: timePlayed(stats.secondsPlayed) },
            { label: "Rank", icon: TrophyIcon, value: stats.rank ? rankLabel(stats.rank) : "—" },
            {
              label: "Achievements",
              icon: Medal01Icon,
              value: achievementsTotal > 0 ? `${achievements.length}/${achievementsTotal}` : String(achievements.length),
              progress: achievementsTotal > 0 ? (achievements.length / achievementsTotal) * 100 : undefined,
            },
          ]}
        />
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Your latest games</DialogTitle>
          <DialogDescription>The last ten games you played in {name}, the latest first.</DialogDescription>
        </DialogHeader>
        <div className="-mx-6 max-h-120 overflow-y-auto border-t">
          <GameHistory entries={history} name={name} expansions={expansions} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
