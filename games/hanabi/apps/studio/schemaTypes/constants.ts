// Plain data, no Sanity import: read by the schema, by the seed script (games/hanabi/content) and by its tests.

/** The seven suits of the 70-card deck: five colors, the multicolor suit (Avalanche of Colors) and the black suit (Black Powder). */
export const SUIT_KEYS = ["white", "red", "blue", "yellow", "green", "multi", "black"] as const
export type SuitKey = (typeof SUIT_KEYS)[number]

export const SUITS: { title: string; value: SuitKey }[] = [
  { title: "White", value: "white" },
  { title: "Red", value: "red" },
  { title: "Blue", value: "blue" },
  { title: "Yellow", value: "yellow" },
  { title: "Green", value: "green" },
  { title: "Multicolor", value: "multi" },
  { title: "Black", value: "black" },
]

/** Which box a suit comes from: the base game or one of the two card extensions. */
export const EXTENSION_KEYS = ["base", "avalanche", "blackPowder"] as const
export type ExtensionKey = (typeof EXTENSION_KEYS)[number]

export const EXTENSIONS: { title: string; value: ExtensionKey }[] = [
  { title: "Base game", value: "base" },
  { title: "Avalanche of Colors (multicolor)", value: "avalanche" },
  { title: "Black Powder", value: "blackPowder" },
]

/** The black firework is built downwards (5 to 1), every other one upwards (1 to 5). */
export const DIRECTION_KEYS = ["ascending", "descending"] as const
export type DirectionKey = (typeof DIRECTION_KEYS)[number]

export const DIRECTIONS: { title: string; value: DirectionKey }[] = [
  { title: "Ascending (1 to 5)", value: "ascending" },
  { title: "Descending (5 to 1)", value: "descending" },
]

/** Second non-colour channel next to the symbol and the letter, so that no suit relies on its colour alone. */
export const PATTERN_KEYS = ["none", "solid", "dots", "diagonal-hatch", "stripes", "rainbow-stripes", "crosshatch"] as const
export type PatternKey = (typeof PATTERN_KEYS)[number]

export const PATTERNS: { title: string; value: PatternKey }[] = [
  { title: "None", value: "none" },
  { title: "Solid", value: "solid" },
  { title: "Dots", value: "dots" },
  { title: "Diagonal hatch", value: "diagonal-hatch" },
  { title: "Horizontal stripes", value: "stripes" },
  { title: "Rainbow stripes", value: "rainbow-stripes" },
  { title: "Crosshatch", value: "crosshatch" },
]

export const RANKS = [1, 2, 3, 4, 5] as const
export type Rank = (typeof RANKS)[number]

/** Final score ratings, lowest first. The key is the stable id of the rating, the label and the line are localized. */
export const RATING_KEYS = ["risible", "mediocre", "honorable", "excellent", "extraordinary", "legendary", "divine"] as const
export type RatingKey = (typeof RATING_KEYS)[number]

/** Tiles of the 5 Flamboyants extension, numbered as in the box. */
export const BONUS_TILE_NUMBERS = [1, 2, 3, 4, 5, 6] as const
export type BonusTileNumber = (typeof BONUS_TILE_NUMBERS)[number]

export const titleOf = (list: { title: string; value: string }[], value: unknown) => list.find((i) => i.value === value)?.title
