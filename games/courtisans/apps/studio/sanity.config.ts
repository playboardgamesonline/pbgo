import { createStudioConfig } from "@pgo/studio-kit"
import { gameTypes } from "./schemaTypes"

export default createStudioConfig({
  title: "Courtisans",
  projectId: process.env.SANITY_STUDIO_PROJECT_ID ?? "2lo2f5sv",
  dataset: process.env.SANITY_STUDIO_DATASET ?? "production",
  gameTypes,
  collections: [
    { type: "family", title: "Families" },
    { type: "role", title: "Roles" },
    { type: "courtier", title: "Courtiers" },
    { type: "mission", title: "Missions" },
  ],
})
