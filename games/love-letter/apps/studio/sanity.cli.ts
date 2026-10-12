import { defineCliConfig } from "sanity/cli"

export default defineCliConfig({
  api: {
    projectId: process.env.SANITY_STUDIO_PROJECT_ID ?? "fdbxac71",
    dataset: process.env.SANITY_STUDIO_DATASET ?? "production",
  },
  studioHost: "love-letter",
  deployment: {
    autoUpdates: true,
  },
  typegen: {
    enabled: true,
    path: "../../src/**/*.{ts,tsx}",
    schema: "schema.json",
    generates: "../../src/sanity/types.ts",
    overloadClientMethods: true,
  },
})
