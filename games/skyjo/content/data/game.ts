import type { SeedDoc } from "@pbgo/content-kit"

export const GAME_ID = "game"

/**
 * The `game` singleton. It holds the card back only, which comes with the art, so the seed creates it empty: the art slot needs a document to fill, and the Studio shows it from the start.
 */
export function buildGame(): SeedDoc {
  return { _id: GAME_ID, _type: "game" }
}
