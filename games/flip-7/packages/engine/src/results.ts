import { type PlayerResult, type Results, ranks, roundsOutcome } from "@pbgo/engine-kit"
import { playerAt, rulesOf, totalsOf } from "./machine"
import type { State } from "./types"

/**
 * The ranking of a finished game: the totals, best first. Players with the same total share a rank, in seat order. The winners are the
 * ones the rules name: the best total at or above the target (a tie for it was played off with one more round, so there is one).
 * Gives `null` while the game is on.
 */
export function results(s: State): Results | null {
  const totals = totalsOf(s)
  const outcome = roundsOutcome(totals, rulesOf(s))
  if (!outcome.over) return null
  const rank = ranks(totals, "high")
  const players: PlayerResult[] = s.seats
    .map((playerId, seat) => ({
      playerId,
      total: totals[seat]!,
      rank: rank[seat]!,
      detail: [
        { key: "rounds", label: "Manches jouées", points: s.rounds.length },
        { key: "bestRound", label: "Meilleure manche", points: Math.max(...s.rounds.map((scores) => scores[seat]!)) },
        { key: "flip7", label: "Flip 7 réussis", points: s.stats[seat]!.flip7 },
        { key: "busts", label: "Manches ratées", points: s.stats[seat]!.busts },
      ],
    }))
    // the sort is stable: a tie keeps the seat order
    .sort((a, b) => a.rank - b.rank)
  return { players, winners: outcome.winners.map((seat) => playerAt(s, seat)) }
}
