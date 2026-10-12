import type { OptionValues, PlayerInfo } from "@pbgo/engine-kit"
import type { CoreView } from "./binding"

export type GameStatus = "lobby" | "playing" | "over"

/** Where the takeover of one waiting player stands (see `server/takeover.ts`). Public: every viewer of the table gets it. */
export type TakeoverStatus = {
  /** A player the game waits for, whom the others can play for */
  playerId: string
  /** Players who have to agree: the present players other than `playerId`, in seat order */
  voters: string[]
  /** Those of `voters` who already voted to play for `playerId` */
  votes: string[]
}

/** A game as a player sees it. `View` is the game's player view (`GAME.view`); core only reads `CoreView`. */
export type PublicGame<View = CoreView> = {
  code: string
  hostId: string
  status: GameStatus
  players: PlayerInfo[]
  meId: string | null
  options: OptionValues
  replay: string[]
  /**
   * Players the game waits for now: one on a turn, several on a simultaneous step. Public information, the same for every
   * viewer (it tells who has not played yet, never what). Empty outside a game in progress.
   */
  waitingFor: string[]
  /** Members seen at the table in the last 75 s, in seat order. The viewer counts as present. */
  present: string[]
  /** Takeover of each waiting player: who has to agree to play for them, who already did. Empty outside a game in progress. */
  takeovers: TakeoverStatus[]
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
