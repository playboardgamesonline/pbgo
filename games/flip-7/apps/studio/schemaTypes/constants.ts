// Plain data, no Sanity import: read by the schema, by the seed script (games/flip-7/content) and by its tests.

/**
 * The 22 cards of the game come in three categories, the kinds of the engine (`CardKind` of @flip-7/engine), and each category is a document
 * type of its own: an editor looks for a 7 among the 13 numbers, not among 22 faces. The order is the one of the lists in the Studio.
 */
export const CATEGORY_KEYS = ["number", "action", "modifier"] as const
export type CategoryKey = (typeof CATEGORY_KEYS)[number]

// The key of a card is the simplest name it has within its category, in the order of the engine catalogue (`CARDS`): a number is its figure,
// an action card or a modifier keeps the key of the catalogue. The key is the stable id of the card, the same in Sanity and in the art
// file names. A number card has as many copies in the box as its value, and every copy shares one picture.

export const NUMBER_KEYS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"] as const
export const ACTION_KEYS = ["freeze", "flip-three", "second-chance"] as const
export const MODIFIER_KEYS = ["plus-2", "plus-4", "plus-6", "plus-8", "plus-10", "times-2"] as const

export type NumberKey = (typeof NUMBER_KEYS)[number]
export type ActionKey = (typeof ACTION_KEYS)[number]
export type ModifierKey = (typeof MODIFIER_KEYS)[number]
/** The keys of each category. */
export type KeyOf = { number: NumberKey; action: ActionKey; modifier: ModifierKey }

type Choice<Key extends string> = { title: string; value: Key }

/** What the Studio calls a category of cards: the name of its document type and the cards it lists, as titles and keys. */
export const CATEGORIES: { [C in CategoryKey]: { type: string; title: string; choices: Choice<KeyOf[C]>[] } } = {
  number: {
    type: "numberCard",
    title: "Number card",
    choices: NUMBER_KEYS.map((key) => ({ title: key, value: key })),
  },
  action: {
    type: "actionCard",
    title: "Action card",
    choices: [
      { title: "Freeze", value: "freeze" },
      { title: "Flip Three", value: "flip-three" },
      { title: "Second Chance", value: "second-chance" },
    ],
  },
  modifier: {
    type: "modifierCard",
    title: "Modifier card",
    choices: [
      { title: "+2", value: "plus-2" },
      { title: "+4", value: "plus-4" },
      { title: "+6", value: "plus-6" },
      { title: "+8", value: "plus-8" },
      { title: "+10", value: "plus-10" },
      { title: "x2", value: "times-2" },
    ],
  },
}

/** The key the engine catalogue uses for a card: it names the numbers `number-<figure>` and keeps the others as they are. */
export const engineKeyOf = (category: CategoryKey, key: string) => (category === "number" ? `number-${key}` : key)

export const titleOf = (choices: { title: string; value: string }[], value: unknown) => choices.find((choice) => choice.value === value)?.title
