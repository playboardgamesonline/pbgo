import type { SeedDoc } from "@pbgo/content-kit"

export const GAME_ID = "game"

/**
 * The `game` singleton. It holds images and one file only (the card back, the favor token's symbol and mask and its 3D model, the mat), which come with the art, so the seed creates it empty:
 * the art slots need a document to fill, and the Studio shows it from the start.
 */
export function buildGame(): SeedDoc {
  return { _id: GAME_ID, _type: "game" }
}
