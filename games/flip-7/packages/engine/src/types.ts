import type { LogEntry, OptionValues, Results } from "@pbgo/engine-kit"

/**
 * Flip 7: the types the engine and the board share.
 *
 * A card is a number in the state: the opaque id it holds right now (`ids` of the engine-kit). What it is (its face) comes from the
 * catalogue of the game (`catalogue.ts`), which is constant and never stored (lean state, PLT-45). The views show a card as a `Face`:
 * its id and its face key.
 *
 * Almost everything is public in Flip 7: every card is turned face up the moment it is drawn. The one hidden thing is the order of
 * the draw pile, so the views only say how big it is and which faces it still holds.
 */

/** A card a viewer sees: the id it holds now and what it is (a key of `CARDS`, e.g. "number-7" or "freeze"). */
export type Face = { id: number; type: string }

/**
 * Where a player stands in the round.
 * - `active`: still in. Only an active player can be given a Freeze, a Flip Three or a Second Chance.
 * - `stayed`: banked their points and left the round, by choice or because the round ended while they were still in.
 * - `frozen`: banked their points because a Freeze was played on them.
 * - `busted`: drew a number they already had. Out, with nothing.
 */
export type Status = "active" | "stayed" | "frozen" | "busted"

/**
 * What the round is busy with: a stack, whose last frame is the one the game works on. The engine plays every frame by itself until it
 * needs a player, so between two moves the stack is settled: it is empty (no round is going on) or its last frame is a `turn` that
 * waits for its player or a `target` that waits for its holder. `seat` is always an index of `State.seats`.
 *
 * - `deal`: the opening deal. `given` players were dealt their card so far: the player on the left of the dealer first, the dealer last.
 * - `turn`: `seat` hits or stays. Once `acted`, the game settles what the move set off (a Freeze, a Flip Three…), then the turn passes on.
 * - `flip`: a Flip Three is played on `seat`, who still has `remaining` cards to flip. `held` are the Freeze and Flip Three cards flipped on
 *   the way: they wait, in front of `seat` and face up, until the three cards are done.
 * - `target`: `seat` holds the action card `card` and chooses who gets it.
 */
export type Frame =
  | { kind: "deal"; given: number }
  | { kind: "turn"; seat: number; acted: boolean }
  | { kind: "flip"; seat: number; remaining: number; held: number[] }
  | { kind: "target"; seat: number; card: number }

/** One frame, by its kind: `FrameOf<"flip">`. */
export type FrameOf<K extends Frame["kind"]> = Extract<Frame, { kind: K }>

/** What the end screen tells about a player, besides the points. By seat. */
export type SeatStats = { busts: number; flip7: number }

/**
 * The state holds ids and numbers only. Every order comes from an array (`seats`, the piles, the lines), never from the keys of an
 * object: the state is stored as `jsonb`, which does not keep them.
 *
 * Each id of `ids` is in exactly one place: the draw pile, the discard, a line, a `held` list of a `flip` frame, or the `card` of a
 * `target` frame.
 */
export type State = {
  /** The options of the table, resolved. */
  options: OptionValues
  /** Player ids in seat order, clockwise: the player on the left of seat 3 is seat 4. */
  seats: string[]
  /** `ids[card]` is the id the card at index `card` of the catalogue holds. */
  ids: number[]
  /** Saved position of the stream of the shuffles. */
  rng: number
  /** The draw pile, top first. The only hidden thing of the game. */
  deck: number[]
  /** The discard, top first. Every card in it was face up. */
  discard: number[]
  /** Seat of the dealer: who deals the round that is going on or, between two rounds, the next one. */
  dealer: number
  /** The cards in front of each seat, in the order they came. After a round they stay there until the next deal sweeps them up. */
  lines: number[][]
  /** By seat. */
  status: Status[]
  stack: Frame[]
  /** What each seat scored in every finished round: `rounds[round][seat]`. The totals come from it (`sumRounds`). */
  rounds: number[][]
  /** By seat. */
  stats: SeatStats[]
}

/**
 * What a player can do.
 * - `hit`: draw a card (their turn).
 * - `stay`: bank the points and leave the round (their turn, with at least one card in front of them).
 * - `target`: choose who gets the Freeze, Flip Three or Second Chance they hold. `target` is the id of an active player.
 * - `deal`: between two rounds, the new dealer deals the next one.
 */
export type Action =
  | { type: "hit"; playerId: string }
  | { type: "stay"; playerId: string }
  | { type: "target"; playerId: string; target: string }
  | { type: "deal"; playerId: string }

