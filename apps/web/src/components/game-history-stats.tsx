import { Clock01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@pbgo/ui/platform/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@pbgo/ui/platform/dialog"
import { cn } from "@pbgo/ui/utils"
import type { Expansion, HistoryEntry, PlayerStats } from "@/lib/game-activity"
import { GameHistory } from "./game-history"
import { GameStats } from "./game-stats"

// What the signed-in visitor has done in a game, as a thin banner under the head of its page, in one card with no title: their stats in one line (`GameStats`: how many games they played, their win rate, their rank, their position and their achievements, two figures to a row on a narrow screen)
// and, at its end, one button, "See history", which opens their latest games in a window (`GameHistory`, ten at most; the button cannot be pressed when there is none). A visitor who is not signed in has no banner, and nor has one who has neither a game nor an achievement.

export function GameHistoryStats({
  name,
  stats,
  history,
  expansions,
  className,
}: {
  /** The game's name: a game of the history is called by it. */
  name: string
  stats: PlayerStats | null
  history: readonly HistoryEntry[]
  /** The expansions the game has, which a game of the history says it was played with. */
  expansions: readonly Expansion[]
  className?: string
}) {
  if (stats === null || (history.length === 0 && stats.achievements.length === 0)) return null
  return (
    <section aria-label="Your stats" className={cn("flex flex-wrap items-center justify-between gap-x-8 gap-y-4 rounded-xl bg-card px-5 py-3 text-card-foreground shadow-surface ring-1 ring-foreground/10", className)}>
      <GameStats stats={stats} className="min-w-0 max-lg:w-full lg:flex-1" />
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="secondary" disabled={history.length === 0} className="max-lg:w-full">
            <HugeiconsIcon icon={Clock01Icon} strokeWidth={2} data-icon="inline-start" aria-hidden="true" />
            See history
          </Button>
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
    </section>
  )
}
