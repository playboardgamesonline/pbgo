import { setField } from "@pbgo/content-kit"
import type { ArtSlot } from "@pbgo/content-kit"
import { CARD_CHOICES, titleOf } from "../../apps/studio/schemaTypes/constants.ts"
import { CARD_LIST } from "./cards.ts"
import { GAME_ID } from "./game.ts"
import { SETTINGS_ID } from "./settings.ts"

// Every image the Skyjo content needs, and where it goes. A file that fills a slot is named after the slot: `card-minus-2.svg`, `card-7.svg`, `card-back.svg`… Case and `_` do not matter, and the names of the 16 card images the owner handed over (`skyjo-minus-2`,
// `skyjo-7`, `skyjo-back`) fill their slots as they are, through the aliases below. The art folder is outside the repo (the owner's own: `/mnt/session/outputs/skyjo-cards` held the first 16 SVGs) and is passed with an absolute `--art-dir`.
// See docs/content-pipeline.md.

/** A card is 296 by 476: the proportions of the printed cards (the card images are SVG files with a raster inside). */
const CARD_RATIO: [number, number] = [296, 476]

/** One slot per face of the box: 15 faces for the 150 cards, since every copy of a face shares its picture. The slot is named after the key of the engine catalogue. */
const faceSlots: ArtSlot[] = CARD_LIST.map(({ key, id, engineKey }) => ({
  name: engineKey,
  aliases: [`skyjo-${key}`, key],
  label: `Face of the card ${titleOf(CARD_CHOICES, key) ?? key}`,
  ratio: CARD_RATIO,
  maxSize: 1400,
  docId: id,
  place: setField("image"),
}))

const gameSlots: ArtSlot[] = [
  { name: "card-back", aliases: ["skyjo-back", "back"], label: "Back of the cards", ratio: CARD_RATIO, maxSize: 1400, docId: GAME_ID, place: setField("cardBack") },
]

/** The logo is the shared `settings.logo`: the same field as every other game. */
const settingsSlots: ArtSlot[] = [{ name: "logo", label: "Logo", maxSize: 1024, docId: SETTINGS_ID, place: setField("logo") }]

export const ART_SLOTS: ArtSlot[] = [...faceSlots, ...gameSlots, ...settingsSlots]
