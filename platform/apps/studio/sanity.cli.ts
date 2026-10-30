import { defineCliConfig } from "sanity/cli"

export default defineCliConfig({
  api: {
    projectId: process.env.SANITY_STUDIO_PROJECT_ID ?? "mhgqs6fe",
    dataset: process.env.SANITY_STUDIO_DATASET ?? "production",
  },
  studioHost: process.env.SANITY_STUDIO_HOST ?? "pbgo",
  deployment: {
    // The Studio at pbgo.sanity.studio: with it a deployment does not ask which application this is
    appId: "juahl5g7abxoc9cd5zpc3z47",
    autoUpdates: true,
  },
})
