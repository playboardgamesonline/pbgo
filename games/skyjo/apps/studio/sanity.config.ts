import { createStudioConfig } from "@pbgo/studio-kit"
import { gameTypes } from "./schemaTypes"

export default createStudioConfig({
  title: "Skyjo",
  projectId: process.env.SANITY_STUDIO_PROJECT_ID ?? "0kx7tx6t",
  dataset: process.env.SANITY_STUDIO_DATASET ?? "production",
  gameTypes,
  collections: [{ type: "card", title: "Cards" }],
})
