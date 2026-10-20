import { createStudioConfig } from "@pbgo/studio-kit"
import { gameTypes } from "./schemaTypes"

export default createStudioConfig({
  title: "Hanabi",
  projectId: process.env.SANITY_STUDIO_PROJECT_ID ?? "ho5ap9a6",
  dataset: process.env.SANITY_STUDIO_DATASET ?? "production",
  gameTypes,
  collections: [
    { type: "suit", title: "Colors" },
    { type: "card", title: "Cards" },
    { type: "bonusTile", title: "Bonus tiles" },
  ],
})
