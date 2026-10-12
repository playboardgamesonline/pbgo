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
  /** Plays the active player's turn for them (absent player). Default: `debug.turn`. */
  autoPlay?: (state: State) => State
  /** Id of the player who must play (null if nobody). Needed to play for an absent player. */
  activePlayer?: (state: State) => string | null
}

/** Debug commands: `turn` (automatic turn) and `over` (play to the end) are shared; a game can add its own (e.g. `missions`). */
export type DebugCommand = "turn" | "over" | (string & {})
