import { createStudioConfig } from "@pgo/studio-kit"
import { game } from "./schemaTypes/game"

export default createStudioConfig({
  title: "Flip 7",
  projectId: process.env.SANITY_STUDIO_PROJECT_ID ?? "fj3grahy",
  dataset: process.env.SANITY_STUDIO_DATASET ?? "production",
  gameTypes: [game],
})
