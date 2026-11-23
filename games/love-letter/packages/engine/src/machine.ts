import { EngineError, type StepContext, closeStep, keyOfId, nextSeat, openStep, playerAt } from "@pbgo/engine-kit"
import { CARDS, CATALOGUE } from "./catalogue"
import { tokensToWin } from "./options"
import type { LoveLetterEvent, LoveLetterStep, State } from "./types"

/**
 * The machinery every rule is written with: one step of the game is `open` (a private copy of the state), a few mutations, then `closeStep` of the kit (the new
 * state and what happened); what happened is noted with `noteEvent`. Nothing mutates the state that came in, and nothing draws from `Math.random`.
 */

/**
 * What a step works on: the kit's context for this game. `s` is a copy of the state: mutate it freely, the state that came in is never touched. `rng` is the stream of
 * the shuffles and of the pick of a first player, `idsRng` the one of the ids of the cards (a side stream: drawing from it never moves `rng`).
 */
export type Ctx = StepContext<State, LoveLetterEvent, "rng" | "idsRng">

/** A step starts here: a copy of the state to mutate, with the two streams picked up where the last step left them. */
export const open = (state: State): Ctx => openStep<State, LoveLetterEvent, "rng" | "idsRng">(state, ["rng", "idsRng"])

/** A step ends here: the two streams are saved back into the state, which comes out with what happened. */
export const close = (ctx: Ctx): LoveLetterStep => closeStep<State, LoveLetterEvent, "rng" | "idsRng">(ctx)

// --- Cards

/** The number printed on the card that holds `id`. */
export function valueOf(s: Pick<State, "ids">, id: number): number {
  return CARDS[keyOfId(s.ids, CATALOGUE, id)].value
}

// --- Players and what they hold

/** The hand of a seat: the array of the state, to mutate in a step. */
export function handOf(s: State, seat: number): number[] {
  const hand = s.hands[seat]
  if (hand === undefined) throw new RangeError(`There is no seat ${seat}`)
  return hand
}

/** The play area of a seat: the cards it played or discarded this round, oldest first. */
export function areaOf(s: State, seat: number): number[] {
  const area = s.areas[seat]
  if (area === undefined) throw new RangeError(`There is no seat ${seat}`)
  return area
}

export function isOut(s: State, seat: number): boolean {
  return s.out[seat] === true
}

/** The seats still in the round, in seat order. */
export function inRound(s: State): number[] {
  return s.seats.flatMap((_, seat) => (isOut(s, seat) ? [] : [seat]))
}

/** The seat that plays after `from`: the next one clockwise that is still in the round (rulebook, p. 5: a player who is out is skipped). `from` itself comes last. */
export function nextInRound(s: State, from: number): number {
  const seat = nextSeat(s.seats.length, from, (other) => isOut(s, other))
  if (seat === null) throw new RangeError("Nobody is left in the round")
  return seat
}

/** The only card of a seat's hand: what a player in the round holds between turns, or once they played the card of their turn. */
export function soleCard(s: State, seat: number): number {
  const hand = handOf(s, seat)
  const [card] = hand
  if (hand.length !== 1 || card === undefined) throw new RangeError(`Seat ${seat} holds ${hand.length} cards, one was expected`)
  return card
}

/** The other players a card of `seat` can pick: still in the round and not protected by a Handmaid, in seat order (rulebook, pp. 5, 11). The player themselves is never in the list. */
export function targetsOf(s: State, seat: number): number[] {
  return inRound(s).filter((other) => other !== seat && s.shielded[other] !== true)
}

/**
 * The ids of the cards the player in `seat` may play now: nothing unless it is their turn, their whole hand on it, but for the Countess alone when the other card
 * of the turn is the King or a Prince (rulebook, p. 9). She can still be played by choice with any other card. The rule is about the two cards of a turn: the
 * Chancellor's three are free (p. 9), and nobody reads the other card when the Countess is played, so nobody can tell whether the play was forced.
 */
export function playableOf(s: State, seat: number): number[] {
  if (s.stage.kind !== "play" || s.turn !== seat) return []
  const hand = handOf(s, seat)
  const countess = hand.find((id) => keyOfId(s.ids, CATALOGUE, id) === "countess")
  const forcing = hand.some((id) => ["king", "prince"].includes(keyOfId(s.ids, CATALOGUE, id)))
  return countess !== undefined && forcing ? [countess] : [...hand]
}

// --- Tokens and the end

/** The favor tokens of each seat: the rounds it won and the Spy's tokens (rulebook, pp. 6, 13). Never stored. */
export function tokensOf(s: State): number[] {
  return s.seats.map((_, seat) => (s.won[seat] ?? 0) + (s.spies[seat] ?? 0))
}

/** The game ends as soon as a player holds the tokens that the number of players asks for (rulebook, p. 7). */
export function isOver(s: State): boolean {
  const needed = tokensToWin(s.seats.length)
  return tokensOf(s).some((tokens) => tokens >= needed)
}

/** The winners of a finished game, in seat order: every player who holds at least the number of tokens, whatever their count above it (the reading validated for p. 7). Nobody while it goes on. */
export function winnersOf(s: State): string[] {
  if (!isOver(s)) return []
  const needed = tokensToWin(s.seats.length)
  const tokens = tokensOf(s)
  return s.seats.filter((_, seat) => (tokens[seat] ?? 0) >= needed)
}

/** How far the game has come, for the HUD: the best player's tokens over the tokens that win, from 0 to 100. */
export function progress(s: State): number {
  return Math.min(100, (100 * Math.max(...tokensOf(s))) / tokensToWin(s.seats.length))
}

/**
 * Who the game waits for. Public: the player of the turn; between two rounds the player who takes the first turn and deals; nobody once the
 * game is over. Never a player who is out.
 */
export function waitingFor(s: State): string[] {
  if (isOver(s)) return []
  return [playerAt(s.seats, s.turn)]
}

/** Gives the engine's own refusal for a step the current state does not allow. */
export function refuse(what: string): EngineError {
  return new EngineError("INVALID_PHASE", `You cannot ${what} now`)
}
