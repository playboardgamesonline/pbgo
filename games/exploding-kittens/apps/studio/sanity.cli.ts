import { defineCliConfig } from "sanity/cli"

export default defineCliConfig({
  api: {
    projectId: process.env.SANITY_STUDIO_PROJECT_ID ?? "gsfz20b9",
    dataset: process.env.SANITY_STUDIO_DATASET ?? "production",
  },
  studioHost: process.env.SANITY_STUDIO_HOST ?? "__SANITY_STUDIO_HOST__",
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
