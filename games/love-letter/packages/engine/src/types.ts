import type { LogEntry, OptionValues, Results, Standing } from "@pbgo/engine-kit"
import type { CharacterKey } from "./catalogue"

/**
 * Love Letter: the types the engine and the board share.
 *
 * A card is a number in the state: the opaque id it holds right now (`ids` of the engine-kit). Who it is (its character) comes from the
 * catalogue of the game (`catalogue.ts`), which is constant and never stored (lean state, PLT-45). The views show a card as a `Face` (its id
 * and its character key) only to a viewer who may see it; a hand the viewer may not see is a count.
 *
 * Hidden: the hands of the other players, the order of the deck, the card set aside face down. Everything else is public: the cards played and
 * discarded lie face up in front of their player, and so do the three cards set aside face up at two players.
 */

/** A card a viewer sees: the id it holds now and who it is (a key of `CARDS`, e.g. "guard"). */
export type Face = { id: number; type: CharacterKey }

/**
 * What the round is busy with. Between two moves the state is settled: a player has to do something, or the round is over.
 *
 * - `play`: the player in `turn` holds two cards (the one they kept and the one they drew) and plays one of them.
 * - `between`: the round is over and counted; the player in `turn`, who takes the first turn of the next one, deals it. Nobody is waited for once the
 *   game is over. `revealed`: the round ended on a comparison, so the players still in laid their hands face up; `winners` and `spy` are seats:
 *   the winners of the round and the player who earned the Spy's token, if one did.
 */
export type Stage = { kind: "play" } | { kind: "between"; revealed: boolean; winners: number[]; spy: number | null }

/**
 * The state holds ids and numbers only. Every order comes from an array (`seats`, the piles, the hands), never from the keys of an object: the
 * state is stored as `jsonb`, which does not keep them.
 *
 * Each id of `ids` is in exactly one place: the deck, `aside`, `faceUp`, the hand of a seat or its area.
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
  /** The number of the round going on, or of the last one between two rounds. */
  round: number
  /** The seat that plays now or, between two rounds, the one that deals the next round and takes its first turn. */
  turn: number
  stage: Stage
  /** The deck, top first. Hidden. */
  deck: number[]
  /** The card set aside face down at the start of the round, which nobody looks at. Hidden. */
  aside: number | null
  /** At two players, the three cards set aside face up. Public; empty at other tables. */
  faceUp: number[]
  /** By seat: one card between turns, two on the turn, none once out of the round. */
  hands: number[][]
  /** By seat: the cards played or discarded in this round, oldest first. All face up. */
  areas: number[][]
  /** By seat: out of the round (rulebook, p. 5). */
  out: boolean[]
  /** By seat: a Handmaid protects them until the start of their next turn (rulebook, p. 11). */
  shielded: boolean[]
  /** By seat: the rounds won, one favor token each. The tokens of a seat are `won + spies`. */
  won: number[]
  /** By seat: the Spy's tokens (rulebook, p. 13). */
  spies: number[]
}

/**
 * What a player can do.
 * - `play`: on your turn, play the card `card` (its id) of your hand. `target` is the player it picks (the id of a player: another one for the Guard, Priest, Baron
 *   and King, any one for the Prince), given when one can be chosen and never when none can. `guess` is the character a Guard names (any but the Guard).
 * - `deal`: between two rounds, the player who takes the first turn deals the next one.
 */
export type Action = { type: "play"; playerId: string; card: number; target?: string; guess?: CharacterKey } | { type: "deal"; playerId: string }

/** One action, by its type: `ActionOf<"play">`. */
export type ActionOf<T extends Action["type"]> = Extract<Action, { type: T }>

/** The actions a client may send. */
export const CLIENT_ACTIONS = ["play", "deal"] as const satisfies readonly Action["type"][]

/**
 * What the engine refuses with an `EngineError`, by code. The board turns them into messages (the game's own ones are listed in `ERROR_CODES` of the
 * binding and written in Sanity); the platform already words the shared ones (`NOT_YOUR_TURN`, `NOT_WAITING`, `INVALID_PHASE`…).
 */
export const LOVE_LETTER_ERROR_CODES = [
  "INVALID_PLAYERS", // the table is not 2 to 6 different players
  "GAME_OVER", // the game is over
  "NOT_YOUR_TURN", // the action belongs to another player (or to nobody)
  "NOT_WAITING", // the game does not wait for this player (a takeover asked for somebody it does not wait for)
  "INVALID_ACTION", // malformed
  "INVALID_PHASE", // an action of the game, but not one this step takes (dealing in the middle of a round, playing between two rounds)
  "UNKNOWN_CARD", // the card is not in the player's hand
  "INVALID_TARGET", // the player the card picks is missing, is not at the table, or cannot be chosen: out of the round, protected by a Handmaid, or the player themselves where the card says another
  "INVALID_CHOICE", // the character a Guard names is missing, or is not one of the nine other characters
  "MUST_PLAY_COUNTESS", // the player holds the Countess and the King or a Prince: they must play her
] as const
export type LoveLetterErrorCode = (typeof LOVE_LETTER_ERROR_CODES)[number]

