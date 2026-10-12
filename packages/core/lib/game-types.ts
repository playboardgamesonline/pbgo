import type { OptionValues, PlayerInfo } from "@pbgo/engine-kit"
import type { CoreView } from "./binding"

export type GameStatus = "lobby" | "playing" | "over"

/** A game as a player sees it. `View` is the game's player view (`GAME.view`); core only reads `CoreView`. */
export type PublicGame<View = CoreView> = {
  code: string
  hostId: string
  status: GameStatus
  players: PlayerInfo[]
  meId: string | null
  options: OptionValues
  replay: string[]
  /** Players who voted to play for the absent player (current state) */
  takeoverVotes?: string[]
  version: number
  /** Last write (ISO): spots a turn blocked by an absent player */
  updatedAt?: string | null
  /** Creation of the game (ISO): shown under the score table */
  createdAt?: string | null
  view: View | null
}

// The slug keeps two games with the same table code apart on the shared Supabase project.
export const gameChannel = (slug: string, code: string) => `game:${slug}:${code}`
export const UPDATE_EVENT = "update"
