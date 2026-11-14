/**
 * The cards of Skyjo, as data.
 *
 * - `CARDS`: every face of the game, by key. The keys are a contract: they are the keys of the card types in the Sanity studio (name,
 *   artwork), what a `Face` says and what the art files are named after. Append only, never rename.
 * - `DECK`: the box, how many copies of each face: 150 cards (rulebook, page 1).
 * - `CATALOGUE`: every card of the box, one after the other, by face. A card is its index in it; it is never stored (lean state, PLT-45):
 *   the state holds the opaque id each index holds.
 *
 * The rules read the `value` of a card, never its key. The colour band is the card's own look (the board paints it), no rule reads it.
 */

/** The colour bands of the faces, from the lowest values to the highest. */
export type Band = "dark-blue" | "light-blue" | "green" | "yellow" | "red"

export type CardType = { value: number }

/** The lowest and the highest value of a card. */
export const MIN_VALUE = -2
export const MAX_VALUE = 12

/** The key of the face worth `value`: `card-minus-2`, `card-0`, `card-12`. */
export function keyOfValue(value: number): CardKey {
  const key = (value < 0 ? `card-minus-${-value}` : `card-${value}`) as CardKey
  if (!(key in CARDS)) throw new RangeError(`No card is worth ${value}`)
  return key
}

/** Every face of the game. The order is the one of the studio's card types. */
export const CARDS = {
  "card-minus-2": { value: -2 },
  "card-minus-1": { value: -1 },
  "card-0": { value: 0 },
  "card-1": { value: 1 },
  "card-2": { value: 2 },
  "card-3": { value: 3 },
  "card-4": { value: 4 },
  "card-5": { value: 5 },
  "card-6": { value: 6 },
  "card-7": { value: 7 },
  "card-8": { value: 8 },
  "card-9": { value: 9 },
  "card-10": { value: 10 },
  "card-11": { value: 11 },
  "card-12": { value: 12 },
} as const satisfies Record<string, CardType>

export type CardKey = keyof typeof CARDS

/** `copies` cards of the face `type`. */
export type DeckEntry = { type: CardKey; copies: number }

/** The 150 cards of the box: five -2, ten -1, fifteen 0 and ten of each value from 1 to 12. */
export const DECK: readonly DeckEntry[] = [
  { type: "card-minus-2", copies: 5 },
  { type: "card-minus-1", copies: 10 },
  { type: "card-0", copies: 15 },
  ...(["card-1", "card-2", "card-3", "card-4", "card-5", "card-6", "card-7", "card-8", "card-9", "card-10", "card-11", "card-12"] as const).map(
    (type): DeckEntry => ({ type, copies: 10 }),
  ),
]

/** Every card of the box, face by face, in the order of `DECK`: a card is its index here. */
export const CATALOGUE: readonly CardKey[] = DECK.flatMap(({ type, copies }) => Array.from({ length: copies }, () => type))

/** The colour band of a value: dark blue -2 and -1, light blue 0, green 1 to 4, yellow 5 to 8, red 9 to 12. */
export function bandOf(value: number): Band {
  if (value < 0) return "dark-blue"
  if (value === 0) return "light-blue"
  if (value <= 4) return "green"
  if (value <= 8) return "yellow"
  return "red"
}

export function cardType(key: CardKey): CardType {
  return CARDS[key]
}
