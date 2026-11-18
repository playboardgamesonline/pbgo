import { setField } from "@pbgo/content-kit"
import type { ArtSlot } from "@pbgo/content-kit"
import { CHARACTERS, titleOf } from "../../apps/studio/schemaTypes/constants.ts"
import { CHARACTER_LIST } from "./characters.ts"
import { GAME_ID } from "./game.ts"
import { SETTINGS_ID } from "./settings.ts"

// Every image the Love Letter content needs, and where it goes. A file that fills a slot is named after the slot: `spy.png`, `card-back.png`, `logo.png`… Case and `_` do not matter, and the names of the owner's files fill their slots as they
// are: `CARD_SPY.png` to `CARD_PRINCESS.png` (the alias `card-<key>`), `CARD_BACK.png` and `LOGO_LOVE_LETTER.png`. The favor token is its 3D model (`FAVOR_TOKEN.glb`), a file, not an image: the seed
// does not place it, it is dropped on its field in the Studio (the owner wants no symbol and no mask). The art folder is outside the repo and is passed with an absolute `--art-dir`. See docs/content-pipeline.md.

/** The faces and the back are 760 by 1060 (38:53, within 0.4 % of 5:7): the owner's blank plates, the name and the text are drawn by the board from the Studio. */
const CARD_RATIO: [number, number] = [760, 1060]

/** One slot per character: ten faces for the 21 cards, since every copy of a character shares its picture. The slot is named after the key of the character. */
const faceSlots: ArtSlot[] = CHARACTER_LIST.map(({ key, id }) => ({
  name: key,
  aliases: [`card-${key}`],
  label: `Face of the ${titleOf(CHARACTERS, key) ?? key}`,
  ratio: CARD_RATIO,
  maxSize: 1400,
  docId: id,
  place: setField("image"),
}))

const gameSlots: ArtSlot[] = [
  { name: "card-back", aliases: ["back"], label: "Back of the cards", ratio: CARD_RATIO, maxSize: 1400, docId: GAME_ID, place: setField("cardBack") },
  { name: "mat", label: "Table mat (optional)", maxSize: 2400, docId: GAME_ID, place: setField("mat") },
]

/** The logo is the shared `settings.logo`: the same field as every other game. */
const settingsSlots: ArtSlot[] = [{ name: "logo", aliases: ["logo-love-letter"], label: "Logo", maxSize: 1024, docId: SETTINGS_ID, place: setField("logo") }]

export const ART_SLOTS: ArtSlot[] = [...faceSlots, ...gameSlots, ...settingsSlots]
