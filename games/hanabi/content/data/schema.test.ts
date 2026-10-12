import { join } from "node:path"
import { beforeAll, describe, expect, it } from "vitest"
import { BONUS_TILE_NUMBERS, DIRECTION_KEYS, EXTENSION_KEYS, PATTERN_KEYS, RANKS, RATING_KEYS, SUIT_KEYS } from "../../apps/studio/schemaTypes/constants.ts"
import { DATASET, GAME_DIR, PROJECT_ID } from "../config.ts"
import { ART_SLOTS } from "./art-manifest.ts"
import { constraintsOf, documentProblems, emptyFields, imageFieldOf, imageFields } from "./schema-check.ts"
import type { FieldDef, TypeDef, Types } from "./schema-check.ts"
import { imagesOf, imageValue, seedDocs } from "./test-fixtures.ts"
import type { Doc } from "./test-fixtures.ts"

// The seed documents against the Studio schemas as the Studio itself builds them (apps/studio/sanity.config.ts):
// a field renamed, a list changed or a rule tightened in the Studio fails here, not in front of the editor.

type StudioConfig = {
  projectId: string
  dataset: string
  schema: { types: TypeDef[]; templates: (templates: { schemaType: string }[]) => { schemaType: string }[] }
}

let studio: StudioConfig
let types: Types

/** The Studio configuration, imported from a computed path so that typechecking the content does not follow it into the Studio (DOM types, other syntax rules). */
async function loadStudio(): Promise<StudioConfig> {
  // the config reads them with `??`: absent, not empty, gives its defaults, so that a developer's own .env changes nothing here
  const saved = [process.env.SANITY_STUDIO_PROJECT_ID, process.env.SANITY_STUDIO_DATASET]
  delete process.env.SANITY_STUDIO_PROJECT_ID
  delete process.env.SANITY_STUDIO_DATASET
  try {
    const loaded = (await import(/* @vite-ignore */ join(GAME_DIR, "apps/studio/sanity.config.ts"))) as { default: StudioConfig }
    return loaded.default
  } finally {
    if (saved[0] !== undefined) process.env.SANITY_STUDIO_PROJECT_ID = saved[0]
    if (saved[1] !== undefined) process.env.SANITY_STUDIO_DATASET = saved[1]
  }
}

beforeAll(async () => {
  studio = await loadStudio()
  types = new Map(studio.schema.types.map((type) => [type.name, type]))
}, 60_000)

/** The kinds of document the seed writes, and the ones whose fields the Hanabi Studio defines itself (the others are shared with every game). */
const SEED_TYPES = [...new Set(seedDocs().map((doc) => doc._type))]
const OWN_TYPES = ["suit", "card", "bonusTile", "game"]

function typeOf(name: string): TypeDef {
  const type = types.get(name)
  if (!type) throw new Error(`The Studio has no type "${name}"`)
  return type
}

function fieldOf(typeName: string, field: string): FieldDef {
  const found = typeOf(typeName).fields?.find((candidate) => candidate.name === field)
  if (!found) throw new Error(`The Studio type "${typeName}" has no field "${field}"`)
  return found
}

/** A field of the items of an array field (`game.scoreScale[].key`). */
function itemFieldOf(typeName: string, arrayField: string, field: string): FieldDef {
  const found = fieldOf(typeName, arrayField)
    .of?.flatMap((member) => member.fields ?? [])
    .find((candidate) => candidate.name === field)
  if (!found) throw new Error(`The Studio type "${typeName}" has no field "${arrayField}[].${field}"`)
  return found
}

/** The values a field offers in its list, whether the list is plain values or titles with values. */
const listOf = (field: FieldDef): unknown[] =>
  (field.options?.list ?? []).map((entry) => (typeof entry === "object" && entry !== null && "value" in entry ? (entry as { value: unknown }).value : entry))

const docOf = (id: string): Doc => {
  const doc = seedDocs().find((candidate) => candidate._id === id)
  if (!doc) throw new Error(`No seed document "${id}"`)
  return doc
}

