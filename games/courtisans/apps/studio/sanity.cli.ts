import { defineCliConfig } from "sanity/cli"

export default defineCliConfig({
  api: {
    projectId: process.env.SANITY_STUDIO_PROJECT_ID ?? "2lo2f5sv",
    dataset: process.env.SANITY_STUDIO_DATASET ?? "production",
  },
  deployment: {
    appId: "kphuj1bhjhsnn400r4us288f",
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
