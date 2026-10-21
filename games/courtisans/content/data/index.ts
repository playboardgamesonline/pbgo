import type { SeedDoc } from "@pbgo/content-kit"
import { buildFamilies } from "./families.ts"
import { buildMissions } from "./missions.ts"
import { buildRoles } from "./roles.ts"
import { buildTexts } from "./texts.ts"

/** Every document the Courtisans seed manages, as fresh objects: a run clones and completes them. */
export function buildSeedDocs(): SeedDoc[] {
  return [...buildFamilies(), ...buildRoles(), ...buildMissions(), buildTexts()]
}
