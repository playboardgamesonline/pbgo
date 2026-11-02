import { createStandaloneStudioConfig } from "@pbgo/studio-kit"
import { fieldTranslations } from "@pbgo/studio-kit/field-translations"
import { schemaTypes } from "./schemaTypes"
import { TRANSLATED_FIELDS } from "./schemaTypes/constants"
import { TRANSLATED_FIELD_TYPES } from "./schemaTypes/translations"
import { defaultDocumentNode, structure } from "./structure"

export default createStandaloneStudioConfig({
  title: "Play Board Games Online",
  projectId: process.env.SANITY_STUDIO_PROJECT_ID ?? "mhgqs6fe",
  dataset: process.env.SANITY_STUDIO_DATASET ?? "production",
  types: schemaTypes,
  structure,
  defaultDocumentNode,
  // The catalog is translated field by field, in the languages of the platform (PLT-104)
  plugins: [fieldTranslations({ fieldTypes: TRANSLATED_FIELD_TYPES, documentTypes: Object.keys(TRANSLATED_FIELDS) })],
})
