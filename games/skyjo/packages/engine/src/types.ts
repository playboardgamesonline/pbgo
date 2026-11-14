import type { LogEntry, OptionValues, Results, Standing } from "@pbgo/engine-kit"

/**
 * Skyjo: the types the engine and the board share.
 *
 * A card is a number in the state: the opaque id it holds right now (`ids` of the engine-kit). What it is (its face) comes from the
 * catalogue of the game (`catalogue.ts`), which is constant and never stored (lean state, PLT-45). The views show a card as a `Face`
 * (its id and its face key) only once it is face up; a face-down card is a `{ up: false }` and nothing else.
 *
 * Hidden: the cards face down in the grids, the order of the draw pile, and the card a player has just drawn from it (until they place
 * it or throw it away).
 */

/** A card a viewer sees: the id it holds now and what it is (a key of `CARDS`, e.g. "card-7" or "card-minus-2"). */
export type Face = { id: number; type: string }

/** Cards in a column, columns in a grid, cells in a grid. A cell is `column * ROWS + row`. */
export const ROWS = 3
export const COLUMNS = 4
export const CELLS = ROWS * COLUMNS

/** How many cards a player turns over before the round begins (rulebook, page 1). */
export const OPENING_FLIPS = 2

/** A cell of a grid: the card in it and whether it lies face up. `null`: the column was thrown away and the cell is empty. */
export type Cell = { card: number; up: boolean } | null

/**
 * What the round is busy with. Between two moves the state is settled: a player has to do something, or the round is over.
 *
 * - `reveal`: every player turns over two cards of their own grid, in any order (a simultaneous step); `reveal` actions. The last one starts the round.
 * - `choose`: `seat` takes the top card of the discard or draws the top card of the draw pile.
 * - `place`: `seat` holds `card`, drawn from the pile (`from: "deck"`: they may place it or throw it away) or taken from the discard (`"discard"`: they must place it).
 * - `flip`: `seat` threw away the card they drew and turns one of their face-down cards over.
 * - `between`: the round is over and counted; the dealer deals the next one. Between the last round and the end of the game, nobody is waited for.
 */
export type Stage =
  | { kind: "reveal" }
  | { kind: "choose"; seat: number }
  | { kind: "place"; seat: number; card: number; from: "deck" | "discard" }
  | { kind: "flip"; seat: number }
  | { kind: "between" }

/** What the end screen tells about a player, besides the points. By seat. */
export type SeatStats = { columns: number; ended: number; doubled: number }

/**
 * The state holds ids and numbers only. Every order comes from an array (`seats`, the piles, the grids), never from the keys of an
 * object: the state is stored as `jsonb`, which does not keep them.
 *
 * Each id of `ids` is in exactly one place: the draw pile, the discard, a cell of a grid, or the `card` of a `place` stage.
 */
export type State = {
  /** The options of the table, resolved (there are none). */
  options: OptionValues
  /** Player ids in seat order, clockwise: the player on the left of seat 3 is seat 4. */
  seats: string[]
  /** `ids[card]` is the id the card at index `card` of the catalogue holds. */
  ids: number[]
  /** Saved position of the stream of the shuffles. */
  rng: number
  /** The draw pile, top first. Hidden. */
  deck: number[]
  /** The discard, top first. Every card in it was face up. */
  discard: number[]
  /** Seat of the dealer: who deals the round that is going on or, between two rounds, the next one. The dealer moves one seat clockwise after each round. */
  dealer: number
  /** By seat: the 12 cells of the grid, `column * 3 + row`. They stay as the round left them until the next deal sweeps them up. */
  grids: Cell[][]
  stage: Stage
  /** The seat that was first to turn all its cards over in this round, once someone has: everyone else plays one last turn. */
  ender: number | null
  /** Seats that have played their last turn, once `ender` is set (the ender itself included once its turn is over). */
  last: number[]
  /** What each seat scored in every finished round, doubling included: `rounds[round][seat]`. The totals come from it (`sumRounds`). */
  rounds: number[][]
  /** By seat. */
  stats: SeatStats[]
}

/**
 * What a player can do.
 * - `reveal`: before the round, turn the card in `position` of your grid over (twice).
 * - `take`: take the top card of the discard (you must then place it).
 * - `draw`: draw the top card of the draw pile (you then place it or throw it away).
 * - `place`: put the card you hold in `position` of your grid; the card that was there goes on the discard.
 * - `discard`: throw the card you drew on the discard; you then flip a card.
 * - `flip`: turn the face-down card in `position` of your grid over.
 * - `deal`: between two rounds, the dealer deals the next one.
 */
export type Action =
  | { type: "reveal"; playerId: string; position: number }
  | { type: "take"; playerId: string }
  | { type: "draw"; playerId: string }
  | { type: "place"; playerId: string; position: number }
  | { type: "discard"; playerId: string }
  | { type: "flip"; playerId: string; position: number }
  | { type: "deal"; playerId: string }

/** One action, by its type: `ActionOf<"place">`. */
export type ActionOf<T extends Action["type"]> = Extract<Action, { type: T }>

/** The actions a client may send. */
export const CLIENT_ACTIONS = ["reveal", "take", "draw", "place", "discard", "flip", "deal"] as const satisfies readonly Action["type"][]

/**
 * What the engine refuses with an `EngineError`, by code. The board turns them into messages (listed in `ERROR_CODES` of the binding, written in Sanity);
 * the platform already words the shared ones (`NOT_YOUR_TURN`, `NOT_WAITING`, `INVALID_PHASE`…).
 */
