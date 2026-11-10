import type { Step } from "./log"
import type { OptionDefinitions, OptionPreset, OptionValues } from "./options"

export type PlayerInfo = { id: string; nickname: string }

/** What `setup` is given: the table, the options, the seed of the game and the data the server loaded for it. */
export type SetupArgs<SetupData = undefined> = { players: PlayerInfo[]; options: OptionValues; seed?: number; data?: SetupData }

export type PlayerAction = {
  type: string
  playerId: string
  /**
   * When the server played this action, in milliseconds since the epoch on its clock. The server writes it on every action it plays, whatever the client sent, and an engine that needs the time (the clock of a step, a window that restarts) reads it
   * here and nowhere else: it never asks a clock, so the same seed and the same actions at the same times replay the same game. Absent when nobody gave one (a test).
   */
  at?: number
}

/**
 * What an engine asks of the clock: play `action` once `at` has passed, `at` being in milliseconds since the epoch on the server's clock. The action is a system action, one that `playerId` `SYSTEM_PLAYER` carries and no client may send (its
 * type is not in `clientActions`); it is played at the time of the deadline, whenever the server gets to it (`settleDeadlines`).
 */
export type Deadline<Action extends PlayerAction = PlayerAction> = { at: number; action: Action }

export type PlayerResult = {
  playerId: string
  total: number
  rank: number
  /**
   * The lines of the score: `key` says which (`scoreLabelKey` gives the text of the game's Sanity), `values` fills the variables of that text (`Round {n}`), `points` is the line's value.
   * `label` is the words the engine still carries, shown as written while a game has not moved them to Sanity.
   */
  detail: { key: string; /** @deprecated The words of a line are a text of the game, in its Sanity. */ label?: string; values?: Record<string, string | number>; points: number }[]
}

export type Results = {
  players: PlayerResult[]
  /** The ids of the players who won: several on a tie, every player when the table won together and nobody when it lost together (`coop`). */
  winners: string[]
  /**
   * Set by a game the whole table plays on one side, against the game itself (Hanabi, Sky Team, The Mind): `"won"` or `"lost"`, for every player at once. Every player then has rank 1 and the
   * table's score as `total`, and `winners` lists every player when the table won and nobody when it lost. A game where the players play against each other leaves it out.
   */
  coop?: "won" | "lost"
}

/**
 * What a player has so far, for the list of the players that the HUD keeps in view while the game runs. The public view carries it for every viewer, like `results`: one entry per seat, in
 * seat order. `score` is the number the game counts (points, tokens of affection, lives…); the words that name it are a text of the game, in its Sanity.
 */
export type Standing = { playerId: string; score: number }

/**
 * `SetupData`: data loaded on the server before the game starts (e.g. missions from Sanity).
 * The game's server binding provides it through `loadSetupData`; without one it is `undefined`.
 *
 * `Event`: what the game says happened, when it says it (`step`): plain data, ids and numbers, that the client turns into sentences and animations. A game that says nothing leaves it out.
 */
