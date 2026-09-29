import { createStudioConfig } from "@pgo/studio-kit"
import { game } from "./schemaTypes/game"

export default createStudioConfig({
  title: "Play Game Online",
  projectId: process.env.SANITY_STUDIO_PROJECT_ID ?? "__SANITY_PROJECT_ID__",
  dataset: process.env.SANITY_STUDIO_DATASET ?? "production",
  gameTypes: [game],
})
