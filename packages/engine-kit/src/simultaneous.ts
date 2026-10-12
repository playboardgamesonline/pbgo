/**
 * Helpers for a simultaneous step: every player (or several of them) answers in any order and the step is resolved by the
 * last answer, inside the `apply` that receives it (secret bids, everybody reads their missions, simultaneous card choice…).
 *
 * Keep the submissions in the state as `Submissions<T>` and resolve the step in `apply` as soon as `allSubmitted()` is true.
 * `waitingFor` is `pendingSubmissions(...)`. A view tells WHO submitted (`submittedFlags`), never WHAT, until the step is resolved.
 */

/**
 * What each player submitted: `null` until they did. The keys are the player ids in seat order (build it with
 * `openSubmissions`), so the pending players come out in seat order. Ids must not be integer-like strings (JavaScript
 * orders those first); real ids are UUIDs.
 */
export type Submissions<T> = Record<string, T | null>

/** An empty step: nobody has submitted yet. `playerIds` in seat order. */
export function openSubmissions<T>(playerIds: readonly string[]): Submissions<T> {
  return Object.fromEntries(playerIds.map((id) => [id, null]))
}

/** Players who have not submitted yet, in seat order. */
export function pendingSubmissions<T>(submissions: Submissions<T>): string[] {
  return Object.keys(submissions).filter((id) => submissions[id] === null)
}

/** True when every player has submitted (a step without players counts as complete). */
export function allSubmitted<T>(submissions: Submissions<T>): boolean {
  return pendingSubmissions(submissions).length === 0
}

/** Who submitted, never the value: what a view may show before the step is resolved. */
export function submittedFlags<T>(submissions: Submissions<T>): Record<string, boolean> {
  return Object.fromEntries(Object.entries(submissions).map(([id, value]) => [id, value !== null]))
}
