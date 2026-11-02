import { setField, setRow } from "@pbgo/content-kit"
import type { ArtSlot } from "@pbgo/content-kit"
import { DEFAULT_PLATFORM_LANGUAGE, translatedRowType } from "@pbgo/studio-kit/constants"
import { TRANSLATED_FIELDS } from "../../apps/studio/schemaTypes/constants.ts"
import { ART_SLOTS, type ArtSlot as Picture } from "../notion/types.ts"
import type { NotionExpansion, NotionGame } from "../notion/types.ts"
import type { PublisherRow } from "../notion/reader.ts"
import { gameId, publisherId } from "./ids.ts"
import { publishers } from "./taxonomy.ts"

// The pictures the seed brings in: what the Notion rows hold, a game's logo, icon and background and a publisher's logo. The files go in
// a folder outside the repo, named after the slot they fill (`game-hanabi-logo.png`), which `content/fetch-art.ts` fills and
// `content/seed.ts --art-dir` places. What Notion has no picture for (a cover, the front of a box, a photo, an icon) has no slot.

/** Longest side kept, in pixels (smaller pictures are never enlarged): a logo and an icon are drawn small, a background fills a card. */
const MAX_SIZE: Record<Picture, number> = { logo: 1600, icon: 1024, background: 2400 }
const PUBLISHER_LOGO_SIZE = 1024

/** The name of the file that fills a slot, without its extension: the document, then the field. */
export const slotName = (docId: string, field: string): string => `${docId}-${field}`

/**
 * Where a picture of a game goes: a translated field (the logo, PLT-104) holds one picture per language, and Notion's is the English one, so
 * it goes in the row of English; the icon and the background are the same in every language, and go in the field.
 */
const placeOf = (picture: Picture) => (picture in TRANSLATED_FIELDS.game ? setRow(picture, translatedRowType("image"), DEFAULT_PLATFORM_LANGUAGE) : setField(picture))

/** Every picture a game's row holds, flagged by the reader, as a slot of the seed. */
export function gameSlots(games: readonly NotionGame[]): ArtSlot[] {
  return games.flatMap((game) =>
    ART_SLOTS.filter((picture) => game.art[picture]).map((picture) => ({
      name: slotName(gameId(game.slug), picture),
      label: `${game.name}, ${picture}`,
      maxSize: MAX_SIZE[picture],
      docId: gameId(game.slug),
      place: placeOf(picture),
    })),
  )
}

/** The logo of every publisher that has one in its Editors row, among the publishers the games and the expansions list (the others are not seeded). */
export function publisherSlots(games: readonly Pick<NotionGame, "publishers">[], rows: readonly PublisherRow[]): ArtSlot[] {
  const withLogo = new Set(rows.filter((row) => row.logo !== null).map((row) => publisherId(row.name)))
  return [...publishers(games)]
    .filter(([id]) => withLogo.has(id))
    .map(([id, { name }]) => ({ name: slotName(id, "logo"), label: `${name}, logo`, maxSize: PUBLISHER_LOGO_SIZE, docId: id, place: setField("logo") }))
}

/** All the slots of the seed. An expansion has no slot of its own (Notion holds no cover or box front), only its publishers can bring a logo. */
export const buildSlots = (games: readonly NotionGame[], rows: readonly PublisherRow[], expansions: readonly Pick<NotionExpansion, "publishers">[] = []): ArtSlot[] => [
  ...gameSlots(games),
  ...publisherSlots([...games, ...expansions], rows),
]
