import { describe, expect, it } from "vitest"
import { formProblems, studioTypes } from "./form-rules.ts"
import type { TypeDef, Types } from "./schema-check.ts"

// The rules of the Studio forms, tried on small schemas of their own: a check that cannot fail proves nothing.

const typesOf = (...defs: TypeDef[]): Types => new Map(defs.map((def) => [def.name, def]))

const game = (overrides: Partial<TypeDef> = {}): TypeDef => ({
  name: "game",
  type: "document",
  groups: [
    { name: "board", title: "Board", default: true },
    { name: "backs", title: "Card backs" },
  ],
  fields: [
    { name: "mat", type: "image", group: "board" },
    { name: "cardBack", type: "image", group: "backs" },
  ],
  ...overrides,
})

const card: TypeDef = {
  name: "card",
  type: "document",
  fields: [
    { name: "key", type: "string" },
    { name: "description", type: "text" },
    { name: "edition", type: "object", fields: [{ name: "year", type: "number" }] },
    { name: "parts", type: "array", of: [{ name: "part", type: "object", fields: [{ name: "number", type: "number" }] }] },
  ],
}

describe("the descriptions", () => {
  it("accepts a schema that has none, even a field named description", () => {
    expect(formProblems(typesOf(card, game()))).toEqual([])
  })

  it("finds the one on a field of a document", () => {
    const fields = card.fields?.map((field) => (field.name === "key" ? { ...field, description: "The id the engine uses" } : field))
    expect(formProblems(typesOf({ ...card, fields }))).toEqual(["card.key has a description: what matters goes in its title, or in the message of its validation"])
  })

  it("finds the one on a field of an object", () => {
    const fields = card.fields?.map((field) =>
      field.name === "edition" ? { ...field, fields: [{ name: "year", type: "number", description: "Printing year" }] } : field,
    )
    expect(formProblems(typesOf({ ...card, fields })).map((problem) => problem.split(" has ")[0])).toEqual(["card.edition.year"])
  })

  it("finds the one on a field of an array member, and on the array itself or its member", () => {
    const fields = card.fields?.map((field) =>
      field.name === "parts"
        ? {
            ...field,
            description: "One per copy",
            of: [{ name: "part", type: "object", description: "A copy", fields: [{ name: "number", type: "number", description: "From 1" }] }],
          }
        : field,
    )
    expect(formProblems(typesOf({ ...card, fields })).map((problem) => problem.split(" has ")[0])).toEqual(["card.parts", "card.parts[]", "card.parts[].number"])
  })

  it("finds the one on a type, and on a reusable object", () => {
    const label: TypeDef = { name: "label", type: "object", fields: [{ name: "fr", type: "string", description: "In French" }] }
    expect(formProblems(typesOf({ ...card, description: "Cards" }, label)).map((problem) => problem.split(" has ")[0])).toEqual(["card", "label.fr"])
  })
})

describe("the tabs of the game document", () => {
  it("accepts a game filed in tabs, a field may sit in several", () => {
    const fields = [{ name: "mat", type: "image", group: ["board", "backs"] }]
    expect(formProblems(typesOf(game({ fields })))).toEqual([])
  })

  it("asks for tabs when the game has none", () => {
    expect(formProblems(typesOf(game({ groups: undefined })))).toEqual(["game has no tabs (groups): file its fields in tabs, as in Courtisans (Board, Card backs…)"])
    expect(formProblems(typesOf(game({ groups: [] })))).toHaveLength(1)
  })

  it("asks for exactly one tab open by default", () => {
    const plain = [{ name: "board" }, { name: "backs" }]
    const twice = [
      { name: "board", default: true },
      { name: "backs", default: true },
    ]
    expect(formProblems(typesOf(game({ groups: plain })))).toEqual(["game has 0 default tabs, it needs exactly one"])
    expect(formProblems(typesOf(game({ groups: twice })))).toEqual(["game has 2 default tabs, it needs exactly one"])
  })

  it("asks for every field to be in a tab the game declares", () => {
    const fields = [
      { name: "mat", type: "image", group: "board" },
      { name: "cardBack", type: "image" },
      { name: "box", type: "image", group: "box" },
    ]
    expect(formProblems(typesOf(game({ fields })))).toEqual(['game.cardBack is in no tab', 'game.box is in the tab "box", which game does not declare'])
  })

  it("leaves the other documents and a schema without a game alone", () => {
    const settings: TypeDef = { name: "settings", type: "document", fields: [{ name: "favicon", type: "image" }] }
    expect(formProblems(typesOf(settings))).toEqual([])
    expect(formProblems(typesOf(settings, game()))).toEqual([])
  })
})

describe("studioTypes", () => {
  it("reads the types a Studio config registers, by name", () => {
    const types = studioTypes({ schema: { types: [card, game()] } })
    expect([...types.keys()]).toEqual(["card", "game"])
    expect(types.get("card")).toBe(card)
  })

  it("refuses a config that does not list its types", () => {
    expect(() => studioTypes(undefined)).toThrow("no list of schema types")
    expect(() => studioTypes({})).toThrow("no list of schema types")
    expect(() => studioTypes({ schema: { types: () => [] } })).toThrow("no list of schema types")
  })
})
