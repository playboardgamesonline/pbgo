import { describe, expect, it } from "vitest"
import { constraintsOf, documentProblems, emptyFields, imageFieldOf, imageFields, problemsOf, referenceProblems, referencesOf } from "./schema-check.ts"
import type { TypeDef, Types } from "./schema-check.ts"

// The checker that schema.test.ts relies on, tried on a small schema of its own: a check that cannot fail proves nothing.

// A document the tests change freely, whatever its shape
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = Record<string, any>

/** The Rule a validation function is handed: any chain of calls. */
type Rule = Record<"required" | "regex" | "integer" | "min" | "max" | "length" | "custom" | "unique" | "uri" | "warning" | "info" | "error", (...args: unknown[]) => Rule>

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
    { name: "rulebook", type: "file" },
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
    { name: "odd", type: "string", validation: (rule: Rule) => rule.uri() },
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

  it("accepts a file that references a file asset", () => {
    const rulebook = { _type: "file", asset: { _type: "reference", _ref: "file-0123abcd-pdf" } }
    expect(documentProblems({ ...valid(), rulebook }, types)).toEqual([])
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
    ["a file without an asset", (doc) => (doc.rulebook = { _type: "file" }), "thing-1.rulebook should be a file"],
    ["a file whose asset is an image", (doc) => (doc.rulebook = { _type: "file", asset: { _type: "reference", _ref: "image-abc-10x10-webp" } }), "thing-1.rulebook should be a file"],
    ["a file whose asset is not a reference", (doc) => (doc.rulebook = { _type: "file", asset: { _type: "sanity.fileAsset", _ref: "file-abc-pdf" } }), "thing-1.rulebook should be a file"],
    ["a file of the wrong type", (doc) => (doc.rulebook = { _type: "image", asset: { _type: "reference", _ref: "file-abc-pdf" } }), "thing-1.rulebook should be a file"],
    ["a file given as text", (doc) => (doc.rulebook = "rules.pdf"), "thing-1.rulebook should be a file"],
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
    expect(() => documentProblems({ ...valid(), odd: "x" }, types)).toThrow("uri() is not emulated by schema-check.ts")
  })

  it("lets a rule it does not know go by on a field that holds nothing", () => {
    expect(documentProblems(valid(), types)).toEqual([])
  })

  it("names a kind of field it does not know, once the field holds a value", () => {
    const odd: TypeDef = { name: "odd", type: "document", fields: [{ name: "where", type: "geopoint" }] }
    const known: Types = new Map([[odd.name, odd]])
    expect(documentProblems({ _id: "odd", _type: "odd" }, known)).toEqual([])
    expect(documentProblems({ _id: "odd", _type: "odd", where: { lat: 48.8, lng: 2.3 } }, known)).toEqual(['odd.where has the type "geopoint", which schema-check.ts does not know'])
  })
})

