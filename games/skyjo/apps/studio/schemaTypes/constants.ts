// Plain data, no Sanity import: read by the schema, by the seed script (games/skyjo/content) and by its tests.

/**
 * The 15 faces of the game: -2, -1, 0 and 1 to 12. They are one kind of card, so one document type and one list in the Studio (`card`). What groups them is their colour band, a dropdown on each card, in the order of the values.
 * The key of a card is the simplest name it has: the figure, with `minus-` for a negative one (`minus-2`, `0`, `12`). It is the stable id of the card, the same in Sanity and in the art file names, and `engineKeyOf` gives the key of the engine's
 * catalogue (`card-minus-2`, `card-7`).
 */
export const CARD_KEYS = ["minus-2", "minus-1", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"] as const
export type CardKey = (typeof CARD_KEYS)[number]

/** The colour bands of the faces, lowest values first: the colour each card is printed in. */
export const BAND_KEYS = ["dark-blue", "light-blue", "green", "yellow", "red"] as const
export type BandKey = (typeof BAND_KEYS)[number]

export const BANDS: { title: string; value: BandKey }[] = [
  { title: "Dark blue (-2 and -1)", value: "dark-blue" },
  { title: "Light blue (0)", value: "light-blue" },
  { title: "Green (1 to 4)", value: "green" },
  { title: "Yellow (5 to 8)", value: "yellow" },
  { title: "Red (9 to 12)", value: "red" },
]

/** What the Studio lists a card under: the figure printed on it. */
export const CARD_CHOICES: { title: string; value: CardKey }[] = CARD_KEYS.map((key) => ({ title: key.replace("minus-", "-"), value: key }))

/** The key the engine catalogue uses for a card (`CARDS` of @skyjo/engine). */
export const engineKeyOf = (key: string) => `card-${key}`

export const titleOf = (choices: { title: string; value: string }[], value: unknown) => choices.find((choice) => choice.value === value)?.title
