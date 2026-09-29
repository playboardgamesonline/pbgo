import { createStudioConfig } from "@pgo/studio-kit"
import { game } from "./schemaTypes/game"

export default createStudioConfig({
  title: "Timebomb",
  projectId: process.env.SANITY_STUDIO_PROJECT_ID ?? "dxlv9oe9",
  dataset: process.env.SANITY_STUDIO_DATASET ?? "production",
  gameTypes: [game],
})
