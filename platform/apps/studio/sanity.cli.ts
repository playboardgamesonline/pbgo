import { defineCliConfig } from "sanity/cli"

export default defineCliConfig({
  api: {
    projectId: process.env.SANITY_STUDIO_PROJECT_ID ?? "mhgqs6fe",
    dataset: process.env.SANITY_STUDIO_DATASET ?? "production",
  },
  studioHost: process.env.SANITY_STUDIO_HOST ?? "pbgo",
  deployment: {
    autoUpdates: true,
  },
})