describe("the Studio", () => {
  it("is the one of the project and the dataset the seed writes to", () => {
    expect({ projectId: studio.projectId, dataset: studio.dataset }).toEqual({ projectId: PROJECT_ID, dataset: DATASET })
  })

  it("has a document type for every kind of seed document", () => {
    expect(SEED_TYPES.map((type) => [type, types.get(type)?.type])).toEqual(SEED_TYPES.map((type) => [type, "document"]))
  })

  it("lets an editor create a new document of a type exactly when the seed gives its documents ids of their own", () => {
    // the Studio offers no "new document" template for a singleton, which it opens by the name of its type
    const creatable = studio.schema.templates(SEED_TYPES.map((schemaType) => ({ schemaType }))).map(({ schemaType }) => schemaType)
    const singletons = SEED_TYPES.filter((type) => !creatable.includes(type))
    expect([...singletons].sort()).toEqual(["game", "rules", "settings"])
    for (const doc of seedDocs()) expect(doc._id === doc._type, doc._id).toBe(singletons.includes(doc._type))
  })
})

describe("the seed documents", () => {
  it.each(SEED_TYPES)("of the type %s satisfy it: the fields, their kinds, their lists and their validation rules", (type) => {
    const problems = seedDocs()
      .filter((doc) => doc._type === type)
      .flatMap((doc) => documentProblems(doc, types))
    expect(problems).toEqual([])
  })

  it.each(OWN_TYPES)("of the type %s fill every field of the Studio form, the images apart", (type) => {
    const empty = seedDocs()
      .filter((doc) => doc._type === type)
      .flatMap((doc) => emptyFields(doc, typeOf(type), doc._id, types))
    expect(empty).toEqual([])
  })

  it("read the validation rules of the real fields, which is what makes the checks above bite", () => {
    const names = (typeName: string, field: string) => constraintsOf(fieldOf(typeName, field).validation).map((constraint) => constraint.name)
    expect(names("suit", "color")).toEqual(expect.arrayContaining(["required", "regex"]))
    expect(names("suit", "letter")).toEqual(expect.arrayContaining(["required", "length"]))
    expect(names("card", "quantity")).toEqual(expect.arrayContaining(["required", "integer", "min"]))
    expect(names("game", "mat")).toEqual([])
  })

  describe("break the rules of the Studio, and are caught", () => {
    it.each<[string, string, (doc: Doc) => void, string]>([
      ["a color that is not a hex value", "suit-red", (doc) => (doc.color = "red"), "suit-red.color does not match"],
      ["a letter of two characters", "suit-red", (doc) => (doc.letter = "RR"), "suit-red.letter must be 1 long"],
      ["a missing symbol", "suit-red", (doc) => delete doc.symbol, "suit-red.symbol is required"],
      ["a suit key outside the list", "suit-red", (doc) => (doc.key = "pink"), "suit-red.key is \"pink\", not one of"],
      ["a direction outside the list", "suit-red", (doc) => (doc.direction = "sideways"), "suit-red.direction is \"sideways\", not one of"],
      ["a field the Studio does not have", "suit-red", (doc) => (doc.colour = "#ff0000"), 'suit-red.colour is not a field of "suit"'],
      ["a name that is not a localeString", "suit-red", (doc) => (doc.name = "Rouge"), "suit-red.name should be an object"],
      ["a name typed as a localeText", "suit-red", (doc) => (doc.name._type = "localeText"), 'suit-red.name._type is "localeText", expected "localeString"'],
      ["a name in a language the Studio does not have", "suit-red", (doc) => (doc.name.it = "Rosso"), "suit-red.name.it is not a field"],
      ["a quantity of zero", "card-red-1", (doc) => (doc.quantity = 0), "card-red-1.quantity must be at least 1"],
      ["a quantity with a fraction", "card-red-1", (doc) => (doc.quantity = 1.5), "card-red-1.quantity must be an integer"],
      ["a rank above 5", "card-red-1", (doc) => (doc.rank = 6), "card-red-1.rank is 6, not one of"],
      ["a rank written as text", "card-red-1", (doc) => (doc.rank = "1"), "card-red-1.rank should be a number"],
      ["a card of a suit that does not exist", "card-red-1", (doc) => (doc.suit = "purple"), "card-red-1.suit is \"purple\", not one of"],
      ["a bonus tile number above 6", "bonus-tile-1", (doc) => (doc.number = 7), "bonus-tile-1.number is 7, not one of"],
      ["a negative minimum score", "game", (doc) => (doc.scoreScale[0].minScore = -1), "game.scoreScale[0].minScore must be at least 0"],
      ["a rating outside the list", "game", (doc) => (doc.scoreScale[0].key = "perfect"), "game.scoreScale[0].key is \"perfect\", not one of"],
      ["a glyph for a value above 5", "game", (doc) => (doc.valueGlyphs[0].rank = 6), "game.valueGlyphs[0].rank is 6, not one of"],
      ["a glyph without a key", "game", (doc) => delete doc.valueGlyphs[0]._key, "game.valueGlyphs[0] has no _key"],
      ["two glyphs with the same key", "game", (doc) => (doc.valueGlyphs[1]._key = doc.valueGlyphs[0]._key), "game.valueGlyphs[1] repeats the _key"],
      ["a glyph typed as a rating", "game", (doc) => (doc.valueGlyphs[0]._type = "rating"), "game.valueGlyphs[0] has the type \"rating\", which the array does not accept"],
      ["a mat that is not an image", "game", (doc) => (doc.mat = "mat.webp"), "game.mat should be an image"],
      ["a publisher link that is not an address", "settings", (doc) => (doc.publisherUrl = "cocktailgames"), "settings.publisherUrl should be a URL"],
      ["a rulebook link with a scheme the Studio refuses", "settings", (doc) => (doc.rulesPdfFr = "ftp://example.com/rules.pdf"), "settings.rulesPdfFr should be a URL"],
      ["an introduction that is not a localeText", "rules", (doc) => (doc.intro = "Hanabi"), "rules.intro should be an object"],
      ["a section typed as something else", "rules", (doc) => (doc.sections[0]._type = "chapter"), "rules.sections[0] has the type \"chapter\""],
    ])("%s", (_name, id, change, expected) => {
      const doc = docOf(id)
      change(doc)
      expect(documentProblems(doc, types).join("\n")).toContain(expected)
    })
  })
})

