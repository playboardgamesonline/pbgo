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
  /**
     * The tag of the member who sits here (`Alex#0042`, 1 to 9999). With the nickname it is their handle, which leads to their profile (PLT-39). A copy made when they sat down. None for a guest. Never given to an engine.
     */
  tag?: number
  /** Account badge (PLT-17), meant for the label next to the nickname; read by nothing yet */
  badge?: string
  /**
   * The player left the game while it was in progress (PLT-120), or went on from it once it was over (the "Continue" of the end screen). Their seat stays at the table, since the state of the game has it, and the server plays it for them (`server/table-rules.ts`); they take no part in the table any more
   * (`meId` is null for them, they are not present, they cannot act). Never set in a lobby, where a player who leaves is unseated.
   */
  left?: boolean
}

/**
 * One line of the log of a table as a player reads it: what happened (`event`: plain data of the game, that the board turns into a sentence or an animation) and `v`, the version of the table that the move which said it produced. A move can say
 * several things: they share their `v` and come in the order they happened. A board that plays what is new keeps the greatest `v` it has played.
 */
export type LogLine<Event = unknown> = { v: number; event: Event }

/** A game as a player sees it. `View` is the game's player view (`GAME.view`); core only reads `CoreView`. `Event` is what the game says happened (`GameDefinition.step`). */
export type PublicGame<View = CoreView, Event = unknown> = {
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
  /** What is left of the time of the step the game is on when this was sent, in milliseconds, for a game with a clock (`GAME.nextDeadline`): a duration, not a date, so a clock that is off does not matter, counted by the board from the moment it reads this. When it comes to 0 the game plays the deadline, on the first request that looks at the table (`POST …/tick`). Null for a game with no clock, and outside a game in progress */
  deadlineInMs: number | null
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
  /** How far the game has come, from 0 to 100 (`GAME.progress`, read through `progressOf`): the bar of the HUD. Null for a game that does not say, and for a table that has no game in it any more */
  progress: number | null
  /** Last write (ISO): spots a turn blocked by an absent player */
  updatedAt?: string | null
  /** Creation of the game (ISO): shown under the score table */
  createdAt?: string | null
  view: View | null
  /**
   * The last lines of the log of the table, oldest first, as this viewer reads them (`viewLog`: an event in full when it is theirs to read, what the others read instead when it is not). What happened in the game, for the history on the
   * screen and for a board that plays what is new; empty for a game that says nothing, and while no move has been played. Kept apart from `view`, which is the state seen by a player: the log is not in the state.
   */
  log: LogLine<Event>[]
}

/** A state saved by the debug tools (`Copy state`): the game, the ids of the seats in order and the state itself, so that it can be loaded into any table of the same game with as many seats (`restoreState`) */
export type SavedState = { game: string; players: string[]; state: unknown; savedAt: string }

// The slug keeps two games with the same table code apart on the shared Supabase project.
export const gameChannel = (slug: string, code: string) => `game:${slug}:${code}`
export const UPDATE_EVENT = "update"
/** The channel on which the boards of a table that is `starting` tell each other how far they are loaded (presence, nothing stored): the collective bar of the start screen */
export const loadingChannel = (slug: string, code: string) => `loading:${slug}:${code}`
