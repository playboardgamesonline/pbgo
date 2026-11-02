import { describe, expect, it } from "vitest"
import { setField, setItemField, setRow } from "./place.ts"
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

describe("setRow", () => {
  const rowType = "internationalizedArrayImageValue"

  it("makes the row of the language when the field has none: the language is its key, and the image its value", () => {
    const doc: SeedDoc = { _id: "thing", _type: "thing", name: "A thing" }
    setRow("logo", rowType, "en")(doc, image)
    expect(doc).toEqual({ _id: "thing", _type: "thing", name: "A thing", logo: [{ _key: "en", _type: rowType, language: "en", value: image }] })
  })

  it("puts the image in the row the field already has for the language, whatever its key, and leaves the other rows", () => {
    const other = { _key: "k2", _type: rowType, language: "fr", value: { _type: "image", asset: { _type: "reference", _ref: "image-fr-1x1-png" } } }
    const doc: SeedDoc = { _id: "thing", _type: "thing", logo: [{ _key: "k1", _type: rowType, language: "en" }, other] }
    setRow("logo", rowType, "en")(doc, image)
    expect(doc.logo).toEqual([{ _key: "k1", _type: rowType, language: "en", value: image }, other])
  })

  it("adds the row of the language to the rows the field has for others", () => {
    const fr = { _key: "fr", _type: rowType, language: "fr", value: image }
    const doc: SeedDoc = { _id: "thing", _type: "thing", logo: [fr] }
    setRow("logo", rowType, "en")(doc, image)
    expect(doc.logo).toEqual([fr, { _key: "en", _type: rowType, language: "en", value: image }])
  })
})
