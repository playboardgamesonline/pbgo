import { defineCliConfig } from "sanity/cli"

export default defineCliConfig({
  api: {
    projectId: process.env.SANITY_STUDIO_PROJECT_ID ?? "o2gqqcvf",
    dataset: process.env.SANITY_STUDIO_DATASET ?? "production",
  },
  studioHost: "cry-baby",
  deployment: {
    autoUpdates: true,
  },
  typegen: {
    enabled: true,
    path: "../web/src/**/*.{ts,tsx}",
    schema: "schema.json",
    generates: "../web/src/sanity/types.ts",
    overloadClientMethods: true,
  },
})
