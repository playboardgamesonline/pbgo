/**
 * The cards of Love Letter, as data.
 *
 * - `CARDS`: the ten characters, by key. The keys are a contract: they are the keys of the `character` documents of the Sanity Studio
 *   (`apps/studio/schemaTypes/constants.ts`), what a `Face` says and what the art files are named after, read as they are with no mapping.
 *   Append only, never rename. `content/parity/engine.test.ts` keeps both sides equal.
 * - `DECK`: the box, how many copies of each character: 21 cards (rulebook, p. 2).
 * - `CATALOGUE`: every card of the box, one after the other, by key. A card is its index in it; it is never stored (lean state): the state
 *   holds the opaque id each index holds.
 *
 * The rules read the `value` of a card (the higher value wins a comparison) and how it picks a player (`target`); what a character does when
 * it is played is written in `effects.ts`, by key.
 */

/**
 * How a character picks a player when it is played: `"other"` another player, never the one who plays it (Guard, Priest, Baron, King, pp. 9, 12),
 * `"any"` any player, the one who plays it included (Prince, p. 10), `null` nobody.
 */
export type TargetRule = "other" | "any" | null

/** What the rules know of a character: the number printed on it, and how it picks a player. */
export type CardType = { value: number; target: TargetRule }

/** The ten characters, from the lowest value to the highest (rulebook, p. 2). The order is the one of the Studio's `character` list. */
export const CARDS = {
  spy: { value: 0, target: null },
  guard: { value: 1, target: "other" },
  priest: { value: 2, target: "other" },
  baron: { value: 3, target: "other" },
  handmaid: { value: 4, target: null },
  prince: { value: 5, target: "any" },
  chancellor: { value: 6, target: null },
  king: { value: 7, target: "other" },
  countess: { value: 8, target: null },
  princess: { value: 9, target: null },
} as const satisfies Record<string, CardType>

export type CharacterKey = keyof typeof CARDS

/** The keys of the ten characters, in the order of `CARDS`. */
export const CHARACTER_KEYS = Object.keys(CARDS) as CharacterKey[]

/** The nine characters a Guard can name: any but the Guard, the Spy being a character like the others (rulebook, p. 12). */
export const GUESSES: readonly CharacterKey[] = CHARACTER_KEYS.filter((key) => key !== "guard")

/** `copies` cards of the character `type`. */
export type DeckEntry = { type: CharacterKey; copies: number }

/** The 21 cards of the box: 2 Spies, 6 Guards, 2 Priests, 2 Barons, 2 Handmaids, 2 Princes, 2 Chancellors, a King, a Countess and a Princess (rulebook, p. 2). */
export const DECK: readonly DeckEntry[] = [
  { type: "spy", copies: 2 },
  { type: "guard", copies: 6 },
  { type: "priest", copies: 2 },
  { type: "baron", copies: 2 },
  { type: "handmaid", copies: 2 },
  { type: "prince", copies: 2 },
  { type: "chancellor", copies: 2 },
  { type: "king", copies: 1 },
  { type: "countess", copies: 1 },
  { type: "princess", copies: 1 },
]

/** Every card of the box, character by character, in the order of `DECK`: a card is its index here. */
export const CATALOGUE: readonly CharacterKey[] = DECK.flatMap(({ type, copies }) => Array.from({ length: copies }, () => type))

export function cardType(key: CharacterKey): CardType {
  return CARDS[key]
}
