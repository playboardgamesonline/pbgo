import { useId } from "react"
import { Leaderboard } from "@pbgo/ui/platform/leaderboard"
import { LEADERBOARD_MIN_GAMES, LEADERBOARD_SIZE, type GameStandings } from "@/lib/game-activity"
import { leaderboardRow } from "@/lib/game-activity-props"

// The best players of a game, on its page: its leaderboard, which scrolls through the first hundred (`LEADERBOARD_SIZE`) in a card as tall as the stats beside it, the signed-in visitor's own row marked on it or after it and always in view, and an empty
// state while nobody is ranked (`getStandings`: no game is ranked yet, ratings come with the accounts).

export function GameLeaderboard({ standings, className }: { standings: GameStandings; className?: string }) {
  const headingId = useId()
  return (
    <section aria-labelledby={headingId} className={className}>
      <h2 id={headingId} className="mb-6 font-heading text-2xl">
        Leaderboard
      </h2>
      <Leaderboard
        rows={standings.top.map(leaderboardRow)}
        you={standings.viewer && leaderboardRow(standings.viewer)}
        size={LEADERBOARD_SIZE}
        className="max-h-176"
        emptyTitle="No ranked game yet"
        emptyDescription={`Ranked games decide the board, and a player is on it after ${LEADERBOARD_MIN_GAMES} of them.`}
      />
    </section>
  )
}
