import type { GameDefinition, PlayerAction } from "./contract"
import { EngineError } from "./errors"

/**
 * Who has to play: the part of a game definition that the helpers below read. Everything that needs to know whose turn it is
 * (the server, the takeover, the previews, tests) goes through these helpers instead of calling the hooks of the definition,
 * so engines written for the previous contract (`activePlayer` / `autoPlay` only) keep working.
 */
export type TurnHooks<State> = Pick<
  GameDefinition<State, PlayerAction, unknown, unknown>,
  "isOver" | "waitingFor" | "activePlayer" | "autoPlayFor" | "autoPlay" | "debug"
>

/**
 * Players the server is waiting for, in seat order, without duplicates.
 * `waitingFor` when the game has it, else the active player (legacy `activePlayer`); nobody once the game is over.
 */
export function waitingPlayers<State>(game: TurnHooks<State>, state: State): string[] {
  if (game.isOver(state)) return []
  const ids = game.waitingFor ? game.waitingFor(state) : [game.activePlayer?.(state)]
  const waiting: string[] = []
  for (const id of ids) if (typeof id === "string" && !waiting.includes(id)) waiting.push(id)
  return waiting
}

/**
 * The player whose turn it is, for the games that have one: the legacy `activePlayer` when defined, else the first waiting
 * player. `null` when nobody is waiting (game over, or the engine is waiting itself).
 */
export function currentPlayer<State>(game: TurnHooks<State>, state: State): string | null {
  if (game.isOver(state)) return null
  if (game.activePlayer) return game.activePlayer(state) ?? null
  return waitingPlayers(game, state)[0] ?? null
}

/** True when the server can play for an absent player of this game: it knows who waits and has a way to play for them. */
export function canPlayFor<State>(game: TurnHooks<State>): boolean {
  const knowsWhoWaits = !!game.waitingFor || !!game.activePlayer
  return knowsWhoWaits && !!(game.autoPlayFor || game.autoPlay || game.debug?.turn)
}

/**
 * Plays the current step for one waiting player, with the game's `autoPlayFor`. An engine that only has the legacy
 * `autoPlay` (or `debug.turn`) can do it when that player is the only one waiting. `at` is the time of the play when it is known (see `PlayerAction.at`).
 * - `NOT_WAITING`: the player is not waiting for anyone to play for them (the state moved on, or they never were).
 * - `AUTOPLAY_UNSUPPORTED`: the game has no way to play for that player.
 */
export function playFor<State>(game: TurnHooks<State>, state: State, playerId: string, at?: number): State {
  const waiting = waitingPlayers(game, state)
  if (!waiting.includes(playerId)) throw new EngineError("NOT_WAITING")
  if (game.autoPlayFor) return game.autoPlayFor(state, playerId, at)
  const legacy = game.autoPlay ?? game.debug?.turn
  if (legacy && waiting.length === 1) return legacy(state)
  throw new EngineError("AUTOPLAY_UNSUPPORTED")
}

/**
 * Plays for the first waiting player again and again until the game is over, nobody is waiting, or `maxSteps` plays were made.
 * For tests, simulations and previews.
 */
export function playOn<State>(game: TurnHooks<State>, state: State, maxSteps = 1000): State {
  return playUntil(game, state, () => false, maxSteps)
}

/**
 * `playOn` that also stops when `stop` says so: it is asked before each play, with the state the game is in and how many plays were made (0 on the state it starts from), so a state that already satisfies it is
 * returned as it is. To reach a situation without playing up to it by hand: the end of a round, the turn of a given player, half the game. For tests, simulations and the debug tools.
 */
export function playUntil<State>(game: TurnHooks<State>, state: State, stop: (state: State, plays: number) => boolean, maxSteps = 1000): State {
  let current = state
  for (let plays = 0; plays < maxSteps; plays++) {
    if (stop(current, plays)) break
    const [next] = waitingPlayers(game, current)
    if (next === undefined) break
    current = playFor(game, current, next)
  }
  return current
}

/**
 * How far the game has come, from 0 to 100, as a whole number: the game's `progress`, never more than 99 while the game is not over and 100 once it is. `null` when the game does not say, or says something that is not a number.
 * Core and the HUD read it through this, never from the definition.
 */
export function progressOf<State>(game: Pick<GameDefinition<State, PlayerAction, unknown, unknown, unknown>, "isOver" | "progress">, state: State): number | null {
  if (!game.progress) return null
  if (game.isOver(state)) return 100
  const said = game.progress(state)
  return typeof said === "number" && Number.isFinite(said) ? Math.min(99, Math.max(0, Math.round(said))) : null
}
