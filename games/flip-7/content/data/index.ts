import type { SeedDoc } from "@pbgo/content-kit"
import { buildCardTypes } from "./card-types.ts"
import { buildGame } from "./game.ts"
import { buildSettings } from "./settings.ts"

/** Every document the Flip 7 seed manages, as fresh objects: a run clones and completes them. */
export function buildSeedDocs(): SeedDoc[] {
  return [...buildCardTypes(), buildGame(), buildSettings()]
}
