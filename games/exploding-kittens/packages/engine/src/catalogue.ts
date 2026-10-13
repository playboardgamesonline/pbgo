import type { OptionValues } from "@pbgo/engine-kit"

/**
 * The cards of the game, as data.
 *
 * - `CARDS`: every type of card, by key. The keys are a contract: they are also the keys of the card types in the Sanity studio
 *   (name, text, artwork), and what a `Face` and the title a triple names say. Append only, never rename.
 * - `DECKS`: the decks (Original Edition now, the other editions and the expansions later): how many copies of each type.
 * - The catalogue of a table is every card of the decks its options select, one after the other. A card is its index in it; it
 *   is never stored, it is rebuilt with `buildCatalogue` (lean state).
 *
 * The rules switch on the `kind` of a card (or on its `effect`), never on its name. A new deck is data: new entries in `CARDS`
 * and a `DECKS` entry, plus an entry in `EFFECTS` for any behaviour the game does not have yet.
 */

/**
 * What a card is, for the rules.
 * - `kitten`: an Exploding Kitten. Never in a hand, never played, never taken back from the discard.
 * - `defuse`: answers a drawn Kitten. Never played on its own.
 * - `nope`: answers an action, inside a Nope window.
 * - `action`: played on its turn; its `effect` says what it does.
 * - `cat`: no effect of its own; it only counts in combos.
 */
export type CardKind = "kitten" | "defuse" | "nope" | "action" | "cat"

export type CardType = {
  kind: CardKind
  /** `action` cards: the key of the effect in `EFFECTS`. */
  effect?: string
}

/** `copies` cards of the type `type` (a key of the cards of the rules). */
export type DeckEntry = { type: string; copies: number }

/** Every card of the Original Edition. The order is the one of the studio's card types. */
export const CARDS = {
  "exploding-kitten": { kind: "kitten" },
  defuse: { kind: "defuse" },
  attack: { kind: "action", effect: "attack" },
  skip: { kind: "action", effect: "skip" },
  favor: { kind: "action", effect: "favor" },
  shuffle: { kind: "action", effect: "shuffle" },
  "see-the-future": { kind: "action", effect: "see-the-future" },
  nope: { kind: "nope" },
  tacocat: { kind: "cat" },
  cattermelon: { kind: "cat" },
  "hairy-potato-cat": { kind: "cat" },
  "beard-cat": { kind: "cat" },
  "rainbow-ralphing-cat": { kind: "cat" },
} as const satisfies Record<string, CardType>

export type CardKey = keyof typeof CARDS

/** The decks, by id. The Original Edition is 56 cards. */
export const DECKS = {
  original: [
    { type: "exploding-kitten", copies: 4 },
    { type: "defuse", copies: 6 },
    { type: "attack", copies: 4 },
    { type: "skip", copies: 4 },
    { type: "favor", copies: 4 },
    { type: "shuffle", copies: 4 },
    { type: "see-the-future", copies: 5 },
    { type: "nope", copies: 5 },
    { type: "tacocat", copies: 4 },
    { type: "cattermelon", copies: 4 },
    { type: "hairy-potato-cat", copies: 4 },
    { type: "beard-cat", copies: 4 },
    { type: "rainbow-ralphing-cat", copies: 4 },
  ],
} as const satisfies Record<string, readonly DeckEntry[]>

/** What `buildCatalogue` needs of the rules. */
export type CatalogueRules = {
  cards: Record<string, CardType>
  decks: Record<string, readonly DeckEntry[]>
  /** The decks of a table, in order, from its options. */
  selectDecks: (options: OptionValues) => readonly string[]
}

/**
 * The type of each card of a table, by catalogue index: the decks the options select, one after the other, each entry
 * `copies` times. Pure, so the same options always give the same catalogue.
 */
export function buildCatalogue(rules: CatalogueRules, options: OptionValues): string[] {
  const types: string[] = []
  for (const deckId of rules.selectDecks(options)) {
    const deck = rules.decks[deckId]
    if (!deck) throw new RangeError(`Unknown deck "${deckId}"`)
    for (const { type, copies } of deck) {
      if (!Object.hasOwn(rules.cards, type)) throw new RangeError(`Deck "${deckId}" holds a card that does not exist: "${type}"`)
      if (!Number.isInteger(copies) || copies < 0) throw new RangeError(`Deck "${deckId}": ${copies} copies of "${type}"`)
      for (let i = 0; i < copies; i++) types.push(type)
    }
  }
  return types
}
