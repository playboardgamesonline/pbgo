import { createStandaloneStudioConfig } from "@pbgo/studio-kit"
import { schemaTypes } from "./schemaTypes"
import { defaultDocumentNode, structure } from "./structure"

export default createStandaloneStudioConfig({
  title: "Play Board Games Online",
  projectId: process.env.SANITY_STUDIO_PROJECT_ID ?? "mhgqs6fe",
  dataset: process.env.SANITY_STUDIO_DATASET ?? "production",
  types: schemaTypes,
  structure,
  defaultDocumentNode,
})
