import type { LogEntry, OptionValues, Results, Submissions } from "@pbgo/engine-kit"

/**
 * Exploding Kittens: the types the engine and the board share.
 *
 * A card is a number in the state: the opaque id it holds right now (`ids` of the engine-kit). What it is (its type) comes from
 * the catalogue of the game, which is rebuilt from the options and never stored (lean state, PLT-45). The views show a card as a
 * `Face`: its id and its type, only for the viewers who may see it.
 */

/** A card a viewer may see: the id it holds now and what it is (a key of the cards of the rules, e.g. "attack"). */
export type Face = { id: number; type: string }

/** A Nope of the chain: the card (it already sits on the discard) and who played it. */
export type NopeEntry = { card: number; by: string }

/** An action card (Attack, Skip, Favor, Shuffle, See the Future…) waiting behind its Nope window, with the player it names. */
export type CardPending = { kind: "card"; by: string; card: number; target?: string }

/** Two, three or five cards played together, waiting behind their Nope window; `named` is the title a triple asks for. */
export type ComboPending = { kind: "combo"; by: string; cards: number[]; target?: string; named?: string }

/**
 * What waits behind a Nope window. The cards are on the discard already: a Noped action costs its cards.
 */
export type Pending = CardPending | ComboPending

/**
 * Where the game is.
 * - `turn`: the current player plays cards, then draws.
 * - `reaction`: a Nope window is open on `pending`. `nopes` is the chain; `passed` holds the players who may still react (the
 *   living players except the author of the last card of the chain): `true` once they passed. Nobody but the server sees it.
 * - `defuse`: the current player drew the Exploding Kitten `kitten`, which is revealed and held out of every pile, and chooses
 *   where it goes back into the draw pile.
 * - `give`: a Favor. `from` chooses a card of their hand to give to `to`.
 * - `pick`: a five-different combo. The current player takes a card from the discard; `played` are the five cards just played.
 * - `over`: one player is left.
 */
export type Phase =
  | { kind: "turn" }
  | { kind: "reaction"; pending: Pending; nopes: NopeEntry[]; passed: Submissions<true> }
  | { kind: "defuse"; kitten: number }
  | { kind: "give"; from: string; to: string }
  | { kind: "pick"; played: number[] }
  | { kind: "over" }

/** One phase, by its kind: `PhaseOf<"reaction">`. */
export type PhaseOf<K extends Phase["kind"]> = Extract<Phase, { kind: K }>

/** What the end screen tells about a player. */
export type SeatStats = { turns: number; defused: number; nopes: number }

/**
 * The state holds ids and numbers only. Every order comes from an array (`seats`, the piles), never from the keys of an object:
 * the state is stored as `jsonb`, which does not keep them.
 *
 * Each id of `ids` is in exactly one place: a hand, the draw pile, the discard, the `defuse` phase (the Kitten in the air), or
 * nowhere (a card removed from the game when it was set up: nobody ever sees it).
 */
export type State = {
  /** The options of the table, resolved. They also tell which decks make the catalogue. */
  options: OptionValues
  /** Player ids in seat order, clockwise. Eliminated players keep their seat. */
  seats: string[]
  /** `ids[card]` is the id the card at index `card` of the catalogue holds now. */
  ids: number[]
  /** Saved position of the stream of the ids (a side stream, see `sideSeed`). */
  idsRng: number
  /** Saved position of the stream of the shuffles, steals and automatic plays. */
  rng: number
  /** The draw pile, top first. */
  deck: number[]
  /** The discard, top first: the card played last is `discard[0]`. Public. */
  discard: number[]
  /** The hand of each seat. */
  hands: number[][]
  /** Eliminated players, in the order they left: it is the ranking of the game, from the last. */
  out: string[]
  /** Seat of the current player. */
  turn: number
  /** Turns the current player still has to take, this one included. 1 on a normal turn. */
  owed: number
  /** True when `owed` comes from an Attack: the next Attack stacks on it. */
  attacked: boolean
  /** Players who know the top cards of the draw pile (See the Future): how many. Private to each of them. */
  known: Record<string, number>
  /** By seat. */
  stats: SeatStats[]
  phase: Phase
}

/** What a player can do. `chain` is the number of Nopes the client saw: see `STALE_REACTION`. */
export type Action =
  | { type: "play"; playerId: string; card: number; target?: string }
  | { type: "combo"; playerId: string; cards: number[]; target?: string; named?: string }
  | { type: "nope"; playerId: string; card: number; chain: number }
  | { type: "pass"; playerId: string; chain: number }
  | { type: "draw"; playerId: string }
  | { type: "defuse"; playerId: string; position: number }
  | { type: "give"; playerId: string; card: number }
  | { type: "pick"; playerId: string; card: number }

/** One action, by its type: `ActionOf<"nope">`. */
export type ActionOf<T extends Action["type"]> = Extract<Action, { type: T }>

