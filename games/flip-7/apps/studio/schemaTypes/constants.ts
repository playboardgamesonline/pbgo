// Plain data, no Sanity import: read by the schema, by the seed script (games/flip-7/content) and by its tests.

/**
 * The faces of the game, in the order of the engine catalogue (`CARDS` of @flip-7/engine). The key is the stable id of a face,
 * kebab-case, the same in the engine, in Sanity and in the art file names. There are 22 faces for the 94 cards of the box: a number
 * card has as many copies as its value, and every copy shares one picture.
 */
export const CARD_TYPE_KEYS = [
  "number-0",
  "number-1",
  "number-2",
  "number-3",
  "number-4",
  "number-5",
  "number-6",
  "number-7",
  "number-8",
  "number-9",
  "number-10",
  "number-11",
  "number-12",
  "plus-2",
  "plus-4",
  "plus-6",
  "plus-8",
  "plus-10",
  "times-2",
  "freeze",
  "flip-three",
  "second-chance",
] as const
export type CardTypeKey = (typeof CARD_TYPE_KEYS)[number]

export const CARD_TYPES: { title: string; value: CardTypeKey }[] = [
  { title: "Number 0", value: "number-0" },
  { title: "Number 1", value: "number-1" },
  { title: "Number 2", value: "number-2" },
  { title: "Number 3", value: "number-3" },
  { title: "Number 4", value: "number-4" },
  { title: "Number 5", value: "number-5" },
  { title: "Number 6", value: "number-6" },
  { title: "Number 7", value: "number-7" },
  { title: "Number 8", value: "number-8" },
  { title: "Number 9", value: "number-9" },
  { title: "Number 10", value: "number-10" },
  { title: "Number 11", value: "number-11" },
  { title: "Number 12", value: "number-12" },
  { title: "Score +2", value: "plus-2" },
  { title: "Score +4", value: "plus-4" },
  { title: "Score +6", value: "plus-6" },
  { title: "Score +8", value: "plus-8" },
  { title: "Score +10", value: "plus-10" },
  { title: "Score x2", value: "times-2" },
  { title: "Freeze", value: "freeze" },
  { title: "Flip Three", value: "flip-three" },
  { title: "Second Chance", value: "second-chance" },
]

/** What a face is for the rules, under the engine's own names and in its order (`CardKind`): a number, a score modifier or an action card. */
export const KIND_KEYS = ["number", "modifier", "action"] as const
export type KindKey = (typeof KIND_KEYS)[number]

export const KINDS: { title: string; value: KindKey }[] = [
  { title: "Number card (a second one of the same number busts)", value: "number" },
  { title: "Score modifier (+2 to +10, x2)", value: "modifier" },
  { title: "Action card (played on an active player)", value: "action" },
]

export const titleOf = (list: { title: string; value: string }[], value: unknown) => list.find((i) => i.value === value)?.title
