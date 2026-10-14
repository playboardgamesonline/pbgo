import type { ImageValue, SeedDoc } from "./types.ts"

// The two ways an `ArtSlot` puts its image in a document: in a field of the document, or in a field of one item of an array.

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
