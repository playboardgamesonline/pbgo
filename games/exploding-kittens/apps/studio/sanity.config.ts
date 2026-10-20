import { createStudioConfig } from "@pbgo/studio-kit"
import { gameTypes } from "./schemaTypes"

export default createStudioConfig({
  title: "Exploding Kittens",
  projectId: process.env.SANITY_STUDIO_PROJECT_ID ?? "iz9kkgyd",
  dataset: process.env.SANITY_STUDIO_DATASET ?? "production",
  gameTypes,
  collections: [
    { type: "kittenCard", title: "Kitten cards" },
    { type: "defuseCard", title: "Defuse cards" },
    { type: "actionCard", title: "Action cards" },
    { type: "nopeCard", title: "Nope cards" },
    { type: "catCard", title: "Cat cards" },
    { type: "edition", title: "Editions" },
  ],
})
