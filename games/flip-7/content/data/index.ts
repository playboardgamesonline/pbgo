import type { SeedDoc } from "@pbgo/content-kit"
import { buildCards } from "./cards.ts"
import { buildGame } from "./game.ts"
import { buildSettings } from "./settings.ts"
import { buildTexts } from "./texts.ts"

/** Every document the Flip 7 seed manages, as fresh objects: a run clones and completes them. */
export function buildSeedDocs(): SeedDoc[] {
  return [...buildCards(), buildGame(), buildSettings(), buildTexts()]
}
