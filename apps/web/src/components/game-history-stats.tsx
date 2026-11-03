import { cn } from "@pbgo/ui/utils"
import type { Expansion, HistoryEntry, PlayerStats } from "@/lib/game-activity"
import { GameHistory } from "./game-history"
import { GameStats } from "./game-stats"

// What the signed-in visitor has done in a game, as a banner under the head of its page, in one card with no title: on the left their last three games (`GameHistory`), on the right their stats (`GameStats`: the four figures, two to a row, then the achievements), side by side from `lg`
// (three fifths and two fifths), one under the other before. A visitor who is not signed in has no banner (the head invites them to sign in) and nor has one who has neither a game nor an achievement: the head's strip says their figures.

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
    <section aria-label="Your latest games and your stats" className={cn("overflow-hidden rounded-3xl bg-card text-card-foreground shadow-surface ring-1 ring-foreground/10 lg:grid lg:grid-cols-5", className)}>
      <div className="lg:col-span-3">
        <GameHistory entries={history} name={name} expansions={expansions} />
      </div>
      <div className="border-t p-6 lg:col-span-2 lg:border-t-0 lg:border-l">
        <GameStats stats={stats} />
      </div>
    </section>
  )
}