// The kinds the platform's documents bring: a reference, a slug, a date, a date and time, a list of values and the rules that go with them
describe("documentProblems: references, slugs, dates and lists", () => {
  const person: TypeDef = { name: "person", type: "document", fields: [{ name: "name", type: "string" }] }
  const entry: TypeDef = {
    name: "entry",
    type: "document",
    fields: [
      {
        name: "slug",
        type: "slug",
        validation: (rule: Rule) => rule.required().custom((slug: { current?: string } | undefined) => (slug?.current?.startsWith("x-") ? true : "must start with x-")),
      },
      { name: "day", type: "date" },
      { name: "at", type: "datetime" },
      { name: "author", type: "reference", to: [{ type: "person" }] },
      { name: "friends", type: "array", of: [{ type: "reference", to: [{ type: "person" }] }], validation: (rule: Rule) => rule.unique() },
      {
        name: "roles",
        type: "array",
        of: [{ type: "string" }],
        options: { list: [{ title: "Designer", value: "designer" }, "artist"] },
        validation: (rule: Rule) => rule.unique().min(1),
      },
      {
        name: "credits",
        type: "array",
        of: [
          {
            name: "credit",
            type: "object",
            fields: [
              { name: "person", type: "reference", to: [{ type: "person" }] },
              { name: "roles", type: "array", of: [{ type: "string" }] },
            ],
          },
        ],
        validation: (rule: Rule) => rule.unique(),
      },
    ],
  }
  const entryTypes: Types = new Map([person, entry].map((type) => [type.name, type]))
  const reference = (id: string, key?: string): Loose => ({ _type: "reference", _ref: id, ...(key ? { _key: key } : {}) })
  const validEntry = (): Loose => ({
    _id: "entry-1",
    _type: "entry",
    slug: { _type: "slug", current: "x-one" },
    day: "2026-02-28",
    at: "2026-10-30T14:00:00.000Z",
    author: reference("person-1"),
    friends: [reference("person-1", "a"), reference("person-2", "b")],
    roles: ["designer", "artist"],
    credits: [
      { _key: "c1", _type: "credit", person: reference("person-1"), roles: ["designer"] },
      { _key: "c2", _type: "credit", person: reference("person-2"), roles: ["artist"] },
    ],
  })

  it("accepts a document that follows its type", () => {
    expect(documentProblems(validEntry(), entryTypes)).toEqual([])
  })

  it("accepts a date and time with an offset, and with or without seconds", () => {
    for (const at of ["2026-10-30T14:00:00+02:00", "2026-10-30T14:00Z", "2026-10-30T14:00:00.5Z"]) expect(documentProblems({ ...validEntry(), at }, entryTypes), at).toEqual([])
  })

  it.each<[string, (doc: Loose) => void, string]>([
    ["a slug given as text", (doc) => (doc.slug = "x-one"), "entry-1.slug should be a slug"],
    ["a slug with nothing in it", (doc) => (doc.slug = { _type: "slug", current: "" }), "entry-1.slug should be a slug"],
    ["a slug that is missing", (doc) => delete doc.slug, "entry-1.slug is required"],
    ["a slug of another type", (doc) => (doc.slug = { _type: "string", current: "x-one" }), "entry-1.slug should be a slug"],
    ["a slug its custom rule refuses", (doc) => (doc.slug.current = "one"), "entry-1.slug must start with x-"],
    ["a date that does not exist", (doc) => (doc.day = "2026-02-31"), "entry-1.day should be a date"],
    ["a date with a time", (doc) => (doc.day = "2026-02-28T10:00:00Z"), "entry-1.day should be a date"],
    ["a date given as a number", (doc) => (doc.day = 20260228), "entry-1.day should be a date"],
    ["a date and time with no zone", (doc) => (doc.at = "2026-10-30T14:00:00"), "entry-1.at should be a date and time"],
    ["a date and time on a day that does not exist", (doc) => (doc.at = "2026-02-31T10:00:00Z"), "entry-1.at should be a date and time"],
    ["a date and time given as a date", (doc) => (doc.at = "2026-10-30"), "entry-1.at should be a date and time"],
    ["a reference given as text", (doc) => (doc.author = "person-1"), "entry-1.author should be a reference"],
    ["a reference with no target", (doc) => (doc.author = { _type: "reference" }), "entry-1.author should be a reference"],
    ["a reference of another type", (doc) => (doc.author = { _type: "person", _ref: "person-1" }), "entry-1.author should be a reference"],
    ["an item of a list of references that is not one", (doc) => (doc.friends[1] = { _key: "b", _type: "person" }), 'which the array does not accept (reference)'],
    ["a list of references that repeats one", (doc) => (doc.friends[1] = reference("person-1", "b")), "entry-1.friends must not repeat"],
    ["a value that is not in the list of an array", (doc) => (doc.roles = ["designer", "writer"]), 'entry-1.roles is "writer", not one of "designer", "artist"'],
    ["a list of values that repeats one", (doc) => (doc.roles = ["artist", "artist"]), 'entry-1.roles must not repeat "artist"'],
    ["a list of values with none", (doc) => (doc.roles = []), "entry-1.roles must be at least 1"],
    ["a list of objects that repeats one, whatever its key", (doc) => (doc.credits[1] = { ...doc.credits[0], _key: "c2" }), "entry-1.credits must not repeat"],
  ])("flags %s, and only that", (_name, change, expected) => {
    const doc = validEntry()
    change(doc)
    const problems = documentProblems(doc, entryTypes)
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain(expected)
  })
})

