import { type AnyGameDefinition, deadlineOf, type LogEntry, settleDeadlines, waitingPlayers } from "@pbgo/engine-kit"
import type { GamePatch, GameRow } from "./games"

// The clock of a table. An engine has no clock: it says when it needs one (`nextDeadline`) and the server plays its action when the time has come. Nothing runs on a timer, so the first request that looks at a table whose deadline has passed
// plays it, as for the ready check: the read every board polls, the board's page, a move, a vote, and the `tick` that a board sends when its countdown ends. This file is the rules of it, pure and tested; `settle.ts` writes what it says.

type Table = Pick<GameRow, "status" | "state">

/** Whether a table has a deadline that is due at `now`: it is being played, its game has a clock, and the time has come. A table that is not being played has none, whatever its state says. */
export function deadlineDue(GAME: AnyGameDefinition, row: Table, now: number): boolean {
  if (row.status !== "playing" || row.state === null || row.state === undefined || !GAME.nextDeadline) return false
  const due = deadlineOf(GAME, row.state)
  return due !== null && due.at <= now
}

/** What the clock owes a state: the state after the deadlines that were due, what they said happened, who the game was waiting for each time one ran out (they were played for), and how many were played */
export type Due = { state: unknown; events: readonly LogEntry<unknown>[]; playedFor: string[]; applied: number }

/** Plays every deadline of `state` that is due at `now`, in order, each at the time it was due at (`settleDeadlines`). A state with none due comes back as it is. */
export function playDueDeadlines(GAME: AnyGameDefinition, state: unknown, now: number): Due {
  const playedFor: string[] = []
  const settled = settleDeadlines(GAME, state, now, undefined, (before) => {
    for (const id of waitingPlayers(GAME, before)) if (!playedFor.includes(id)) playedFor.push(id)
  })
  return { state: settled.state, events: settled.events, playedFor, applied: settled.applied }
}

/**
 * `playDueDeadlines` for a request that has something else to do: a deadline that the game refuses to play (its own bug) is said in the log of the server and left, so that the table can still be read and its players can still move, instead of every
 * request failing with it. The state comes back as it was, with nothing applied.
 */
export function playDueSafely(GAME: AnyGameDefinition, state: unknown, now: number): Due {
  try {
    return playDueDeadlines(GAME, state, now)
  } catch (error) {
    console.error("A deadline could not be played", { game: GAME.id }, error instanceof Error ? error.message : error)
    return { state, events: [], playedFor: [], applied: 0 }
  }
}

/** What playing the deadlines of a table that are due at `now` writes: the new state, whether the game is over, and the entries the deadlines add to the log. Null when none is due, which is also what a request that lost a race finds. `playedFor` is whom the clock played for. */
export function deadlinePatch(GAME: AnyGameDefinition, row: Table, now: number): { patch: GamePatch; playedFor: string[] } | null {
  if (!deadlineDue(GAME, row, now)) return null
  const due = playDueSafely(GAME, row.state, now)
  if (due.applied === 0) return null
  return { patch: { state: due.state, status: GAME.isOver(due.state) ? "over" : "playing", ...(due.events.length ? { log: { entries: due.events } } : {}) }, playedFor: due.playedFor }
}
