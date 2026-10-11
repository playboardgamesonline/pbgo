import { createStudioConfig } from "@pbgo/studio-kit"
import { game } from "./schemaTypes/game"

export default createStudioConfig({
  title: "7 Wonders",
  projectId: process.env.SANITY_STUDIO_PROJECT_ID ?? "xpof03pw",
  dataset: process.env.SANITY_STUDIO_DATASET ?? "production",
  gameTypes: [game],
})
