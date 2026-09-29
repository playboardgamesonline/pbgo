import { createStudioConfig } from "@pgo/studio-kit"
import { game } from "./schemaTypes/game"

export default createStudioConfig({
  title: "Welcome To",
  projectId: process.env.SANITY_STUDIO_PROJECT_ID ?? "ljyif8yt",
  dataset: process.env.SANITY_STUDIO_DATASET ?? "production",
  gameTypes: [game],
})
