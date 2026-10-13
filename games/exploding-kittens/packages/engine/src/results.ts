import type { PlayerResult, Results } from "@pbgo/engine-kit"
import type { State } from "./types"

/**
 * The ranking of a finished game: the last player in is first, then the others in the opposite order they left (the last one
 * out is second…). No ties. `total` is the number of opponents a player outlasted: n−1 for the winner, 0 for the first one out.
 * Gives `null` while the game is on.
 */
export function results(s: State): Results | null {
  if (s.phase.kind !== "over") return null
  const winner = s.seats.find((id) => !s.out.includes(id))
  if (winner === undefined) throw new RangeError("A finished game has a winner")
  const players: PlayerResult[] = [winner, ...[...s.out].reverse()].map((playerId, index) => {
    const outlasted = playerId === winner ? s.out.length : s.out.indexOf(playerId)
    const stats = s.stats[s.seats.indexOf(playerId)]!
    return {
      playerId,
      total: outlasted,
      rank: index + 1,
      detail: [
        { key: "outlasted", label: "Adversaires dépassés", points: outlasted },
        { key: "turnsSurvived", label: "Tours joués", points: stats.turns },
        { key: "kittensDefused", label: "Chatons désamorcés", points: stats.defused },
        { key: "nopesPlayed", label: "Nopes joués", points: stats.nopes },
      ],
    }
  })
  return { players, winners: [winner] }
}
