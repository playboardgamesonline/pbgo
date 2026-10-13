// Plain data, no Sanity import: read by the schema, by the seed script (games/exploding-kittens/content) and by its tests.

/**
 * The card types, in the order of the engine catalogue (GAM-7 `CARDS`). The key is the stable id of a type, kebab-case, the same
 * in the engine, in Sanity and in the art file names. The five cats are the ones of the Original Edition.
 */
export const CARD_TYPE_KEYS = [
  "exploding-kitten",
  "defuse",
  "attack",
  "skip",
  "favor",
  "shuffle",
  "see-the-future",
  "nope",
  "tacocat",
  "cattermelon",
  "hairy-potato-cat",
  "beard-cat",
  "rainbow-ralphing-cat",
] as const
export type CardTypeKey = (typeof CARD_TYPE_KEYS)[number]

export const CARD_TYPES: { title: string; value: CardTypeKey }[] = [
  { title: "Exploding Kitten", value: "exploding-kitten" },
  { title: "Defuse", value: "defuse" },
  { title: "Attack", value: "attack" },
  { title: "Skip", value: "skip" },
  { title: "Favor", value: "favor" },
  { title: "Shuffle", value: "shuffle" },
  { title: "See the Future", value: "see-the-future" },
  { title: "Nope", value: "nope" },
  { title: "Tacocat", value: "tacocat" },
  { title: "Cattermelon", value: "cattermelon" },
  { title: "Hairy Potato Cat", value: "hairy-potato-cat" },
  { title: "Beard Cat", value: "beard-cat" },
  { title: "Rainbow-Ralphing Cat", value: "rainbow-ralphing-cat" },
]

/** What a card is for the rules: the kitten that eliminates, the card that saves from it, an action of one's own turn, a reaction played out of turn, or a cat (combos only). */
export const KIND_KEYS = ["bomb", "defuse", "action", "reaction", "cat"] as const
export type KindKey = (typeof KIND_KEYS)[number]

export const KINDS: { title: string; value: KindKey }[] = [
  { title: "Bomb (eliminates)", value: "bomb" },
  { title: "Defuse (saves from the bomb)", value: "defuse" },
  { title: "Action (played on your turn)", value: "action" },
  { title: "Reaction (played out of turn)", value: "reaction" },
  { title: "Cat (combos only)", value: "cat" },
]

/** The decks. Only the Original Edition has data; the other editions are listed in docs/content-pipeline.md and get a key here when their data is written. */
export const EDITION_KEYS = ["original"] as const
export type EditionKey = (typeof EDITION_KEYS)[number]

export const EDITIONS: { title: string; value: EditionKey }[] = [{ title: "Original Edition", value: "original" }]

export const titleOf = (list: { title: string; value: string }[], value: unknown) => list.find((i) => i.value === value)?.title
