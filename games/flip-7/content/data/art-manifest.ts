import { setField } from "@pbgo/content-kit"
import type { ArtSlot } from "@pbgo/content-kit"
import { CARD_TYPE_KEYS, CARD_TYPES, titleOf } from "../../apps/studio/schemaTypes/constants.ts"
import type { CardTypeKey } from "../../apps/studio/schemaTypes/constants.ts"
import { cardTypeId } from "./card-types.ts"
import { GAME_ID } from "./game.ts"
import { SETTINGS_ID } from "./settings.ts"

// Every image the Flip 7 content needs, and where it goes. A file that fills a slot is named after the slot: `number-7.webp`,
// `plus-4.png`, `freeze.png`, `card-back.png`… Case and `_` do not matter, and the figures of the cards are accepted as they are
// (`7.png`, `+4.png`, `x2.png`). See docs/content-pipeline.md.

/** A card is 5:7 (the proportions of the printed cards). */
const CARD_RATIO: [number, number] = [5, 7]

/** The other names a face answers to: the figure printed on the card. */
function aliasesOf(key: CardTypeKey): string[] | undefined {
  if (key.startsWith("number-")) return [key.slice("number-".length)]
  if (key.startsWith("plus-")) return [`+${key.slice("plus-".length)}`]
  if (key === "times-2") return ["x2"]
  return undefined
}

/** One slot per face of the box: 22 faces for the 94 cards, since every copy of a card shares its picture. */
const faceSlots: ArtSlot[] = CARD_TYPE_KEYS.map((key) => ({
  name: key,
  aliases: aliasesOf(key),
  label: `Face of the ${titleOf(CARD_TYPES, key) ?? key}`,
  ratio: CARD_RATIO,
  maxSize: 1400,
  docId: cardTypeId(key),
  place: setField("image"),
}))

const gameSlots: ArtSlot[] = [
  { name: "card-back", aliases: ["back"], label: "Back of the cards", ratio: CARD_RATIO, maxSize: 1400, docId: GAME_ID, place: setField("cardBack") },
  { name: "box-front", label: "Box, front", maxSize: 2000, docId: GAME_ID, place: setField("boxFront") },
  { name: "box-back", label: "Box, back (optional)", maxSize: 2000, docId: GAME_ID, place: setField("boxBack") },
  { name: "mat", label: "Table mat (optional)", maxSize: 2400, docId: GAME_ID, place: setField("mat") },
]

/** The logo is the shared `settings.logo`: the same field as every other game. */
const settingsSlots: ArtSlot[] = [{ name: "logo", label: "Logo", maxSize: 1024, docId: SETTINGS_ID, place: setField("logo") }]

export const ART_SLOTS: ArtSlot[] = [...faceSlots, ...gameSlots, ...settingsSlots]
