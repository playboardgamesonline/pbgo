import { defineCliConfig } from "sanity/cli"

export default defineCliConfig({
  api: {
    projectId: process.env.SANITY_STUDIO_PROJECT_ID ?? "ljyif8yt",
    dataset: process.env.SANITY_STUDIO_DATASET ?? "production",
  },
  studioHost: "welcome-to",
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
