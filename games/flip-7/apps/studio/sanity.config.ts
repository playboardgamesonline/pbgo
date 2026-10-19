import { createStudioConfig } from "@pbgo/studio-kit"
import { gameTypes } from "./schemaTypes"

export default createStudioConfig({
  title: "Flip 7",
  projectId: process.env.SANITY_STUDIO_PROJECT_ID ?? "ky3exlhe",
  dataset: process.env.SANITY_STUDIO_DATASET ?? "production",
  gameTypes,
  collections: [{ type: "cardType", title: "Card faces" }],
})
