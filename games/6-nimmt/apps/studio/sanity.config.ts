import { createStudioConfig } from "@pbgo/studio-kit"
import { game } from "./schemaTypes/game"

export default createStudioConfig({
  title: "6 qui prend !",
  projectId: process.env.SANITY_STUDIO_PROJECT_ID ?? "t5dwtve1",
  dataset: process.env.SANITY_STUDIO_DATASET ?? "production",
  gameTypes: [game],
})
