import { defineCliConfig } from "sanity/cli"

export default defineCliConfig({
  api: {
    projectId: process.env.SANITY_STUDIO_PROJECT_ID ?? "srffdhjt",
    dataset: process.env.SANITY_STUDIO_DATASET ?? "production",
  },
  studioHost: "hanabi",
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
