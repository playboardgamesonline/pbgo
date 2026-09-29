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
  view: PlayerView | null
}

export type GameState = State

export const gameChannel = (code: string) => `game:${code}`
export const UPDATE_EVENT = "maj"
