import type { SeedDoc } from "@pbgo/content-kit"
import { buildBonusTiles } from "./bonus-tiles.ts"
import { buildCards } from "./cards.ts"
import { buildGame } from "./game.ts"
import { buildRules } from "./rules.ts"
import { buildSettings } from "./settings.ts"
import { buildSuits } from "./suits.ts"

/** Every document the Hanabi seed manages, as fresh objects: a run clones and completes them. */
export function buildSeedDocs(): SeedDoc[] {
  return [...buildSuits(), ...buildCards(), ...buildBonusTiles(), buildGame(), buildRules(), buildSettings()]
}