describe("custom() rules", () => {
  const verdict = (answer: unknown) => problemsOf("x", { type: "string", validation: (rule: Rule) => rule.custom(() => answer) }, "v", new Map())

  it("calls the function with the value", () => {
    const check = (value: string) => problemsOf(value, { type: "string", validation: (rule: Rule) => rule.custom((given: unknown) => (given === "ok" ? true : "must be ok")) }, "v", new Map())
    expect(check("ok")).toEqual([])
    expect(check("no")).toEqual(["v must be ok"])
  })

  it("reads true, nothing, a text, a message and a list of them as what the Studio does", () => {
    expect(verdict(true)).toEqual([])
    expect(verdict(undefined)).toEqual([])
    expect(verdict("too short")).toEqual(["v too short"])
    expect(verdict({ message: "bad" })).toEqual(["v bad"])
    expect(verdict([true, "second"])).toEqual(["v second"])
    expect(verdict({})).toEqual(["v is refused by its custom() rule ({})"])
  })

  it("does not emulate a function that answers later, nor a rule that is not given one", () => {
    expect(() => verdict(Promise.resolve(true))).toThrow("promise")
    expect(() => problemsOf("x", { type: "string", validation: (rule: Rule) => rule.custom() }, "v", new Map())).toThrow("custom() needs a function")
  })

  it("is not called for a field that holds nothing (required() says that)", () => {
    expect(problemsOf(undefined, { type: "string", validation: (rule: Rule) => rule.custom(() => "never") }, "v", new Map())).toEqual([])
  })
})

describe("referencesOf and referenceProblems", () => {
  const person: TypeDef = { name: "person", type: "document", fields: [{ name: "name", type: "string" }] }
  const note: TypeDef = {
    name: "note",
    type: "document",
    fields: [
      { name: "about", type: "reference", to: [{ type: "person" }] },
      { name: "also", type: "array", of: [{ type: "reference", to: [{ type: "person" }, { type: "note" }] }] },
      { name: "credit", type: "object", fields: [{ name: "by", type: "reference", to: [{ type: "person" }] }] },
      { name: "anyone", type: "reference" },
      { name: "picture", type: "image" },
    ],
  }
  const noteTypes: Types = new Map([person, note].map((type) => [type.name, type]))
  const reference = (id: string): Loose => ({ _type: "reference", _ref: id })
  const docs = (): Loose[] => [
    { _id: "person-1", _type: "person", name: "A" },
    { _id: "note-1", _type: "note", about: reference("person-1"), also: [{ _key: "k", ...reference("note-2") }], credit: { by: reference("person-1") }, anyone: reference("note-2") },
    { _id: "note-2", _type: "note", picture: { _type: "image", asset: reference("image-abc-10x10-webp") } },
  ]

  it("lists the references of a value, in objects and arrays, with the types they may point at", () => {
    const [, first] = docs()
    expect(first && note.fields?.flatMap((field) => referencesOf(first[field.name], field, `note-1.${field.name}`, noteTypes))).toEqual([
      { path: "note-1.about", ref: "person-1", to: ["person"] },
      { path: "note-1.also[0]", ref: "note-2", to: ["person", "note"] },
      { path: "note-1.credit.by", ref: "person-1", to: ["person"] },
      { path: "note-1.anyone", ref: "note-2", to: [] },
    ])
  })

  it("finds nothing wrong with references that all point at a document of the seed, of a type their field takes", () => {
    expect(referenceProblems(docs(), noteTypes)).toEqual([])
  })

  it("does not take the asset of an image for a reference of the seed", () => {
    expect(referenceProblems([docs()[2] as Loose], noteTypes)).toEqual([])
  })

  it("flags a reference to a document that is not in the seed, and one to a document of another type", () => {
    const broken = docs()
    Object.assign(broken[1] as Loose, { about: reference("person-9"), credit: { by: reference("note-2") } })
    expect(referenceProblems(broken, noteTypes)).toEqual([
      'note-1.about points at "person-9", which is not in the seed',
      'note-1.credit.by points at "note-2", a "note", and the field takes "person"',
    ])
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

  it("leaves files to the rulebook step, filled or not", () => {
    const doc = valid()
    expect(emptyFields({ ...doc, rulebook: { _type: "file", asset: { _type: "reference", _ref: "file-abc-pdf" } } }, thing, "thing-1", types)).toEqual(["thing-1.soft", "thing-1.odd"])
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
