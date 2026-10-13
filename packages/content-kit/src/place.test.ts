import { describe, expect, it } from "vitest"
import { setField, setItemField } from "./place.ts"
import type { ImageValue, SeedDoc } from "./types.ts"

const image: ImageValue = { _type: "image", asset: { _type: "reference", _ref: "image-abc-40x56-webp" } }

describe("setField", () => {
  it("puts the image in the field, and keeps the rest of the document", () => {
    const doc: SeedDoc = { _id: "thing", _type: "thing", name: "A thing" }
    setField("picture")(doc, image)
    expect(doc).toEqual({ _id: "thing", _type: "thing", name: "A thing", picture: image })
  })

  it("replaces what the field held", () => {
    const doc: SeedDoc = { _id: "thing", _type: "thing", picture: "old" }
    setField("picture")(doc, image)
    expect(doc.picture).toBe(image)
  })
})

describe("setItemField", () => {
  const build = (): SeedDoc => ({
    _id: "thing",
    _type: "thing",
    entries: [
      { _key: "a", _type: "entry", label: "A" },
      { _key: "b", _type: "entry", label: "B" },
    ],
  })

  it("puts the image in the item found by its key, and only there", () => {
    const doc = build()
    setItemField("entries", "b", "glyph")(doc, image)
    expect(doc.entries).toEqual([
      { _key: "a", _type: "entry", label: "A" },
      { _key: "b", _type: "entry", label: "B", glyph: image },
    ])
  })

  it("names the document, the list and the key when the item is not there", () => {
    expect(() => setItemField("entries", "c", "glyph")(build(), image)).toThrow('"thing" has no item "c" in "entries"')
  })

  it("treats a list that does not exist as an empty one", () => {
    const doc: SeedDoc = { _id: "thing", _type: "thing" }
    expect(() => setItemField("entries", "a", "glyph")(doc, image)).toThrow('"thing" has no item "a" in "entries"')
  })
})
