import { setField, setItemField } from "@pbgo/content-kit"
import type { ArtSlot } from "@pbgo/content-kit"
import { CARD_TYPE_KEYS, CARD_TYPES, titleOf } from "../../apps/studio/schemaTypes/constants.ts"
import { cardTypeId, illustrationCount, illustrationKey } from "./card-types.ts"
import { GAME_ID } from "./game.ts"
import { SETTINGS_ID } from "./settings.ts"

// Every image the Exploding Kittens content needs, and where it goes. A file that fills a slot is named after the slot:
// `defuse-3.webp`, `nope-5.png`, `tacocat.webp`, `card-back.webp`… Case and `_` do not matter, so the names of the rules spec
// (`DEFUSE_3`, `TACOCAT`, `BACK`) fill the same slots (see docs/content-pipeline.md).

/** A card face is 5:7 (the proportions of the printed cards). */
const CARD_RATIO: [number, number] = [5, 7]

/**
 * One slot per printed illustration: `defuse-1` … `defuse-6`. A type with a single illustration (the five cats) is named without the
 * number (`tacocat`), and `tacocat-1` is accepted too.
 */
const faceSlots: ArtSlot[] = CARD_TYPE_KEYS.flatMap((key) => {
  const title = titleOf(CARD_TYPES, key) ?? key
  const count = illustrationCount(key)
  return Array.from({ length: count }, (_, index): ArtSlot => {
    const number = index + 1
    const single = count === 1
    return {
      name: single ? key : `${key}-${number}`,
      aliases: single ? [`${key}-${number}`] : undefined,
      label: single ? `Face of the ${title}` : `Face of the ${title}, illustration ${number} of ${count}`,
      ratio: CARD_RATIO,
      maxSize: 1400,
      docId: cardTypeId(key),
      place: setItemField("illustrations", illustrationKey(number), "image"),
    }
  })
})

const gameSlots: ArtSlot[] = [
  { name: "card-back", aliases: ["back"], label: "Back of the cards", ratio: CARD_RATIO, maxSize: 1400, docId: GAME_ID, place: setField("cardBack") },
  { name: "box-front", label: "Box, front", maxSize: 2000, docId: GAME_ID, place: setField("boxFront") },
  { name: "box-back", label: "Box, back (optional)", maxSize: 2000, docId: GAME_ID, place: setField("boxBack") },
  { name: "mat", label: "Table mat (optional)", maxSize: 2400, docId: GAME_ID, place: setField("mat") },
]

/** The logo is the shared `settings.logo`: the same field as every other game. */
const settingsSlots: ArtSlot[] = [{ name: "logo", label: "Logo", maxSize: 1024, docId: SETTINGS_ID, place: setField("logo") }]

export const ART_SLOTS: ArtSlot[] = [...faceSlots, ...gameSlots, ...settingsSlots]
