import type { OptionDefinitions, OptionPreset, OptionValues } from "./options"

export type PlayerInfo = { id: string; nickname: string }

export type PlayerAction = { type: string; playerId: string }

export type PlayerResult = {
  playerId: string
  total: number
  rank: number
  detail: { key: string; label: string; points: number }[]
}

export type Results = { players: PlayerResult[]; winners: string[] }

/**
 * `SetupData`: data loaded on the server before the game starts (e.g. missions from Sanity).
 * The game's server binding provides it through `loadSetupData`; without one it is `undefined`.
 */
export type GameDefinition<State, Action extends PlayerAction, View, SetupData = undefined> = {
  id: string
  name: string
  minPlayers: number
  maxPlayers: number
  options: OptionDefinitions
  /** Option combinations offered in one click in the lobby (optional). */
  presets?: OptionPreset[]
  clientActions: readonly Action["type"][]
  /**
   * `seed`: an integer below 2^52 drawn by the server for each game; the same seed and the same actions
   * replay the same game. Optional for backwards compatibility: without one, the game draws its own.
   */
  setup: (args: { players: PlayerInfo[]; options: OptionValues; seed?: number; data?: SetupData }) => State
  apply: (state: State, action: Action) => State
  view: (state: State, playerId: string | null) => View
  isOver: (state: State) => boolean
  debug?: Partial<Record<DebugCommand, (state: State) => State>>
  /**
   * Players the server is waiting for right now, in seat order, without duplicates. One player on a classic turn, several
   * on a simultaneous step (secret bids, everybody reads their missions…). Empty: nobody, either because the game is over
   * or because the engine itself is waiting (e.g. for a deadline).
   *
   * PUBLIC: shown to every player and spectator, so it must never reveal hidden information. Do not drop a player from it
   * when that would tell something (e.g. a player who may still respond to an action stays listed until the window closes).
   *
   * Not implemented: derived from `activePlayer` (one player, or nobody).
   * Read it through `waitingPlayers()` / `currentPlayer()`, never directly.
   */
  waitingFor?: (state: State) => readonly string[]
  /**
   * Plays for one waiting player (absent, or timed out). It must:
   * - always produce a legal state;
   * - be deterministic: seeded side streams only, never `Math.random` or `Date.now`, so that a replay stays exact;
   * - complete that player's current step: afterwards `playerId` is no longer waiting for it (the player may be waiting again
   *   for a NEW step, e.g. their next turn);
   * - throw `EngineError("NOT_WAITING")` when `playerId` is not in `waitingFor(state)`.
   *
   * Not implemented: `autoPlay`, else `debug.turn`, and only when `playerId` is the single waiting player.
   * Call it through `playFor()`, never directly.
   */
  autoPlayFor?: (state: State, playerId: string) => State
  /**
   * @deprecated Engine contract v2: implement `waitingFor` and `autoPlayFor`.
   * Plays the active player's turn for them. Default: `debug.turn`. Read through `playFor()`.
   */
  autoPlay?: (state: State) => State
  /**
   * @deprecated Engine contract v2: implement `waitingFor`.
   * Id of the player who must play (null if nobody). Read through `currentPlayer()` / `waitingPlayers()`.
   */
  activePlayer?: (state: State) => string | null
}

/**
 * A game of any shape: what the code that serves every game (core, the registry) holds, since it never knows the game's
 * state, action, view or setup data types.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyGameDefinition = GameDefinition<any, any, any, any>

/** Debug commands: `turn` (automatic turn) and `over` (play to the end) are shared; a game can add its own (e.g. `missions`). */
export type DebugCommand = "turn" | "over" | (string & {})
