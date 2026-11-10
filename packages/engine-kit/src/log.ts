import type { GameDefinition, PlayerAction, SetupArgs } from "./contract"
import { EngineError } from "./errors"
import { playFor, type TurnHooks, waitingPlayers } from "./turns"

/**
 * A game's log with who may read what. Some things that happen are private: the card a Priest shows, the three cards a player
 * looks at with See the Future. The others know *that* it happened, not what it was.
 *
 * An entry holds the event twice at most: the whole of it for the players it concerns, and a `masked` version for everybody
 * else. The log is never part of the state (lean state, PLT-45: the platform keeps what happened, the state only what the next
 * move needs), so these functions only filter; they work on entries wherever they are kept: the platform keeps them (`game_log`), and a game gives them with `step` (`Step`).
 */

/**
 * One thing that happened. `event` and `masked` are plain data (ids and numbers, never display text): the client turns them into
 * sentences in the viewer's language.
 */
export type LogEntry<E> = {
  /** What happened, in full. */
  event: E
  /** The players who see `event` in full; absent: everybody, spectators included. */
  to?: readonly string[]
  /** What everyone else sees instead (`{ kind: "peek", seat: 2 }` for `{ kind: "peek", seat: 2, cards: [4, 9, 12] }`); absent: nothing. */
  masked?: E
}

/**
 * What a move gives back when the game says what happened (`GameDefinition.step`, `autoPlayStep`): the state after it and the entries it adds to the log, oldest first. `events` are this move's only. The platform
 * keeps them, one move after the other, in the log of the table (`game_log`), and sends each player what `viewLog` lets them read.
 */
export type Step<State, E> = { state: State; events: readonly LogEntry<E>[] }

/**
 * The log as `viewerId` reads it, oldest first: the full event when it is public or addressed to them, else its `masked` version,
 * else nothing. `null` is a spectator: they only see public and masked events.
 */
export function viewLog<E>(entries: readonly LogEntry<E>[], viewerId: string | null): E[] {
  const seen: E[] = []
  for (const entry of entries) {
    if (entry.to === undefined || (viewerId !== null && entry.to.includes(viewerId))) seen.push(entry.event)
    else if (entry.masked !== undefined) seen.push(entry.masked)
  }
  return seen
}

/** The part of a definition that plays an action: `apply`, and the `step` that also says what happened. */
export type StepHooks<State, Action extends PlayerAction = PlayerAction, E = unknown> = Pick<GameDefinition<State, Action, unknown, unknown, E>, "apply" | "step">

/**
 * Plays an action and says what happened: the game's `step` when it has one, else `apply` with nothing to log. The server plays every action through it, so that a game that says what happens is kept in the log
 * without the route knowing which game it is. A refusal is the `EngineError` that `apply` and `step` throw.
 */
export function stepOf<State, Action extends PlayerAction, E = unknown>(game: StepHooks<State, Action, E>, state: State, action: Action): Step<State, E> {
  if (game.step) return game.step(state, action)
  return { state: game.apply(state, action), events: [] }
}

/**
 * `playFor` that also says what happened: the game's `autoPlayStep` when it has one, else `playFor` with nothing to log. The same refusals: `NOT_WAITING` for a player the game does not wait for, `AUTOPLAY_UNSUPPORTED`
 * when it has no way to play for them.
 */
export function playStepFor<State, E = unknown>(game: TurnHooks<State> & Pick<GameDefinition<State, PlayerAction, unknown, unknown, E>, "autoPlayStep">, state: State, playerId: string, at?: number): Step<State, E> {
  if (!game.autoPlayStep) return { state: playFor(game, state, playerId, at), events: [] }
  if (!waitingPlayers(game, state).includes(playerId)) throw new EngineError("NOT_WAITING")
  return game.autoPlayStep(state, playerId, at)
}

/** Sets a game up and says what happened while it was: the game's `setupStep` when it has one, else `setup` with nothing to log. A table it cannot play is refused with the `EngineError` of `setup`. */
export function setupOf<State, SetupData, E = unknown>(game: Pick<GameDefinition<State, PlayerAction, unknown, SetupData, E>, "setup" | "setupStep">, args: SetupArgs<SetupData>): Step<State, E> {
  if (game.setupStep) return game.setupStep(args)
  return { state: game.setup(args), events: [] }
}
