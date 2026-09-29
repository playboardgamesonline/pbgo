import { createStudioConfig } from "@pgo/studio-kit"
import { game } from "./schemaTypes/game"

export default createStudioConfig({
  title: "Love Letter",
  projectId: process.env.SANITY_STUDIO_PROJECT_ID ?? "fdbxac71",
  dataset: process.env.SANITY_STUDIO_DATASET ?? "production",
  gameTypes: [game],
})
