import { useId } from "react"
import type { Expansion, HistoryEntry, PlayerStats } from "@/lib/game-activity"
import { GameHistory } from "./game-history"
import { GameStats, GameStatsSignIn } from "./game-stats"

// What the signed-in visitor has done in a game, on its page, under the title "History & Stats": on the left their latest games (`GameHistory`, the first three and the rest behind a button) and on the right their stats in a column (`GameStats`: how many games they played, their win
// rate, their rank and their position, one to a row, then their achievements), side by side from `lg`, one under the other before. A visitor who is not signed in has nothing to show, so one prompt invites them to sign in in place of both (`stats` is null: `getPlayerStats` knows nobody).
// The head of the page has the first figures of the column in a strip beside its buttons.

export function GameHistoryStats({
  slug,
  name,
  stats,
  history,
  expansions,
}: {
  slug: string
  /** The game's name: a game of the history is called by it. */
  name: string
  stats: PlayerStats | null
  history: readonly HistoryEntry[]
  /** The expansions the game has, which a game of the history says it was played with. */
  expansions: readonly Expansion[]
}) {
  const headingId = useId()
  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className="mb-6 font-heading text-2xl">
        History & Stats
      </h2>
      {stats === null ? (
        <GameStatsSignIn slug={slug} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3 lg:items-start">
          <div className="lg:col-span-2">
            <GameHistory entries={history} name={name} expansions={expansions} />
          </div>
          <GameStats stats={stats} />
        </div>
      )}
    </section>
  )
}
