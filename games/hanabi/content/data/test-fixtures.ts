import type { ImageValue, SeedDoc } from "../lib/types.ts"
import { buildSeedDocs } from "./index.ts"

/** A seed document, read loosely by the tests. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Doc = SeedDoc & Record<string, any>

/** A fresh build of every seed document. */
export const seedDocs = () => buildSeedDocs() as Doc[]

/** The image value the uploader places in a document, for an asset that does not exist. */
export const imageValue = (name: string): ImageValue => ({ _type: "image", asset: { _type: "reference", _ref: `image-${name}-40x56-webp` } })

/** Every image value found in a value, with the path where it sits (`$.valueGlyphs[3].glyph`). */
export function imagesOf(value: unknown, path = "$"): { path: string; image: ImageValue }[] {
  if (Array.isArray(value)) return value.flatMap((item, index) => imagesOf(item, `${path}[${index}]`))
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>
    if (record._type === "image" || "asset" in record) return [{ path, image: record as ImageValue }]
    return Object.entries(record).flatMap(([key, child]) => imagesOf(child, `${path}.${key}`))
  }
  return []
}
