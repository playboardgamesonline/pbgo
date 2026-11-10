import type { Deadline, GameDefinition, PlayerAction } from "./contract"
import { type LogEntry, type StepHooks, stepOf } from "./log"

/**
 * Time. An engine has no clock: it never asks for the time, so the same seed and the same actions at the same times replay the same game. The server tells it the time instead: every action carries the time it was played at (`PlayerAction.at`),
 * and a game that is timed says in `nextDeadline` when it needs the clock next and what to play then, a system action. The server plays it when the time has come, on the first request that looks at the table (`settleDeadlines`), and puts the
 * time at which it was due on the action, not the time it was played, so the game is the same whenever the server got to it.
 *
 * What the state keeps of a clock is a `Timer`, two numbers, and what a view gives the board is the time that is left.
 */

/** The `playerId` of a system action: the clock is nobody at the table, so no seat is called this and no client may send an action that carries it */
export const SYSTEM_PLAYER = "system"

/** A system action of type `type` played at the time `at`: what an engine builds in `nextDeadline` for the clock to play. Its type is no entry of `clientActions` */
export function systemAction<Type extends string>(type: Type, at: number): { type: Type; playerId: typeof SYSTEM_PLAYER; at: number } {
  return { type, playerId: SYSTEM_PLAYER, at }
}

/** Whether an action is the clock's: what an engine checks to let a system action through the checks that a player's action must meet */
export const isSystemAction = (action: Pick<PlayerAction, "playerId">): boolean => action.playerId === SYSTEM_PLAYER

/** The game as it is once it goes live at `at` (`GameDefinition.begin`): the state with the clock of its first step started, or the state itself for a game that has none. The server calls it when a table begins to be played, never before */
export function beginOf<State>(game: Pick<GameDefinition<State, PlayerAction, unknown, unknown, unknown>, "begin">, state: State, at: number): State {
  return game.begin ? game.begin(state, at) : state
}

/** The part of a definition that the helpers below read */
export type DeadlineHooks<State, Action extends PlayerAction = PlayerAction> = Pick<GameDefinition<State, Action, unknown, unknown, unknown>, "isOver" | "nextDeadline">

/**
 * The deadline the game has now, or null: the game has no clock, it is over, or what it says is not a deadline (a time that is not a finite number, an action that is not a system action). The server reads it through this, never from the
 * definition.
 */
export function deadlineOf<State, Action extends PlayerAction>(game: DeadlineHooks<State, Action>, state: State): Deadline<Action> | null {
  if (!game.nextDeadline || game.isOver(state)) return null
  const next = game.nextDeadline(state)
  if (!next || typeof next.at !== "number" || !Number.isFinite(next.at) || !next.action || !isSystemAction(next.action)) return null
  return next
}

/** How long until the deadline, in whole milliseconds counted from `now` and never below 0 (a deadline that has passed is 0), or null when the game has none: what a table tells its players, as a duration, so a clock that is off does not matter */
export function deadlineIn<State, Action extends PlayerAction>(game: DeadlineHooks<State, Action>, state: State, now: number): number | null {
  const next = deadlineOf(game, state)
  return next ? Math.max(0, Math.ceil(next.at - now)) : null
}

/** The most deadlines one call plays: a table that nobody looked at for a long while catches up over a few calls */
export const MAX_DEADLINES = 100

/** What `settleDeadlines` did: the state after the deadlines it played, the entries they add to the log in order, and how many it played */
export type Settled<State, E = unknown> = { state: State; events: readonly LogEntry<E>[]; applied: number }

/**
 * Plays the deadlines that are due at `now`, one after the other: the game's deadline, the state after it, and its next deadline if that is due too, up to `maxSteps`. Each action is played with the time of its deadline as its `at`, so
 * the steps that follow start their clocks from the time they would have started at, whenever this is called, and the same table settled at two moments gives the same game. A game with no clock, or none due, comes back as it is with nothing
 * applied. `before` is asked, with the state, ahead of each deadline that is played: it is how the server learns who the game was waiting for when the clock ran out. A refusal is the `EngineError` that the game throws.
 */
export function settleDeadlines<State, Action extends PlayerAction, E = unknown>(
  game: DeadlineHooks<State, Action> & StepHooks<State, Action, E>,
  state: State,
  now: number,
  maxSteps = MAX_DEADLINES,
  before?: (state: State, deadline: Deadline<Action>) => void,
): Settled<State, E> {
  let current = state
  const events: LogEntry<E>[] = []
  let applied = 0
  while (applied < maxSteps) {
    const due = deadlineOf(game, current)
    if (!due || due.at > now) break
    before?.(current, due)
    const step = stepOf(game, current, { ...due.action, at: due.at })
    current = step.state
    events.push(...step.events)
    applied++
  }
  return { state: current, events, applied }
}
