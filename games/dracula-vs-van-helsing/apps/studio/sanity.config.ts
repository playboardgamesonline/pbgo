import { createStudioConfig } from "@pbgo/studio-kit"
import { game } from "./schemaTypes/game"

export default createStudioConfig({
  title: "Dracula vs Van Helsing",
  projectId: process.env.SANITY_STUDIO_PROJECT_ID ?? "8kl9j1dh",
  dataset: process.env.SANITY_STUDIO_DATASET ?? "production",
  gameTypes: [game],
})