describe("the option lists of the Studio", () => {
  it.each<[string, () => unknown[], readonly unknown[]]>([
    ["suit.key", () => listOf(fieldOf("suit", "key")), SUIT_KEYS],
    ["suit.extension", () => listOf(fieldOf("suit", "extension")), EXTENSION_KEYS],
    ["suit.direction", () => listOf(fieldOf("suit", "direction")), DIRECTION_KEYS],
    ["suit.pattern", () => listOf(fieldOf("suit", "pattern")), PATTERN_KEYS],
    ["card.suit", () => listOf(fieldOf("card", "suit")), SUIT_KEYS],
    ["card.rank", () => listOf(fieldOf("card", "rank")), RANKS],
    ["bonusTile.number", () => listOf(fieldOf("bonusTile", "number")), BONUS_TILE_NUMBERS],
    ["game.valueGlyphs[].rank", () => listOf(itemFieldOf("game", "valueGlyphs", "rank")), RANKS],
    ["game.scoreScale[].key", () => listOf(itemFieldOf("game", "scoreScale", "key")), RATING_KEYS],
  ])("of %s offers the values the seed is built from, in the same order", (_name, offered, expected) => {
    expect(offered()).toEqual([...expected])
  })
})

describe("the art slots, against the Studio", () => {
  /** Fresh documents with every slot filled by an image. */
  function filled() {
    const all = seedDocs()
    const byId = new Map(all.map((doc) => [doc._id, doc]))
    for (const slot of ART_SLOTS) {
      const doc = byId.get(slot.docId)
      if (!doc) throw new Error(`The slot ${slot.name} aims at "${slot.docId}", which is not a seed document`)
      slot.place(doc, imageValue(slot.name))
    }
    return all
  }

  it("fill every image field of the Studio types the seed owns, and none the Studio lacks", () => {
    const filledFields = filled().flatMap((doc) => imagesOf(doc).map(({ path }) => imageFieldOf(doc._type, path)))
    const studioFields = OWN_TYPES.flatMap((type) => imageFields(type, types))
    expect([...new Set(filledFields)].sort()).toEqual([...studioFields].sort())
  })

  it("each fill a place of their own", () => {
    const places = filled().flatMap((doc) => imagesOf(doc).map(({ path }) => `${doc._id}${path}`))
    expect(places).toHaveLength(ART_SLOTS.length)
    expect(new Set(places).size).toBe(ART_SLOTS.length)
  })

  it("leave documents that still satisfy the Studio, with every image in", () => {
    expect(filled().flatMap((doc) => documentProblems(doc, types))).toEqual([])
  })
})
