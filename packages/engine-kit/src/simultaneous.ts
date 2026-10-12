/**
 * Helpers for a simultaneous step: every player (or several of them) answers in any order and the step is resolved by the
 * last answer, inside the `apply` that receives it (secret bids, everybody reads their missions, simultaneous card choice…).
 *
 * Keep the submissions in the state as `Submissions<T>` and resolve the step in `apply` as soon as `allSubmitted()` is true.
 * `waitingFor` is `pendingSubmissions(submissions, seats)`. A view tells WHO submitted (`submittedFlags`), never WHAT, until the
 * step is resolved.
 */

/**
 * What each player submitted: `null` until they did. A plain object keyed by player id, built with `openSubmissions`.
 * Never rely on the order of its keys: the state is stored as `jsonb`, which does not keep it. The seat order always comes from
 * the game's own list of players (see `pendingSubmissions`).
 */
export type Submissions<T> = Record<string, T | null>

/** An empty step: nobody has submitted yet. */
export function openSubmissions<T>(playerIds: readonly string[]): Submissions<T> {
  return Object.fromEntries(playerIds.map((id) => [id, null]))
}

/** Players who have not submitted yet, in the order of `playerIds` (all the players of the game, in seat order). */
export function pendingSubmissions<T>(submissions: Submissions<T>, playerIds: readonly string[]): string[] {
  return playerIds.filter((id) => submissions[id] === null)
}

/** True when every player has submitted (a step without players counts as complete). */
export function allSubmitted<T>(submissions: Submissions<T>): boolean {
  return Object.values(submissions).every((value) => value !== null)
}

/** Who submitted, never the value: what a view may show before the step is resolved. */
export function submittedFlags<T>(submissions: Submissions<T>): Record<string, boolean> {
  return Object.fromEntries(Object.entries(submissions).map(([id, value]) => [id, value !== null]))
}
