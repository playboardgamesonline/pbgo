import { defineCliConfig } from "sanity/cli"

export default defineCliConfig({
  api: {
    projectId: process.env.SANITY_STUDIO_PROJECT_ID ?? "ky3exlhe",
    dataset: process.env.SANITY_STUDIO_DATASET ?? "production",
  },
  studioHost: process.env.SANITY_STUDIO_HOST ?? "flip-7",
  deployment: {
    appId: "fztyjg5a2xp1b7ew9mq9twe7",
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
