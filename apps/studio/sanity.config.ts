import { visionTool } from "@sanity/vision"
import { defineConfig } from "sanity"
import { structureTool } from "sanity/structure"
import { schemaTypes } from "./schemaTypes"
import { SINGLETONS, structure } from "./structure"

export default defineConfig({
  name: "default",
  title: "Dracula vs Van Helsing",
  projectId: process.env.SANITY_STUDIO_PROJECT_ID ?? "8kl9j1dh",
  dataset: process.env.SANITY_STUDIO_DATASET ?? "production",
  plugins: [structureTool({ structure }), visionTool()],
  schema: {
    types: schemaTypes,
    templates: (templates) => templates.filter(({ schemaType }) => !SINGLETONS.includes(schemaType)),
  },
  document: {
    actions: (actions, { schemaType }) =>
      SINGLETONS.includes(schemaType) ? actions.filter(({ action }) => action && ["publish", "discardChanges", "restore"].includes(action)) : actions,
  },
})
