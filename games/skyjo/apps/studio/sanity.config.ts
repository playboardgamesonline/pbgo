import { createStudioConfig } from "@pbgo/studio-kit"
import { game } from "./schemaTypes/game"

export default createStudioConfig({
  title: "Skyjo",
  projectId: process.env.SANITY_STUDIO_PROJECT_ID ?? "p5sgvh5w",
  dataset: process.env.SANITY_STUDIO_DATASET ?? "production",
  gameTypes: [game],
})