/** A player at the table, as everybody sees them. */
export type PublicSeat = {
  id: string
  /** How many cards they hold: 1 between turns, 2 on their turn, 0 once out. */
  cards: number
  /** Their hand face up: every player still in shows it at the end of a round that ended on a comparison (rulebook, p. 6). `null` otherwise. */
  hand: Face[] | null
  /** The cards they played or discarded this round, oldest first (rulebook, p. 5: always visible). */
  area: Face[]
  /** Out of the round: the broken seal. */
  out: boolean
  /** A Handmaid protects them until the start of their next turn. */
  shielded: boolean
  /** The favor tokens they hold. */
  tokens: number
}

/** What the viewer holds, for a viewer who sits at the table. */
export type Me = {
  id: string
  /** Their hand, face up to them: the card they drew this turn is the last one. */
  hand: Face[]
  /** The ids of the cards they may play now: none unless it is their turn. */
  playable: number[]
}

/**
 * What a viewer sees of the round's decision.
 * - `turn`: `player` plays one of their two cards. `targets` are the other players a card can pick now (still in the round and not protected by a Handmaid), in
 *   seat order: public, since who is out and who is protected is. A card that picks another player is played with no effect when there is none; the Prince can
 *   always pick its own player.
 * - `between`: the round is over, `next` deals the next one and takes the first turn. `winners` won the round, `spy` earned the Spy's token (`null`
 *   when nobody did), `revealed` says that the players still in laid their hands face up.
 * - `over`: the game is over.
 */
export type PublicPhase =
  | { kind: "turn"; player: string; targets: string[] }
  | { kind: "between"; next: string; winners: string[]; spy: string | null; revealed: boolean }
  | { kind: "over" }

export type PlayerView = {
  options: OptionValues
  /** `null` for a spectator, or a player who is not at the table. */
  me: Me | null
  /** In seat order. */
  players: PublicSeat[]
  /** The favor tokens of each seat, one for each seat in seat order and the same for every viewer: the points of the list of the players in the HUD. */
  standings: Standing[]
  /** The deck: its size. Its cards are hidden. */
  deck: { size: number }
  /** The cards set aside face down: 1, or 0 once a card took it. Which one is hidden. */
  aside: number
  /** At two players, the three cards set aside face up. */
  faceUp: Face[]
  /** The number of the round going on, or of the last one once it is over. */
  round: number
  /** The favor tokens that win the game at this table. */
  target: number
  phase: PublicPhase
  results: Results | null
}

/**
 * What happened, as plain data: the client turns it into sentences and animations. A private entry has a `masked` version that holds the fact and
 * never the card.
 * - `round`: a round was dealt, `first` takes the first turn; `faceUp` are the three cards set aside face up (two players only).
 * - `draw`: `by` drew the top card of the deck. Only `by` reads which one: the others read the masked entry, with no `card`.
 * - `play`: `by` played `card`, which lies face up in front of them.
 * - `guess`: a Guard of `by` named the character `guess` for `target`, who `hit` (holds it, and is out) or not. Public.
 * - `look`: a Priest of `by` looked at the hand of `target`: only `by` reads which card.
 * - `compare`: a Baron of `by` compared hands with `target`: the two read both cards, the others read that it happened.
 * - `swap`: a King of `by` traded hands with `target`: the two read both cards, the others read that it happened. `cards.by` is what `by` held before, `cards.target`
 *   what `target` held.
 * - `protect`: a Handmaid of `by` protects them until the start of their next turn.
 * - `discard`: a Prince of `by` made `player` (who can be `by`) discard `card`, now face up in front of them.
 * - `out`: `player` is out of the round, `cause` says how (`guard`: named by a Guard, `baron`: the lower card, `princess`: she was played or discarded). `cards` are the
 *   cards of their hand, laid face up in front of them (none when the Princess was the card a Prince made them discard).
 * - `fizzled`: a card of `by` that picks another player was played with no effect, since every other player in the round is protected.
 * - `reveal`: the deck ran out and every player still in laid their hand face up.
 * - `end`: the round is over. `how` says how (`deck`: the highest card won, `last`: one player was left), `winners` won it, `spy` earned the Spy's token.
 * - `over`: the game is over, `winners` won it.
 */
export type LoveLetterEvent =
  | { kind: "round"; number: number; first: string; faceUp: Face[] }
  | { kind: "draw"; by: string; card?: Face }
  | { kind: "play"; by: string; card: Face }
  | { kind: "guess"; by: string; target: string; guess: CharacterKey; hit: boolean }
  | { kind: "look"; by: string; target: string; card?: CharacterKey }
  | { kind: "compare"; by: string; target: string; cards?: { by: CharacterKey; target: CharacterKey } }
  | { kind: "swap"; by: string; target: string; cards?: { by: CharacterKey; target: CharacterKey } }
  | { kind: "protect"; by: string }
  | { kind: "discard"; by: string; player: string; card: Face }
  | { kind: "out"; player: string; cards: Face[]; cause: "guard" | "baron" | "princess" }
  | { kind: "fizzled"; by: string }
  | { kind: "reveal"; hands: { player: string; card: Face }[] }
  | { kind: "end"; how: "deck" | "last"; winners: string[]; spy: string | null }
  | { kind: "over"; winners: string[] }

export type LoveLetterLogEntry = LogEntry<LoveLetterEvent>

/** What a step gives back: the new state and what happened, for the platform to keep (the state keeps no log). */
export type LoveLetterStep = { state: State; events: LoveLetterLogEntry[] }
