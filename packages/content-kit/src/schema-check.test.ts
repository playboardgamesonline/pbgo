import { describe, expect, it } from "vitest"
import { constraintsOf, documentProblems, emptyFields, imageFieldOf, imageFields } from "./schema-check.ts"
import type { TypeDef, Types } from "./schema-check.ts"

// The checker that schema.test.ts relies on, tried on a small schema of its own: a check that cannot fail proves nothing.

// A document the tests change freely, whatever its shape
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = Record<string, any>

/** The Rule a validation function is handed: any chain of calls. */
type Rule = Record<"required" | "regex" | "integer" | "min" | "max" | "length" | "custom" | "warning" | "info" | "error", (...args: unknown[]) => Rule>

const label: TypeDef = {
  name: "label",
  type: "object",
  fields: [
    { name: "fr", type: "string" },
    { name: "en", type: "string" },
  ],
}

const thing: TypeDef = {
  name: "thing",
  type: "document",
  fields: [
    { name: "title", type: "label" },
    { name: "color", type: "string", validation: (rule: Rule) => rule.required().regex(/^#[0-9a-f]{6}$/i, { name: "hex" }) },
    { name: "kind", type: "string", options: { list: [{ title: "A", value: "a" }, "b"] } },
    { name: "count", type: "number", validation: (rule: Rule) => rule.required().integer().min(1) },
    { name: "code", type: "string", validation: [(rule: Rule) => rule.length(1)] },
    { name: "link", type: "url" },
    { name: "picture", type: "image" },
    {
      name: "parts",
      type: "array",
      of: [
        {
          name: "part",
          type: "object",
          fields: [
            { name: "n", type: "number", validation: (rule: Rule) => rule.max(9) },
            { name: "icon", type: "image" },
          ],
        },
      ],
    },
    { name: "notes", type: "array", of: [{ type: "string" }] },
    { name: "soft", type: "string", validation: (rule: Rule) => rule.min(3).warning("short") },
    { name: "odd", type: "string", validation: (rule: Rule) => rule.custom(() => true) },
  ],
}

const types: Types = new Map([label, thing].map((type) => [type.name, type]))

const valid = (): Loose => ({
  _id: "thing-1",
  _type: "thing",
  title: { _type: "label", fr: "Un", en: "One" },
  color: "#aabbcc",
  kind: "a",
  count: 2,
  code: "x",
  link: "https://example.com/a",
  picture: { _type: "image", asset: { _type: "reference", _ref: "image-abc-10x10-webp" } },
  parts: [
    { _key: "p1", _type: "part", n: 3 },
    { _key: "p2", _type: "part", n: 4 },
  ],
  notes: ["a", "b"],
})

describe("constraintsOf", () => {
  it("records the rules of a validation function in the order they are called", () => {
    expect(constraintsOf((rule: Rule) => rule.required().min(2))).toEqual([
      { name: "required", args: [], blocking: true },
      { name: "min", args: [2], blocking: true },
    ])
  })

  it("reads a list of validation functions as one set of rules", () => {
    const names = constraintsOf([(rule: Rule) => rule.required(), (rule: Rule) => rule.length(3)]).map((constraint) => constraint.name)
    expect(names).toEqual(["required", "length"])
  })

  it("finds no rule in no validation", () => {
    expect(constraintsOf(undefined)).toEqual([])
    expect(constraintsOf([])).toEqual([])
  })

  it("makes the rule before .warning() or .info() non-blocking, and only that one", () => {
    expect(constraintsOf((rule: Rule) => rule.required().min(3).warning("short")).map((constraint) => constraint.blocking)).toEqual([true, false])
    expect(constraintsOf((rule: Rule) => rule.min(3).info().max(9)).map((constraint) => constraint.blocking)).toEqual([false, true])
  })

  it("does not take .error() for a rule", () => {
    expect(constraintsOf((rule: Rule) => rule.required().error("needed")).map((constraint) => constraint.name)).toEqual(["required"])
  })
})

describe("documentProblems", () => {
  it("accepts a document that follows its type", () => {
    expect(documentProblems(valid(), types)).toEqual([])
  })

  it("accepts a field left out when no rule asks for it, and the fields Sanity adds", () => {
    const doc: Loose = { ...valid(), _rev: "abc", _createdAt: "2026-01-01T00:00:00Z", _updatedAt: "2026-01-02T00:00:00Z" }
    delete doc.link
    delete doc.parts
    expect(documentProblems(doc, types)).toEqual([])
  })

  it("accepts a list given by its values and a list given by title and value", () => {
    expect(documentProblems({ ...valid(), kind: "b" }, types)).toEqual([])
    expect(documentProblems({ ...valid(), kind: "a" }, types)).toEqual([])
  })

  it("accepts a link with each of the schemes the Studio takes", () => {
    for (const link of ["http://example.com", "https://example.com/a?b=c#d", "mailto:hey@example.com", "tel:+33123456789"]) {
      expect(documentProblems({ ...valid(), link }, types), link).toEqual([])
    }
  })

  it.each<[string, (doc: Loose) => void, string]>([
    ["a required field that is missing", (doc) => delete doc.count, "thing-1.count is required"],
    ["a required field that is null", (doc) => (doc.count = null), "thing-1.count is required"],
    ["a required field that is an empty text", (doc) => (doc.color = ""), "thing-1.color is required"],
    ["a number given as text", (doc) => (doc.count = "2"), "thing-1.count should be a number"],
    ["a number that is not a number", (doc) => (doc.count = Number.NaN), "thing-1.count should be a number"],
    ["a whole number given as a fraction", (doc) => (doc.count = 1.5), "thing-1.count must be an integer"],
    ["a number under its minimum", (doc) => (doc.count = 0), "thing-1.count must be at least 1"],
    ["a number over its maximum", (doc) => (doc.parts[0].n = 10), "thing-1.parts[0].n must be at most 9"],
    ["a text that does not match its pattern", (doc) => (doc.color = "red"), "thing-1.color does not match"],
    ["a text of the wrong length", (doc) => (doc.code = "xy"), "thing-1.code must be 1 long"],
    ["a text given as a number", (doc) => (doc.kind = 1), "thing-1.kind should be a string"],
    ["a value outside its list", (doc) => (doc.kind = "c"), 'thing-1.kind is "c", not one of "a", "b"'],
    ["a link that is not an address", (doc) => (doc.link = "example"), "thing-1.link should be a URL"],
    ["a link with a scheme the Studio refuses", (doc) => (doc.link = "ftp://example.com"), "thing-1.link should be a URL"],
    ["an image without an asset", (doc) => (doc.picture = { _type: "image" }), "thing-1.picture should be an image"],
    ["an image whose asset is not an image", (doc) => (doc.picture.asset._ref = "file-abc-pdf"), "thing-1.picture should be an image"],
    ["an image of the wrong type", (doc) => (doc.picture._type = "file"), "thing-1.picture should be an image"],
    ["a field the type does not have", (doc) => (doc.colour = "red"), 'thing-1.colour is not a field of "thing"'],
    ["an object of another type", (doc) => (doc.title._type = "other"), 'thing-1.title._type is "other", expected "label"'],
    ["an object without a type", (doc) => delete doc.title._type, 'thing-1.title._type is undefined, expected "label"'],
    ["an object with a key it has no field for", (doc) => (doc.title.de = "Eins"), "thing-1.title.de is not a field"],
    ["an object given as text", (doc) => (doc.title = "Un"), "thing-1.title should be an object"],
    ["an array given as an object", (doc) => (doc.parts = {}), "thing-1.parts should be an array"],
    ["an item without a key", (doc) => delete doc.parts[0]._key, "thing-1.parts[0] has no _key"],
    ["two items with the same key", (doc) => (doc.parts[1]._key = "p1"), 'thing-1.parts[1] repeats the _key "p1"'],
    ["an item of a type the array does not take", (doc) => (doc.parts[0]._type = "other"), "thing-1.parts[0] has the type \"other\", which the array does not accept (part)"],
    ["a text no member of the array takes", (doc) => (doc.notes = [1]), "thing-1.notes[0] is 1, which no member of the array accepts"],
    ["a document of a type the schema lacks", (doc) => (doc._type = "nothing"), 'thing-1: "nothing" is not a document type of the schema'],
    ["a document of a type that is not a document", (doc) => (doc._type = "label"), '"label" is not a document type of the schema'],
  ])("flags %s, and only that", (_name, change, expected) => {
    const doc = valid()
    change(doc)
    const problems = documentProblems(doc, types)
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain(expected)
  })

  it("names every problem of a document, not only the first", () => {
    const doc = valid()
    doc.count = 0
    doc.color = "red"
    doc.colour = "red"
    expect(documentProblems(doc, types)).toHaveLength(3)
  })

  it("does not count a rule that is only a warning", () => {
    expect(documentProblems({ ...valid(), soft: "ab" }, types)).toEqual([])
  })

  it("refuses to guess a rule it does not know, once the field holds a value", () => {
    expect(() => documentProblems({ ...valid(), odd: "x" }, types)).toThrow("custom() is not emulated by schema-check.ts")
  })

  it("lets a rule it does not know go by on a field that holds nothing", () => {
    expect(documentProblems(valid(), types)).toEqual([])
  })

  it("names a kind of field it does not know, once the field holds a value", () => {
    const odd: TypeDef = { name: "odd", type: "document", fields: [{ name: "when", type: "datetime" }] }
    const known: Types = new Map([[odd.name, odd]])
    expect(documentProblems({ _id: "odd", _type: "odd" }, known)).toEqual([])
    expect(documentProblems({ _id: "odd", _type: "odd", when: "2026-01-01" }, known)).toEqual(['odd.when has the type "datetime", which schema-check.ts does not know'])
  })
})

describe("emptyFields", () => {
  it("lists the fields a document leaves out, in the order of the type", () => {
    expect(emptyFields(valid(), thing, "thing-1", types)).toEqual(["thing-1.soft", "thing-1.odd"])
  })

  it("goes into objects and array items, and names the item by its place", () => {
    const doc = valid()
    delete doc.link
    delete doc.title.en
    delete doc.parts[0].n
    expect(emptyFields(doc, thing, "thing-1", types)).toEqual(["thing-1.title.en", "thing-1.link", "thing-1.parts[0].n", "thing-1.soft", "thing-1.odd"])
  })

  it("leaves images to the art step, filled or not", () => {
    const doc = valid()
    delete doc.picture
    delete doc.parts[0].icon
    expect(emptyFields(doc, thing, "thing-1", types)).toEqual(["thing-1.soft", "thing-1.odd"])
  })

  it("lists a field that is null like one that is missing", () => {
    expect(emptyFields({ ...valid(), kind: null }, thing, "thing-1", types)).toContain("thing-1.kind")
  })
})

describe("imageFields", () => {
  it("lists the image fields of a type, with [] for each array", () => {
    expect(imageFields("thing", types)).toEqual(["thing.picture", "thing.parts[].icon"])
  })

  it("lists none for a type without images", () => {
    expect(imageFields("label", types)).toEqual([])
  })

  it("says which type the schema lacks", () => {
    expect(() => imageFields("nothing", types)).toThrow('The schema has no type "nothing"')
  })
})

describe("imageFieldOf", () => {
  it("writes the path of an image in a document like the field of its type", () => {
    expect(imageFieldOf("thing", "$.picture")).toBe("thing.picture")
    expect(imageFieldOf("thing", "$.parts[3].icon")).toBe("thing.parts[].icon")
    expect(imageFieldOf("game", "$.valueGlyphs[12].glyph")).toBe("game.valueGlyphs[].glyph")
  })

  it("agrees with the list of the image fields for the path of each image", () => {
    expect([imageFieldOf("thing", "$.picture"), imageFieldOf("thing", "$.parts[1].icon")]).toEqual(imageFields("thing", types))
  })
})
