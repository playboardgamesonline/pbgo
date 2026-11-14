import type { SeedDoc } from "@pbgo/content-kit"
import { BAND_KEYS, CARD_KEYS, engineKeyOf } from "../../apps/studio/schemaTypes/constants.ts"
import type { BandKey, CardKey } from "../../apps/studio/schemaTypes/constants.ts"

type CardSpec = {
  /** Cards of this face in the box: 150 in all (rulebook, page 1). */
  quantity: number
  /** The colour the face is printed in. */
  band: BandKey
}

// A card holds no text of its own: what a card does is the engine's, and the rules are the publisher's PDFs linked in `settings`. Every face is the figure printed on it, which its key already says: it has no name, so nothing to translate.
// Five -2, ten -1, fifteen 0 and ten of each from 1 to 12; the bands are the colours of the printed cards (the 16 card images the owner handed over: dark blue -2 and -1, light blue 0, green 1 to 4, yellow 5 to 8, red 9 to 12).
const SPECS: Record<CardKey, CardSpec> = {
  "minus-2": { quantity: 5, band: "dark-blue" },
  "minus-1": { quantity: 10, band: "dark-blue" },
  "0": { quantity: 15, band: "light-blue" },
  "1": { quantity: 10, band: "green" },
  "2": { quantity: 10, band: "green" },
  "3": { quantity: 10, band: "green" },
  "4": { quantity: 10, band: "green" },
  "5": { quantity: 10, band: "yellow" },
  "6": { quantity: 10, band: "yellow" },
  "7": { quantity: 10, band: "yellow" },
  "8": { quantity: 10, band: "yellow" },
  "9": { quantity: 10, band: "red" },
  "10": { quantity: 10, band: "red" },
  "11": { quantity: 10, band: "red" },
  "12": { quantity: 10, band: "red" },
}

/** The `_id` of a card: `card-minus-2`, `card-0`, `card-12`: the key of the engine's catalogue. */
export const cardId = (key: CardKey) => engineKeyOf(key)

/** A card of the game: its key in the Studio, its `_id`, the key the engine catalogue gives it and its place in the list. */
export type CardRef = { key: CardKey; order: number; id: string; engineKey: string }

/** The 15 faces, in the order of the values. */
export const CARD_LIST: CardRef[] = CARD_KEYS.map((key, order) => ({ key, order, id: cardId(key), engineKey: engineKeyOf(key) }))

/** The seed documents of the 15 faces. */
export function buildCards(): SeedDoc[] {
  return CARD_LIST.map(({ key, order, id }) => {
    const { quantity, band } = SPECS[key]
    if (!BAND_KEYS.includes(band)) throw new Error(`Unknown band "${band}"`)
    return { _id: id, _type: "card", key, band, order, quantity }
  })
}
