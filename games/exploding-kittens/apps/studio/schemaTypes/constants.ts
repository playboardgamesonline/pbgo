// Plain data, no Sanity import: read by the schema, by the seed script (games/exploding-kittens/content) and by its tests.

/**
 * The 13 card types come in five categories, the kinds of the engine (`CardKind` of @exploding-kittens/engine), and each category is a
 * document type of its own: an editor looks for the Attack among the 5 actions, not among 13 faces. The order is the one of the engine
 * catalogue (`CARDS`) and of the lists in the Studio. The kitten, the Defuse and the Nope each have a list to themselves, with one card
 * type for now: the engine reads them as kinds of their own, and a new card type of the same kind joins its list.
 */
export const CATEGORY_KEYS = ["kitten", "defuse", "action", "nope", "cat"] as const
export type CategoryKey = (typeof CATEGORY_KEYS)[number]

// The key of a card type is the id the engine catalogue gives it, in kebab-case: the same in the engine, in Sanity and in the art file names,
// and the simplest name the card has within its category. The five cats are the ones of the Original Edition.

export const KITTEN_KEYS = ["exploding-kitten"] as const
export const DEFUSE_KEYS = ["defuse"] as const
export const ACTION_KEYS = ["attack", "skip", "favor", "shuffle", "see-the-future"] as const
export const NOPE_KEYS = ["nope"] as const
export const CAT_KEYS = ["tacocat", "cattermelon", "hairy-potato-cat", "beard-cat", "rainbow-ralphing-cat"] as const

/** The keys of each category. */
export type KeyOf = {
  kitten: (typeof KITTEN_KEYS)[number]
  defuse: (typeof DEFUSE_KEYS)[number]
  action: (typeof ACTION_KEYS)[number]
  nope: (typeof NOPE_KEYS)[number]
  cat: (typeof CAT_KEYS)[number]
}

type Choice<Key extends string> = { title: string; value: Key }

/** What the Studio calls a category of cards: the name of its document type and the card types it lists, as titles and keys. */
export const CATEGORIES: { [C in CategoryKey]: { type: string; title: string; choices: Choice<KeyOf[C]>[] } } = {
  kitten: {
    type: "kittenCard",
    title: "Kitten card",
    choices: [{ title: "Exploding Kitten", value: "exploding-kitten" }],
  },
  defuse: {
    type: "defuseCard",
    title: "Defuse card",
    choices: [{ title: "Defuse", value: "defuse" }],
  },
  action: {
    type: "actionCard",
    title: "Action card",
    choices: [
      { title: "Attack", value: "attack" },
      { title: "Skip", value: "skip" },
      { title: "Favor", value: "favor" },
      { title: "Shuffle", value: "shuffle" },
      { title: "See the Future", value: "see-the-future" },
    ],
  },
  nope: {
    type: "nopeCard",
    title: "Nope card",
    choices: [{ title: "Nope", value: "nope" }],
  },
  cat: {
    type: "catCard",
    title: "Cat card",
    choices: [
      { title: "Tacocat", value: "tacocat" },
      { title: "Cattermelon", value: "cattermelon" },
      { title: "Hairy Potato Cat", value: "hairy-potato-cat" },
      { title: "Beard Cat", value: "beard-cat" },
      { title: "Rainbow-Ralphing Cat", value: "rainbow-ralphing-cat" },
    ],
  },
}

/** Every card type, in the order of the engine catalogue (GAM-7 `CARDS`): the categories one after the other. */
export const CARD_TYPE_KEYS = [...KITTEN_KEYS, ...DEFUSE_KEYS, ...ACTION_KEYS, ...NOPE_KEYS, ...CAT_KEYS] as const
export type CardTypeKey = (typeof CARD_TYPE_KEYS)[number]

/** The same card types as the choices of a dropdown: the lines of an edition pick theirs among all the categories. */
export const CARD_TYPES: Choice<CardTypeKey>[] = CATEGORY_KEYS.flatMap((category): Choice<CardTypeKey>[] => CATEGORIES[category].choices)

type Place = { category: CategoryKey; order: number }

/** Where each card type is filed: its category, and its place there from 0 (the order of the catalogue, the one of the list in the Studio). */
export const PLACES = Object.fromEntries(
  CATEGORY_KEYS.flatMap((category) => {
    const choices: { value: string }[] = CATEGORIES[category].choices
    return choices.map(({ value }, order) => [value, { category, order }])
  }),
) as Record<CardTypeKey, Place>

/** The decks. Only the Original Edition has data; the other editions are listed in docs/content-pipeline.md and get a key here when their data is written. */
export const EDITION_KEYS = ["original"] as const
export type EditionKey = (typeof EDITION_KEYS)[number]

export const EDITIONS: { title: string; value: EditionKey }[] = [{ title: "Original Edition", value: "original" }]

export const titleOf = (list: { title: string; value: string }[], value: unknown) => list.find((i) => i.value === value)?.title
