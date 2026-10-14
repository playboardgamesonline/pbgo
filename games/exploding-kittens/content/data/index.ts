import type { SeedDoc } from "@pbgo/content-kit"
import { buildCardTypes } from "./card-types.ts"
import { buildOriginalEdition } from "./edition.ts"
import { buildGame } from "./game.ts"
import { buildRules } from "./rules.ts"
import { buildSettings } from "./settings.ts"

/** Every document the Exploding Kittens seed manages, as fresh objects: a run clones and completes them. */
export function buildSeedDocs(): SeedDoc[] {
  return [...buildCardTypes(), buildOriginalEdition(), buildGame(), buildRules(), buildSettings()]
}