/** The actions a client may send. */
export const CLIENT_ACTIONS = ["play", "combo", "nope", "pass", "draw", "defuse", "give", "pick"] as const satisfies readonly Action["type"][]

/**
 * What the engine refuses with an `EngineError`, by code. The board turns them into messages (`ERROR_MESSAGES` of the binding);
 * `NOT_YOUR_TURN`, `NOT_WAITING` and `UNKNOWN_CARD` are the ones the platform already translates.
 */
export const EK_ERROR_CODES = [
  "INVALID_PLAYERS", // the table is not 2 to 5 different players
  "GAME_OVER", // the game is over
  "NOT_YOUR_TURN", // the action belongs to another player (or to nobody)
  "NOT_WAITING", // the game does not wait for this player (a Nope or a pass after the window closed, or by the author)
  "REACTION_OPEN", // a Nope window is open: only `nope` and `pass`
  "STALE_REACTION", // the chain moved since the client looked: ask again
  "INVALID_ACTION", // malformed, or not an action of the current phase
  "UNKNOWN_CARD", // the card is not in the player's hand
  "NOT_PLAYABLE", // that card is not played on its own (a cat, a Defuse, a Nope, a Kitten)
  "INVALID_TARGET", // the target is missing, is the player, is out, or holds no card
  "BAD_COMBO", // not two or three alike, nor five different (when the option is on)
  "INVALID_TITLE", // the title asked by a triple is not a card of the game
  "EMPTY_DISCARD", // five different cards, and nothing to take from the discard
  "NO_NOPE", // the card played as a Nope is not one
  "ALREADY_PASSED", // the player passed already
  "BAD_POSITION", // the Kitten goes back at a position the draw pile does not have
  "INVALID_PICK", // the card is not in the discard, was just played, or is an Exploding Kitten
  "EMPTY_DECK", // nothing to draw (cannot happen in a game that follows the rules)
] as const
export type EkErrorCode = (typeof EK_ERROR_CODES)[number]

/** What a viewer sees of what waits behind a Nope window. */
export type PublicPending =
  | { kind: "card"; by: string; card: Face; target?: string }
  | { kind: "combo"; by: string; cards: Face[]; target?: string; named?: string }

/**
 * `reaction`: `chain` is the number of Nopes so far, which `nope` and `pass` send back. `passed` is for the viewer only: true once
 * they passed. Nobody sees who else passed.
 */
export type PublicPhase =
  | { kind: "turn" }
  | { kind: "reaction"; pending: PublicPending; nopes: { card: Face; by: string }[]; chain: number; passed?: boolean }
  | { kind: "defuse"; kitten: Face }
  | { kind: "give"; from: string; to: string }
  | { kind: "pick"; played: Face[] }
  | { kind: "over" }

export type PlayerView = {
  options: OptionValues
  /** The viewer's hand and what they know of the top of the draw pile. `null` for a spectator and for an eliminated player. */
  me: { id: string; hand: Face[]; top: Face[] } | null
  /** In seat order. `cards` is the size of the hand. */
  players: { id: string; cards: number; alive: boolean }[]
  /** Size of the draw pile. */
  deck: number
  /** Top first. */
  discard: Face[]
  /** Id of the current player; `null` once the game is over. */
  turn: string | null
  owed: number
  attacked: boolean
  phase: PublicPhase
  /** Eliminated players, in the order they left. */
  out: string[]
  results: Results | null
}

/**
 * What happened, as plain data: the client turns it into sentences. Some events carry a card only for the players who may see
 * it (`LogEntry.to`); everybody else gets the masked version.
 */
export type EkEvent =
  | { kind: "turn"; player: string; owed: number }
  | { kind: "play"; by: string; card: Face; target?: string }
  | { kind: "combo"; by: string; cards: Face[]; target?: string; named?: string }
  | { kind: "nope"; by: string; card: Face }
  | { kind: "resolved"; by: string }
  | { kind: "cancelled"; by: string }
  | { kind: "fizzled"; by: string }
  | { kind: "draw"; by: string; card?: Face }
  | { kind: "kitten"; by: string; card: Face }
  | { kind: "defused"; by: string; card: Face }
  | { kind: "reinserted"; by: string; position?: number }
  | { kind: "exploded"; by: string; cards: Face[] }
  | { kind: "attack"; by: string; next: string; owed: number }
  | { kind: "skip"; by: string }
  | { kind: "shuffle"; by: string }
  | { kind: "see"; by: string; count: number; cards?: Face[] }
  | { kind: "ask"; by: string; from: string }
  | { kind: "give"; from: string; to: string; card?: Face }
  | { kind: "steal"; by: string; from: string; card?: Face }
  | { kind: "named"; by: string; from: string; title: string; hit: boolean; card?: Face }
  | { kind: "pick"; by: string; card: Face }
  | { kind: "over"; winner: string }

export type EkLogEntry = LogEntry<EkEvent>

/** What a step gives back: the new state and what happened, for the platform to keep (the state keeps no log). */
export type Step = { state: State; events: EkLogEntry[] }
