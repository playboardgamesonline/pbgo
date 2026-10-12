/**
 * Scores over several rounds: the game goes on until somebody reaches a target, then the highest total wins (Flip 7: 200, Love
 * Letter's tokens) or the lowest (Skyjo: 100, 6 nimmt: 66 — there the points are penalties). Totals are arrays in seat order:
 * `totals[seat]` is the total of the seat-th player, so the order never depends on the keys of a stored object.
 */

export type RoundsRule = {
  /** The game ends after the first round that leaves somebody at this total or above (above it, whoever wins). */
  target: number
  /** Who wins when it ends: the highest total (`"high"`) or the lowest (`"low"`). */
  wins: "high" | "low"
  /** When several players share the best total: all of them win (`"shared"`), or one more round is played (`"playOn"`). */
  tie: "shared" | "playOn"
}

function sameSeats(totals: readonly number[], scores: readonly number[]): void {
  if (totals.length !== scores.length) {
    throw new RangeError(`There are ${totals.length} seats but ${scores.length} scores`)
  }
}

/** Adds the scores of a round (one per seat) to the totals so far. */
export function addScores(totals: readonly number[], scores: readonly number[]): number[] {
  sameSeats(totals, scores)
  return totals.map((total, seat) => total + (scores[seat] as number))
}

/**
 * The totals of `seats` players from the scores of each round (`rounds[round][seat]`). A game that stores the round-by-round
 * scores, which the results table shows, derives its totals with this instead of storing them as well.
 */
export function sumRounds(rounds: readonly (readonly number[])[], seats: number): number[] {
  if (!Number.isInteger(seats) || seats < 0) throw new RangeError(`The number of seats is a non-negative integer, got ${String(seats)}`)
  return rounds.reduce<number[]>((totals, scores) => addScores(totals, scores), Array.from({ length: seats }, () => 0))
}

/** The seats that hold the best total, in seat order (all of them when they are tied; none when there is no seat). */
export function leaders(totals: readonly number[], wins: RoundsRule["wins"]): number[] {
  const best = wins === "high" ? Math.max(...totals) : Math.min(...totals)
  return totals.flatMap((total, seat) => (total === best ? [seat] : []))
}

/** The rank of each seat, from 1: players with the same total share a rank and the next one is skipped (1, 2, 2, 4). */
export function ranks(totals: readonly number[], wins: RoundsRule["wins"]): number[] {
  return totals.map((total) => 1 + totals.filter((other) => (wins === "high" ? other > total : other < total)).length)
}

/**
 * Whether the game is over after a round, and who wins (seats in seat order). Over once some total has reached the target; a tie
 * for the best total ends it with every tied player winning (`"shared"`) or does not end it (`"playOn"`: the game goes on until
 * the tie is broken).
 */
export function roundsOutcome(totals: readonly number[], rule: RoundsRule): { over: false } | { over: true; winners: number[] } {
  if (!totals.some((total) => total >= rule.target)) return { over: false }
  const winners = leaders(totals, rule.wins)
  if (winners.length > 1 && rule.tie === "playOn") return { over: false }
  return { over: true, winners }
}
