import type { OptionValues, PlayerInfo } from "@pbgo/engine-kit"
import type { CoreView } from "./binding"

/** `starting`: the host has started the table and the boards have not all loaded yet (PLT-107); the game is set up, and each board is drawn behind the start screen */
export type GameStatus = "lobby" | "starting" | "playing" | "over"

/** Where the takeover of one waiting player stands (see `server/takeover.ts`). Public: every viewer of the table gets it. */
export type TakeoverStatus = {
  /** A player the game waits for, whom the others can play for */
  playerId: string
  /** Players who have to agree: the present players other than `playerId`, in seat order */
  voters: string[]
  /** Those of `voters` who already voted to play for `playerId` */
  votes: string[]
}

/**
 * A seated player as the table shows them: the engine's `PlayerInfo` plus what accounts will add. Both are optional and nothing
 * fills them before PLT-13 (profiles), PLT-16 and PLT-17: the seat label (`components/game/seat-label.tsx`) already reads them,
 * so an account only has to set them for its picture to replace the generated avatar everywhere.
 */
export type PublicPlayer = PlayerInfo & {
  /** The account's picture; absent: the avatar is generated from the nickname and the seat colour */
  avatarUrl?: string
  /** Account badge (PLT-17), meant for the label next to the nickname; read by nothing yet */
  badge?: string
  /**
   * The player left the game while it was in progress (PLT-120). Their seat stays at the table, since the state of the game has it, and the server plays it for them (`server/table-rules.ts`); they take no part in the table any more
   * (`meId` is null for them, they are not present, they cannot act). Never set in a lobby, where a player who leaves is unseated.
   */
  left?: boolean
}

/** A game as a player sees it. `View` is the game's player view (`GAME.view`); core only reads `CoreView`. */
export type PublicGame<View = CoreView> = {
  code: string
  hostId: string
  status: GameStatus
  players: PublicPlayer[]
  meId: string | null
  options: OptionValues
  replay: string[]
  /** The players who have said they are ready, in seat order, while the table is `starting`; empty otherwise */
  ready: string[]
  /** What is left of the time to be ready when this was sent, in milliseconds (a duration, not a date: a clock that is off does not matter); null outside `starting` */
  readyInMs: number | null
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
/** The channel on which the boards of a table that is `starting` tell each other how far they are loaded (presence, nothing stored): the collective bar of the start screen */
export const loadingChannel = (slug: string, code: string) => `loading:${slug}:${code}`