/** One action, by its type: `ActionOf<"target">`. */
export type ActionOf<T extends Action["type"]> = Extract<Action, { type: T }>

/** The actions a client may send. */
export const CLIENT_ACTIONS = ["hit", "stay", "target", "deal"] as const satisfies readonly Action["type"][]

/**
 * What the engine refuses with an `EngineError`, by code. The board turns them into messages (listed in `ERROR_CODES` of the binding, written in Sanity);
 * `NOT_YOUR_TURN` and `NOT_WAITING` are the ones the platform already translates.
 */
export const FLIP7_ERROR_CODES = [
  "INVALID_PLAYERS", // the table is not 3 to 18 different players
  "GAME_OVER", // the game is over
  "NOT_YOUR_TURN", // the action belongs to another player (or to nobody)
  "NOT_WAITING", // the game does not wait for this player (a takeover asked for somebody it does not wait for)
  "INVALID_ACTION", // malformed, or not an action of the current step
  "CANNOT_STAY", // nothing in front of the player: they must hit
  "INVALID_TARGET", // the target is missing, is not at the table, or cannot get this card (out of the round, or already holds a Second Chance)
] as const
export type Flip7ErrorCode = (typeof FLIP7_ERROR_CODES)[number]

/**
 * What a viewer sees of the round's decision.
 * - `turn`: `player` hits or stays; `canStay` is false while they have nothing in front of them.
 * - `target`: `player` holds `card` and chooses among `targets` (player ids, in seat order).
 * - `between`: the round is over, `dealer` deals the next one.
 * - `over`: the game is over.
 */
export type PublicPhase =
  | { kind: "turn"; player: string; canStay: boolean }
  | { kind: "target"; player: string; card: Face; targets: string[] }
  | { kind: "between"; dealer: string }
  | { kind: "over" }

/** A player at the table, as everybody sees them. */
export type PublicSeat = {
  id: string
  /** In front of them, in the order the cards came. */
  cards: Face[]
  /** Freeze and Flip Three cards flipped during their Flip Three, set aside until it is done. The one they are deciding on, if any, is in `phase`. */
  held: Face[]
  status: Status
  /** What the cards in front of them are worth now: nothing once busted. */
  score: number
  /** The points banked in the finished rounds. */
  total: number
}

export type PlayerView = {
  options: OptionValues
  /** The viewer's id when they are at the table, `null` for a spectator. Nothing in the view depends on it: no hand is hidden. */
  me: string | null
  /** In seat order. */
  players: PublicSeat[]
  /** The dealer: of the round going on, or of the next one between two rounds. */
  dealer: string
  /** The draw pile: its size, and how many of each face it still holds (what is not in front of anyone nor on the discard). */
  deck: { size: number; counts: { type: string; count: number }[] }
  /** Top first. */
  discard: Face[]
  /** The number of the round going on, or of the last one once it is over. */
  round: number
  /** What each seat scored in every finished round, `rounds[round][seat]`. */
  rounds: number[][]
  /** The score that wins the game. */
  target: number
  phase: PublicPhase
  results: Results | null
}

/**
 * What happened, as plain data: the client turns it into sentences and animations. Nothing is hidden in Flip 7, so every entry is
 * public (no `to`, no `masked`).
 * - `draw`: a card is turned over in front of `by`, dealt (`deal`), after a hit (`hit`) or during a Flip Three (`flip`).
 * - `play`: the action card `card` goes in front of `target`: a Freeze (who is frozen), a Flip Three (who flips three) or a Second Chance
 *   (given away, or kept: `by` is `target`). It is a Freeze and Flip Three cards that wait for the end of a Flip Three that are played later.
 * - `saved`: a Second Chance cancels a duplicate: both cards go to the discard.
 * - `discarded`: an action card nobody can get goes to the discard.
 */
export type Flip7Event =
  | { kind: "round"; number: number; dealer: string }
  | { kind: "draw"; by: string; card: Face; how: "deal" | "hit" | "flip" }
  | { kind: "stay"; by: string; points: number }
  | { kind: "bust"; by: string; card: Face }
  | { kind: "saved"; by: string; card: Face; secondChance: Face }
  | { kind: "play"; by: string; target: string; card: Face }
  | { kind: "discarded"; by: string; card: Face }
  | { kind: "reshuffle" }
  | { kind: "flip7"; by: string }
  | { kind: "end"; scores: number[] }
  | { kind: "over"; winners: string[] }

export type Flip7LogEntry = LogEntry<Flip7Event>

/** What a step gives back: the new state and what happened, for the platform to keep (the state keeps no log). */
export type Step = { state: State; events: Flip7LogEntry[] }
