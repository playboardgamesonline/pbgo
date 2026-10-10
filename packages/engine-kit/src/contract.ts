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
 * `SetupData` : données chargées côté serveur avant le lancement (ex. missions depuis Sanity).
 * Le web les fournit via `loadSetupData` exporté par `@pbgo/binding` ; absent → `undefined`.
 */
export type GameDefinition<State, Action extends PlayerAction, View, SetupData = undefined> = {
  id: string
  name: string
  minPlayers: number
  maxPlayers: number
  options: OptionDefinitions
  /** Combinaisons d'options proposées en un clic dans le lobby (facultatif). */
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
  /** Joue le tour du joueur actif à sa place (joueur absent). Par défaut : `debug.turn`. */
  autoPlay?: (state: State) => State
  /** Id du joueur qui doit jouer (null si personne). Nécessaire pour jouer à la place d'un absent. */
  activePlayer?: (state: State) => string | null
}

/** Commandes de debug : `turn` (tour automatique) et `over` (jusqu'à la fin) sont communes ; un jeu peut en ajouter (ex. `missions`). */
export type DebugCommand = "turn" | "over" | (string & {})
