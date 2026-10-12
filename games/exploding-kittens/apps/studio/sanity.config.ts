import { createStudioConfig } from "@pbgo/studio-kit"
import { game } from "./schemaTypes/game"

export default createStudioConfig({
  title: "Exploding Kittens",
  projectId: process.env.SANITY_STUDIO_PROJECT_ID ?? "gsfz20b9",
  dataset: process.env.SANITY_STUDIO_DATASET ?? "production",
  gameTypes: [game],
})
