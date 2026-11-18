import type { PlayerResult, Results } from "@pbgo/engine-kit"
import { isOver, tokensOf, winnersOf } from "./machine"
import type { State } from "./types"

/**
 * The result of a finished game: every player who holds enough favor tokens wins and shares the win, whatever their count above it, and every other player
 * loses (rulebook, p. 7; the reading validated for several players reaching the number together). The booklet gives no places, so the winners have rank 1 and
 * every other player shares the rank that follows them (1, 2, 2 for one winner at three players). `total` is the favor tokens of the player.
 * Gives `null` while the game is on.
 */
export function results(s: State): Results | null {
  if (!isOver(s)) return null
  const winners = winnersOf(s)
  const tokens = tokensOf(s)
  const players: PlayerResult[] = s.seats
    .map((playerId, seat) => ({
      playerId,
      total: tokens[seat] ?? 0,
      rank: winners.includes(playerId) ? 1 : 1 + winners.length,
      // The words of each line are `score.<key>` in the game's Sanity; `scoreLines` of the definition lists the keys
      detail: [
        { key: "rounds", points: s.round },
        { key: "won", points: s.won[seat] ?? 0 },
        { key: "spy", points: s.spies[seat] ?? 0 },
      ],
    }))
    // the winners first, then the others, each group with the most tokens first; the sort is stable: a tie keeps the seat order
    .sort((a, b) => a.rank - b.rank || b.total - a.total)
  return { players, winners }
}
