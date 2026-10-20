import type { CardType } from "./catalogue"

/**
 * What the cards in front of a player are worth. Pure: it reads the rules of the cards, never a state.
 *
 * The order of the booklet ("Calculate scores as follows"): add the number cards; double that sum when the x2 is there; add the
 * +2…+10 modifiers; then 15 more when the line holds seven different numbers. A player who busted scores nothing: that is decided
 * where the status is known (`roundScore` in machine.ts), not here.
 */

/** Different number cards that make a Flip 7: they end the round at once. */
export const FLIP_7 = 7

/** What a Flip 7 is worth on top of the cards. */
export const FLIP_7_BONUS = 15

/** The values of the number cards of a line, in the order they came. */
export function numberValues(cards: readonly CardType[]): number[] {
  return cards.flatMap((card) => (card.kind === "number" ? [card.value] : []))
}

/** Seven different numbers or more. Modifiers and action cards never count. */
export function isFlip7(cards: readonly CardType[]): boolean {
  return new Set(numberValues(cards)).size >= FLIP_7
}

/** The points of a line that did not bust. */
export function lineScore(cards: readonly CardType[]): number {
  let sum = 0
  let plus = 0
  let times = 1
  for (const card of cards) {
    if (card.kind === "number") sum += card.value
    else if (card.kind === "modifier") {
      plus += card.plus
      times *= card.times
    }
  }
  return sum * times + plus + (isFlip7(cards) ? FLIP_7_BONUS : 0)
}
