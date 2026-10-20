import { localeString } from "@pbgo/content-kit"
import type { Localized, SeedDoc } from "@pbgo/content-kit"
import { CATEGORIES, CATEGORY_KEYS, engineKeyOf } from "../../apps/studio/schemaTypes/constants.ts"
import type { CategoryKey, KeyOf } from "../../apps/studio/schemaTypes/constants.ts"

type CardSpec = {
  /** Copies of the card in the box: 94 cards in all (79 numbers, 9 action cards, 6 score modifiers). */
  copies: number
  name: Localized
}

// A card holds no text of its own besides its name: what a card does is the engine's, and the rules are the publisher's PDFs linked in
// `settings`. The names of the numbers and of the modifiers are the figures of the cards. The three action cards keep their English names
// in every language, as printed on the cards.

const same = (text: string): Localized => ({ fr: text, en: text, es: text, de: text })

const numberSpec = (value: number): CardSpec => ({
  copies: Math.max(value, 1),
  name: same(String(value)),
})

// The cards of each category, under the key the Studio lists (`schemaTypes/constants.ts`).
const SPECS: { [C in CategoryKey]: Record<KeyOf[C], CardSpec> } = {
  number: {
    "0": numberSpec(0),
    "1": numberSpec(1),
    "2": numberSpec(2),
    "3": numberSpec(3),
    "4": numberSpec(4),
    "5": numberSpec(5),
    "6": numberSpec(6),
    "7": numberSpec(7),
    "8": numberSpec(8),
    "9": numberSpec(9),
    "10": numberSpec(10),
    "11": numberSpec(11),
    "12": numberSpec(12),
  },
  action: {
    freeze: { copies: 3, name: same("Freeze") },
    "flip-three": { copies: 3, name: same("Flip Three") },
    "second-chance": { copies: 3, name: same("Second Chance") },
  },
  modifier: {
    "plus-2": { copies: 1, name: same("+2") },
    "plus-4": { copies: 1, name: same("+4") },
    "plus-6": { copies: 1, name: same("+6") },
    "plus-8": { copies: 1, name: same("+8") },
    "plus-10": { copies: 1, name: same("+10") },
    "times-2": { copies: 1, name: same("x2") },
  },
}

const idOf = (category: CategoryKey, key: string) => `${category}-card-${key}`

/** The `_id` of a card: `number-card-7`, `action-card-freeze`, `modifier-card-plus-4`. */
export const cardId = <C extends CategoryKey>(category: C, key: KeyOf[C]) => idOf(category, key)

/** A card of the game: its place in the Studio (category and key), its `_id` and the key the engine catalogue gives it. */
export type CardRef = {
  category: CategoryKey
  key: string
  /** Place of the card in its category, from 0: the order of the engine catalogue (`parity/engine.test.ts` checks it). */
  order: number
  id: string
  engineKey: string
}

/** The 22 cards, category by category, in the order of the Studio lists. */
export const CARD_LIST: CardRef[] = CATEGORY_KEYS.flatMap((category) => {
  const choices: { value: string }[] = CATEGORIES[category].choices
  return choices.map(({ value }, order) => ({ category, key: value, order, id: idOf(category, value), engineKey: engineKeyOf(category, value) }))
})

/** The seed documents of the three categories of cards: 13 number cards, 3 action cards and 6 modifier cards. */
export function buildCards(): SeedDoc[] {
  return CARD_LIST.map(({ category, key, order, id }) => {
    const spec = (SPECS[category] as Record<string, CardSpec>)[key]
    if (!spec) throw new Error(`No name for the ${category} card "${key}"`)
    return {
      _id: id,
      _type: CATEGORIES[category].type,
      key,
      order,
      name: localeString(spec.name),
      copies: spec.copies,
    }
  })
}
