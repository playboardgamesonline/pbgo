import { setField, setItemField } from "@pbgo/content-kit"
import type { ArtSlot } from "@pbgo/content-kit"
import { BONUS_TILE_NUMBERS, RANKS, RATING_KEYS, SUIT_KEYS } from "../../apps/studio/schemaTypes/constants.ts"
import { bonusTileId } from "./bonus-tiles.ts"
import { cardId } from "./cards.ts"
import { GAME_ID, ratingItemKey, valueGlyphKey } from "./game.ts"
import { suitId } from "./suits.ts"

// Every image the Hanabi content needs, and where it goes. A file that fills a slot is named after the slot:
// `card-red-3.png`, `card-back.jpg`, `suit-black.svg`, `rating-legendary.png`… (see docs/content-pipeline.md).

/** A card face is 5:7 (the proportions of the printed cards). */
const CARD_RATIO: [number, number] = [5, 7]

/** Other names accepted for a suit in a file name. */
const SUIT_ALIASES: Partial<Record<(typeof SUIT_KEYS)[number], string>> = { multi: "rainbow" }

const suitSlots: ArtSlot[] = SUIT_KEYS.map((suit) => ({
  name: `suit-${suit}`,
  aliases: SUIT_ALIASES[suit] ? [`suit-${SUIT_ALIASES[suit]}`] : undefined,
  label: `Symbol of the ${suit} suit`,
  ratio: [1, 1],
  maxSize: 512,
  docId: suitId(suit),
  place: setField("symbolImage"),
}))

const cardSlots: ArtSlot[] = SUIT_KEYS.flatMap((suit) =>
  RANKS.map((rank) => ({
    name: `card-${suit}-${rank}`,
    aliases: SUIT_ALIASES[suit] ? [`card-${SUIT_ALIASES[suit]}-${rank}`] : undefined,
    label: `Face of the ${suit} ${rank}`,
    ratio: CARD_RATIO,
    maxSize: 1400,
    docId: cardId(suit, rank),
    place: setField("card"),
  })),
)

const gameSlots: ArtSlot[] = [
  { name: "card-back", label: "Back of the cards", ratio: CARD_RATIO, maxSize: 1400, docId: GAME_ID, place: setField("cardBack") },
  { name: "mat", label: "Table mat (optional)", maxSize: 2400, docId: GAME_ID, place: setField("mat") },
  { name: "clue-token", label: "Clue token, available", maxSize: 512, docId: GAME_ID, place: setField("clueToken") },
  { name: "clue-token-spent", label: "Clue token, spent", maxSize: 512, docId: GAME_ID, place: setField("clueTokenSpent") },
  { name: "fuse-token", label: "Fuse token, intact", maxSize: 512, docId: GAME_ID, place: setField("fuseToken") },
  { name: "fuse-token-exploded", label: "Fuse token, exploded", maxSize: 512, docId: GAME_ID, place: setField("fuseTokenExploded") },
]

const valueSlots: ArtSlot[] = RANKS.map((rank) => ({
  name: `value-${rank}`,
  label: `Glyph of the value ${rank}`,
  maxSize: 256,
  docId: GAME_ID,
  place: setItemField("valueGlyphs", valueGlyphKey(rank), "glyph"),
}))

const ratingSlots: ArtSlot[] = RATING_KEYS.map((key) => ({
  name: `rating-${key}`,
  label: `Badge of the "${key}" rating`,
  maxSize: 512,
  docId: GAME_ID,
  place: setItemField("scoreScale", ratingItemKey(key), "badge"),
}))

const bonusSlots: ArtSlot[] = BONUS_TILE_NUMBERS.map((number) => ({
  name: `bonus-${number}`,
  label: `Icon of the bonus tile ${number}`,
  maxSize: 512,
  docId: bonusTileId(number),
  place: setField("icon"),
}))

export const ART_SLOTS: ArtSlot[] = [...suitSlots, ...cardSlots, ...gameSlots, ...valueSlots, ...ratingSlots, ...bonusSlots]