export type GameDefinition<State, Action extends PlayerAction, View, SetupData = undefined, Event = never> = {
  id: string
  name: string
  minPlayers: number
  maxPlayers: number
  options: OptionDefinitions
  /** Option combinations offered in one click in the lobby (optional). */
  presets?: OptionPreset[]
  /**
   * The keys of the lines of score the engine can put in `Results` (`detail[].key`), when they are known in advance: the texts they need are then listed in the gamemaster's
   * Copy page and checked by Launch. A game whose lines come from its data (the families of Courtisans) leaves it out.
   */
  scoreLines?: readonly string[]
  clientActions: readonly Action["type"][]
  /**
   * `seed`: an integer below 2^52 drawn by the server for each game; the same seed and the same actions
   * replay the same game. Optional for backwards compatibility: without one, the game draws its own.
   */
  setup: (args: SetupArgs<SetupData>) => State
  /**
   * `setup` that also says what happened while the game was being set up (the first round dealt, the hands drawn): the state, and the entries those moves add to the log, which opens with them. Optional: a game whose setup
   * has nothing to say, or none that a player would read, leaves it out. `setupStep(args).state` is the state `setup(args)` gives. Set a game up through `setupOf()`, never directly.
   */
  setupStep?: (args: SetupArgs<SetupData>) => Step<State, Event>
  apply: (state: State, action: Action) => State
  /**
   * `apply` that also says what happened: the new state, and the entries this move adds to the log of the table (`Step`, `LogEntry`). Optional: a game without it has no log.
   * - `step(state, action).state` is the state `apply(state, action)` gives: a game writes `apply` as `(state, action) => step(state, action).state`, and the other way round it is `step` that holds the rules.
   * - The entries are plain data (ids and numbers, never display text), oldest first, those of this move only: what an event says in full goes to the players it concerns (`to`), what the others read instead is `masked`.
   * - It is the log that carries them: the state keeps none (`docs/engine/01-the-game/09-state.md`, Lean state). The platform writes them down with the move, in the same order for everybody, and a board reads them with `useGameLog`.
   *
   * Play an action through `stepOf()`, never through `apply` or `step` directly: it works for a game with or without a log.
   */
  step?: (state: State, action: Action) => Step<State, Event>
  view: (state: State, playerId: string | null) => View
  isOver: (state: State) => boolean
  /**
   * How far the game has come, from 0 (just set up) to 100: the bar of the HUD, and what the platform weighs a player who leaves by (PLT-21). Optional: a game without it shows no bar. A game says it as a whole number it can compute from
   * the state alone (Flip 7: the best total over the target score); it need not grow evenly, and it need not never go down. Read it through `progressOf()`, which gives 100 once the game is over and never more than 99 before.
   */
  progress?: (state: State) => number
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
   * `at` is the time of the play, in milliseconds since the epoch on the server's clock, when it is known: the step the play begins starts its clock from it, as an action's `at` does.
   *
   * Not implemented: `autoPlay`, else `debug.turn`, and only when `playerId` is the single waiting player.
   * Call it through `playFor()`, never directly.
   */
  autoPlayFor?: (state: State, playerId: string, at?: number) => State
  /**
   * `autoPlayFor` that also says what happened, like `step` for `apply`: a game that has a `step` has this one too, so that what is played for an absent player is in the log as well.
   * `autoPlayStep(state, playerId).state` is the state `autoPlayFor(state, playerId)` gives. Play for a player through `playStepFor()`, never directly.
   */
  autoPlayStep?: (state: State, playerId: string, at?: number) => Step<State, Event>
  /**
   * The game goes live: the players are at the table and the first step begins at `at`, in milliseconds since the epoch on the server's clock. The server calls it once the table is `playing`, which is not when the game is set up: a table waits in
   * the lobby of the start screen while the boards load, and a clock that began then would run out before anyone could play. A game with a clock starts the one of its first step here (`startTimer`); a game with none leaves the hook out. It must
   * change nothing but the clock, and be harmless to call again later. Call it through `beginOf()`, never directly.
   */
  begin?: (state: State, at: number) => State
  /**
   * What the game needs the clock for, from its state alone: the time a step ends and the system action to play then (a turn that runs out, a window that closes), or null when nothing is timed. An engine never reads a clock: it keeps the time
   * in its state, as a number it takes from the `at` of the action that began the step (`startTimer`), and says here when that time comes. The server asks it after every move, shows the time left to the players (`deadlineInMs`) and plays the
   * action when `at` has passed, on the first request that looks at the table: nothing runs on a timer (`settleDeadlines`).
   * - `at` is a finite number of milliseconds; the action is a system action (`SYSTEM_PLAYER`) whose type is not in `clientActions`, and it is played with the deadline's `at` as its own.
   * - It must be pure and deterministic: the same state gives the same answer, on the server and in a replay.
   * - Playing the action must move the game on: afterwards the game is over, or has no deadline, or one that is not earlier. Several deadlines in a row are played in order, so a table nobody looked at for an hour catches up.
   * - A game that is over has none; a game with no clock leaves the hook out.
   * Read it through `deadlineOf()`, never directly.
   */
  nextDeadline?: (state: State) => Deadline<Action> | null
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
export type AnyGameDefinition = GameDefinition<any, any, any, any, any>

/** Debug commands: `turn` (automatic turn) and `over` (play to the end) are shared; a game can add its own (e.g. `missions`). */
export type DebugCommand = "turn" | "over" | (string & {})
