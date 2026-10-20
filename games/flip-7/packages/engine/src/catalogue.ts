/**
 * The cards of Flip 7, as data.
 *
 * - `CARDS`: every face of the game, by key. The keys are a contract: they are also the keys of the card types in the Sanity studio
 *   (name, text, artwork), what a `Face` says and what the art files are named after. Append only, never rename.
 * - `DECK`: the box, how many copies of each face: 94 cards.
 * - `CATALOGUE`: every card of the box, one after the other, by face. A card is its index in it; it is never stored (lean state,
 *   PLT-45): the state holds the opaque id each index holds.
 *
 * The rules read the `kind` of a card, and the `effect` of an action card, never its key.
 */

/** What an action card does once it is played on an active player. */
export type ActionEffect = "freeze" | "flip-three" | "second-chance"

/**
 * What a card is, for the rules.
 * - `number`: worth its value. Seven different ones are a Flip 7; a second one of the same value is a bust.
 * - `modifier`: multiplies the number cards by `times`, then adds `plus`. It is no number: it counts for no Flip 7 and cannot bust.
 * - `action`: Freeze, Flip Three or Second Chance (see `ActionEffect`).
 */
export type CardType =
  | { kind: "number"; value: number }
  | { kind: "modifier"; plus: number; times: number }
  | { kind: "action"; effect: ActionEffect }

/** Every face of the game. The order is the one of the studio's card types. */
export const CARDS = {
  "number-0": { kind: "number", value: 0 },
  "number-1": { kind: "number", value: 1 },
  "number-2": { kind: "number", value: 2 },
  "number-3": { kind: "number", value: 3 },
  "number-4": { kind: "number", value: 4 },
  "number-5": { kind: "number", value: 5 },
  "number-6": { kind: "number", value: 6 },
  "number-7": { kind: "number", value: 7 },
  "number-8": { kind: "number", value: 8 },
  "number-9": { kind: "number", value: 9 },
  "number-10": { kind: "number", value: 10 },
  "number-11": { kind: "number", value: 11 },
  "number-12": { kind: "number", value: 12 },
  "plus-2": { kind: "modifier", plus: 2, times: 1 },
  "plus-4": { kind: "modifier", plus: 4, times: 1 },
  "plus-6": { kind: "modifier", plus: 6, times: 1 },
  "plus-8": { kind: "modifier", plus: 8, times: 1 },
  "plus-10": { kind: "modifier", plus: 10, times: 1 },
  "times-2": { kind: "modifier", plus: 0, times: 2 },
  freeze: { kind: "action", effect: "freeze" },
  "flip-three": { kind: "action", effect: "flip-three" },
  "second-chance": { kind: "action", effect: "second-chance" },
} as const satisfies Record<string, CardType>

export type CardKey = keyof typeof CARDS
export type CardKind = CardType["kind"]

/** `copies` cards of the face `type`. */
export type DeckEntry = { type: CardKey; copies: number }

/**
 * The 94 cards of the box: 79 number cards (as many copies of a number as its value, twelve 12s down to one 1, and a single 0), the six
 * score modifiers once each, and three Freeze, three Flip Three and three Second Chance.
 */
export const DECK = [
  { type: "number-0", copies: 1 },
  { type: "number-1", copies: 1 },
  { type: "number-2", copies: 2 },
  { type: "number-3", copies: 3 },
  { type: "number-4", copies: 4 },
  { type: "number-5", copies: 5 },
  { type: "number-6", copies: 6 },
  { type: "number-7", copies: 7 },
  { type: "number-8", copies: 8 },
  { type: "number-9", copies: 9 },
  { type: "number-10", copies: 10 },
  { type: "number-11", copies: 11 },
  { type: "number-12", copies: 12 },
  { type: "plus-2", copies: 1 },
  { type: "plus-4", copies: 1 },
  { type: "plus-6", copies: 1 },
  { type: "plus-8", copies: 1 },
  { type: "plus-10", copies: 1 },
  { type: "times-2", copies: 1 },
  { type: "freeze", copies: 3 },
  { type: "flip-three", copies: 3 },
  { type: "second-chance", copies: 3 },
] as const satisfies readonly DeckEntry[]

/** The face of each card of the box, by catalogue index: the entries of `DECK`, each `copies` times. */
export const CATALOGUE: readonly CardKey[] = DECK.flatMap(({ type, copies }) => Array.from({ length: copies }, () => type))

/** The rules of a face. A key that is not one is a mistake of the caller, not of a player. */
export function cardType(key: string): CardType {
  const type: CardType | undefined = Object.hasOwn(CARDS, key) ? CARDS[key as CardKey] : undefined
  if (type === undefined) throw new RangeError(`Unknown card face "${key}"`)
  return type
}
