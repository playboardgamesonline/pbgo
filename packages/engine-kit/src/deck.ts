import { shuffle, type Rng } from "./rng"

/**
 * Draw piles. A pile is an array of cards (ids, see `ids`) with the **top first**: `pile[0]` is the card drawn next and the last
 * element is the bottom. The deck and the discard follow the same convention: the top of the discard is the card discarded last.
 *
 * Every function returns new arrays and leaves its input alone, so `{ ...state, ...result.piles }` is the state with the new
 * piles. Whatever needs a random number takes a `Rng`: restore it from the state (`restoreRng`) and save its position again
 * afterwards (`save()`), so that the same seed and the same actions always deal the same cards.
 */

/** The two piles of a game: what `reshuffleDiscard` and `drawWithReshuffle` take and return. */
export type Piles<T = number> = { deck: T[]; discard: T[] }

type PilesIn<T> = { readonly deck: readonly T[]; readonly discard: readonly T[] }

function whole(value: number, what: string): number {
  if (!Number.isInteger(value) || value < 0) throw new RangeError(`${what} is a non-negative integer, got ${String(value)}`)
  return value
}

/** Takes `count` cards from the top of `pile`: all of them when it holds fewer (the caller sees it in `drawn.length`). */
export function draw<T = number>(pile: readonly T[], count = 1): { drawn: T[]; pile: T[] } {
  whole(count, "The number of cards to draw")
  return { drawn: pile.slice(0, count), pile: pile.slice(count) }
}

/** The `count` cards on top of `pile`, left where they are (a player looking at the top of the deck). */
export function peek<T = number>(pile: readonly T[], count = 1): T[] {
  whole(count, "The number of cards to look at")
  return pile.slice(0, count)
}

/**
 * `pile` with `card` slid in so that `position` cards stay above it: 0 puts it on top, `pile.length` at the bottom (a card put
 * back into the deck, a card put on the discard). Throws a `RangeError` outside that range: the game checked the player's choice.
 * A card that goes back into hiding gets a new id first (`reissueId`).
 */
export function insertAt<T = number>(pile: readonly T[], card: T, position: number): T[] {
  if (!Number.isInteger(position) || position < 0 || position > pile.length) {
    throw new RangeError(`A position in a pile of ${pile.length} cards is an integer from 0 to ${pile.length}, got ${String(position)}`)
  }
  return [...pile.slice(0, position), card, ...pile.slice(position)]
}

/**
 * Shuffles the discard and puts it under what is left of the deck. The `keep` cards on top of the discard stay where they are
 * (Skyjo keeps its visible card: `keep: 1`). Nothing is drawn from `rng` when there are fewer than two cards to shuffle.
 */
export function reshuffleDiscard<T = number>(piles: PilesIn<T>, rng: Rng, options: { keep?: number } = {}): Piles<T> {
  const keep = whole(options.keep ?? 0, "The number of discards to keep")
  return { deck: [...piles.deck, ...shuffle(piles.discard.slice(keep), rng)], discard: piles.discard.slice(0, keep) }
}

/**
 * Draws `count` cards. When the deck runs out in the middle of the draw, the discard is reshuffled once (`reshuffleDiscard`,
 * same `keep`) and the draw goes on; never before, so a deck that holds exactly `count` cards is not reshuffled. Fewer cards
 * than asked come back only when both piles are exhausted: the game decides what that means (it ends the round, most of the time).
 */
export function drawWithReshuffle<T = number>(
  piles: PilesIn<T>,
  count: number,
  rng: Rng,
  options: { keep?: number } = {},
): { drawn: T[]; piles: Piles<T> } {
  const first = draw(piles.deck, count)
  if (first.drawn.length === count) return { drawn: first.drawn, piles: { deck: first.pile, discard: [...piles.discard] } }
  const refilled = reshuffleDiscard({ deck: first.pile, discard: piles.discard }, rng, options)
  const rest = draw(refilled.deck, count - first.drawn.length)
  return { drawn: [...first.drawn, ...rest.drawn], piles: { deck: rest.pile, discard: refilled.discard } }
}

/**
 * Deals `size` cards to each of `seats` seats, one seat after the other: `hands[seat]` holds the cards at positions
 * `seat * size` to `(seat + 1) * size - 1` of the pile. Throws a `RangeError` when the pile is too short, rather than dealing
 * uneven hands: a game checks its deck before.
 */
export function deal<T = number>(pile: readonly T[], seats: number, size: number): { hands: T[][]; pile: T[] } {
  whole(seats, "The number of seats")
  whole(size, "The size of a hand")
  if (seats * size > pile.length) throw new RangeError(`Cannot deal ${size} cards to ${seats} seats from a pile of ${pile.length}`)
  return { hands: Array.from({ length: seats }, (_, seat) => pile.slice(seat * size, (seat + 1) * size)), pile: pile.slice(seats * size) }
}
