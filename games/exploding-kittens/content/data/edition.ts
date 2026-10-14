import { localeString } from "@pbgo/content-kit"
import type { SeedDoc } from "@pbgo/content-kit"
import { CARD_TYPE_KEYS } from "../../apps/studio/schemaTypes/constants.ts"
import type { CardTypeKey } from "../../apps/studio/schemaTypes/constants.ts"

export const EDITION_ORIGINAL_ID = "edition-original"

/** Copies of each card type in the Original Edition deck: 36 action cards and 5 cats of 4 copies each, 56 cards in all. */
export const ORIGINAL_COPIES: Record<CardTypeKey, number> = {
  "exploding-kitten": 4,
  defuse: 6,
  attack: 4,
  skip: 4,
  favor: 4,
  shuffle: 4,
  "see-the-future": 5,
  nope: 5,
  tacocat: 4,
  cattermelon: 4,
  "hairy-potato-cat": 4,
  "beard-cat": 4,
  "rainbow-ralphing-cat": 4,
}

/** The Original Edition, the only deck with data for now (the others are listed in docs/content-pipeline.md). */
export function buildOriginalEdition(): SeedDoc {
  return {
    _id: EDITION_ORIGINAL_ID,
    _type: "edition",
    key: "original",
    name: localeString({ fr: "Édition originale", en: "Original Edition", es: "Edición original", de: "Originalausgabe" }),
    // The `_key` of a line is its card type, so a second run finds the same items.
    cards: CARD_TYPE_KEYS.map((cardType) => ({ _key: cardType, _type: "deckCard", cardType, copies: ORIGINAL_COPIES[cardType] })),
  }
}
