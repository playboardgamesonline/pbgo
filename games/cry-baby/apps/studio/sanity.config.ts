import { createStudioConfig } from "@pgo/studio-kit"
import { game } from "./schemaTypes/game"

export default createStudioConfig({
  title: "Cry Baby",
  projectId: process.env.SANITY_STUDIO_PROJECT_ID ?? "o2gqqcvf",
  dataset: process.env.SANITY_STUDIO_DATASET ?? "production",
  gameTypes: [game],
})
