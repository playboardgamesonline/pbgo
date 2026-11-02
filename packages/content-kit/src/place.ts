import type { ImageValue, SeedDoc } from "./types.ts"

// The ways an `ArtSlot` puts its image in a document: in a field of the document, in a field of one item of an array, or in the row of a
// language of a translated field.

type ListItem = { _key?: string; [field: string]: unknown }

/** Puts the image in a field of the document. */
export const setField = (field: string) => (doc: SeedDoc, image: ImageValue) => {
  doc[field] = image
}

/** Puts the image in a field of one item of an array, found by its `_key` (a document that keeps its glyphs or badges in an array). */
export const setItemField = (list: string, key: string, field: string) => (doc: SeedDoc, image: ImageValue) => {
  const items = Array.isArray(doc[list]) ? (doc[list] as ListItem[]) : []
  const item = items.find((candidate) => candidate._key === key)
  if (!item) throw new Error(`"${doc._id}" has no item "${key}" in "${list}"`)
  item[field] = image
}

/**
 * Puts the image in the row of a language of a translated field (`sanity-plugin-internationalized-array`, PLT-104): the field is an array of
 * rows `{ language, value }` and the image is the `value` of the row of `language`, added to the rows the field has when it has none. `rowType`
 * is the type of a row (`internationalizedArrayImageValue`). The key of a row made here is its language.
 */
export const setRow = (field: string, rowType: string, language: string) => (doc: SeedDoc, image: ImageValue) => {
  const rows = Array.isArray(doc[field]) ? (doc[field] as ListItem[]) : (doc[field] = [] as ListItem[])
  const row = rows.find((candidate) => candidate.language === language)
  if (row) row.value = image
  else rows.push({ _key: language, _type: rowType, language, value: image })
}
