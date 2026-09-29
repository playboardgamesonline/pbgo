import { type State, GAME, type PlayerInfo, type OptionValues, type PlayerView } from "@pgo/binding"

export const MAX_PLAYERS = GAME.maxPlayers
export const MIN_PLAYERS = GAME.minPlayers

export type GameStatus = "lobby" | "playing" | "over"

export type PublicGame = {
  code: string
  hostId: string
  status: GameStatus
  players: PlayerInfo[]
  meId: string | null
  options: OptionValues
  replay: string[]
  version: number
  /** Dernière écriture (ISO) : sert à repérer un tour bloqué par un joueur absent */
  updatedAt?: string | null
  view: PlayerView | null
}

export type GameState = State

export const gameChannel = (code: string) => `game:${code}`
export const UPDATE_EVENT = "maj"

/** Délai après lequel les autres joueurs peuvent jouer à la place d'un joueur absent (secondes). */
export const TURN_TIMEOUT = 60