export const SKYJO_ERROR_CODES = [
  "INVALID_PLAYERS", // the table is not 2 to 8 different players
  "GAME_OVER", // the game is over
  "NOT_YOUR_TURN", // the action belongs to another player (or to nobody)
  "NOT_WAITING", // the game does not wait for this player (a takeover asked for somebody it does not wait for)
  "INVALID_ACTION", // malformed
  "INVALID_PHASE", // an action of the game, but not one this step takes (drawing while holding a card, dealing in the middle of a round…)
  "INVALID_POSITION", // the position is not a cell of the grid, or its column was thrown away
  "CARD_FACE_UP", // the card is already face up: it cannot be turned over
  "MUST_PLACE", // a card taken from the discard cannot be thrown away: place it
] as const
export type SkyjoErrorCode = (typeof SKYJO_ERROR_CODES)[number]

/** A cell as everybody sees it: a card face up, a card face down (nothing is said of it), or a hole where a column was thrown away. */
export type PublicCell = { up: true; card: Face } | { up: false } | null

/**
 * Where a seat stands in the closing turn, once a player has turned all their cards over: `ender` is that player, `pending` has still
 * to play a last turn and `done` has played it. `null` while nobody has ended the round.
 */
export type LastTurn = "ender" | "pending" | "done" | null

/** A player at the table, as everybody sees them. */
export type PublicSeat = {
  id: string
  /** The 12 cells, `column * 3 + row`. */
  cells: PublicCell[]
  /** The value of the cards face up in front of them now. */
  score: number
  /** The points banked in the finished rounds. */
  total: number
  /** How many cards they have turned over so far (the opening: 0, 1, then 2). */
  revealed: number
  lastTurn: LastTurn
}

/**
 * What a viewer sees of the round's decision.
 * - `reveal`: `waiting` still have cards to turn over to begin the round.
 * - `choose`: `player` takes the discard or draws.
 * - `place`: `player` holds `card` (seen by the holder, and by everybody when it came from the discard; `null` for the others when it was drawn) and places it
 *   (`canDiscard`: the card came from the pile, so they may throw it away instead).
 * - `flip`: `player` turns a card over.
 * - `between`: the round is over, `dealer` deals the next one.
 * - `over`: the game is over.
 */
export type PublicPhase =
  | { kind: "reveal"; waiting: string[] }
  | { kind: "choose"; player: string }
  | { kind: "place"; player: string; from: "deck" | "discard"; card: Face | null; canDiscard: boolean }
  | { kind: "flip"; player: string }
  | { kind: "between"; dealer: string }
  | { kind: "over" }

export type PlayerView = {
  options: OptionValues
  /** The viewer's id when they are at the table, `null` for a spectator. */
  me: string | null
  /** In seat order. */
  players: PublicSeat[]
  /** What each seat has banked in the finished rounds, one for each seat in seat order and the same for every viewer: the points of the list of the players in the HUD. */
  standings: Standing[]
  /** The dealer: of the round going on, or of the next one between two rounds. */
  dealer: string
  /** The draw pile: its size. Its cards are hidden. */
  deck: { size: number }
  /** The discard: how many cards it holds and the card on top, which everybody sees. */
  discard: { size: number; top: Face | null }
  /** The player who turned all their cards over first in this round, once one has. */
  ender: string | null
  /** The number of the round going on, or of the last one once it is over. */
  round: number
  /** What each seat scored in every finished round, `rounds[round][seat]`. */
  rounds: number[][]
  /** The total that ends the game. */
  target: number
  phase: PublicPhase
  results: Results | null
}

/**
 * What happened, as plain data: the client turns it into sentences and animations.
 * - `reveal`: `by` turned the card in `position` over (the opening, or the flip that follows a discard); `how` says which.
 * - `take`: `by` took the top of the discard, the card `card`.
 * - `draw`: `by` drew a card from the pile. Only `by` reads which one: the others read the masked entry, with no `card`.
 * - `place`: `by` put the card `card` in `position`; `replaced` is the card that was there, now on the discard (`replacedUp`: it was face up).
 * - `discard`: `by` threw the card they drew onto the discard.
 * - `column`: three equal cards in `column` of `by` were thrown away (`value` is what they were, `cards` the three, top of the column first).
 * - `last`: `by` turned their last card over: everyone else plays one last turn.
 * - `reshuffle`: the draw pile ran out and the discard was shuffled into a new one.
 */
export type SkyjoEvent =
  | { kind: "round"; number: number; dealer: string }
  | { kind: "reveal"; by: string; position: number; card: Face; how: "opening" | "flip" }
  | { kind: "take"; by: string; card: Face }
  | { kind: "draw"; by: string; card?: Face }
  | { kind: "place"; by: string; position: number; card: Face; replaced: Face; replacedUp: boolean }
  | { kind: "discard"; by: string; card: Face }
  | { kind: "column"; by: string; column: number; value: number; cards: Face[] }
  | { kind: "start"; by: string; sum: number }
  | { kind: "last"; by: string }
  | { kind: "reshuffle" }
  | { kind: "end"; scores: number[]; ender: string; doubled: boolean }
  | { kind: "over"; winners: string[] }

export type SkyjoLogEntry = LogEntry<SkyjoEvent>

/** What a step gives back: the new state and what happened, for the platform to keep (the state keeps no log). */
export type SkyjoStep = { state: State; events: SkyjoLogEntry[] }
