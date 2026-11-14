import { type PlayerResult, type Results, ranks, roundsOutcome } from "@pbgo/engine-kit"
import { playerAt, rulesOf, totalsOf } from "./machine"
import type { State } from "./types"

/**
 * The ranking of a finished game: the totals, lowest first (the lowest wins). Players with the same total share a rank, in seat order.
 * The winners are the ones the rules name: the lowest total once a player has reached the target; a tie for it is shared.
 * Gives `null` while the game is on.
 */
export function results(s: State): Results | null {
  const totals = totalsOf(s)
  const outcome = roundsOutcome(totals, rulesOf())
  if (!outcome.over) return null
  const rank = ranks(totals, "low")
  const players: PlayerResult[] = s.seats
    .map((playerId, seat) => ({
      playerId,
      total: totals[seat]!,
      rank: rank[seat]!,
      // The words of each line are `score.<key>` in the game's Sanity; `scoreLines` of the definition lists the keys
      detail: [
        { key: "rounds", points: s.rounds.length },
        { key: "bestRound", points: Math.min(...s.rounds.map((scores) => scores[seat]!)) },
        { key: "columns", points: s.stats[seat]!.columns },
        { key: "ended", points: s.stats[seat]!.ended },
        { key: "doubled", points: s.stats[seat]!.doubled },
      ],
    }))
    // the sort is stable: a tie keeps the seat order
    .sort((a, b) => a.rank - b.rank)
  return { players, winners: outcome.winners.map((seat) => playerAt(s, seat)) }
}
