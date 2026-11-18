import { createStudioConfig } from "@pbgo/studio-kit"
import { game } from "./schemaTypes/game"

export default createStudioConfig({
  title: "Love Letter",
  projectId: process.env.SANITY_STUDIO_PROJECT_ID ?? "8h6tuu2t",
  dataset: process.env.SANITY_STUDIO_DATASET ?? "production",
  gameTypes: [game],
})
