import { readFileSync } from "node:fs"
import { join } from "node:path"
import { constraintsOf, documentProblems, emptyFields, imageFieldOf, imageFields, imagesOf, imageValue } from "@pbgo/content-kit/testing"
import type { Doc, FieldDef, TypeDef, Types } from "@pbgo/content-kit/testing"
import { beforeAll, describe, expect, it } from "vitest"
import { CHARACTER_KEYS, CHARACTERS } from "../../apps/studio/schemaTypes/constants.ts"
import { DATASET, GAME_DIR, PROJECT_ID } from "../config.ts"
import { ART_SLOTS } from "./art-manifest.ts"
import { seedDocs } from "./test-fixtures.ts"

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

/** The values a field offers in its list, whether the list is plain values or titles with values. */
const listOf = (field: FieldDef): unknown[] =>
  (field.options?.list ?? []).map((entry) => (typeof entry === "object" && entry !== null && "value" in entry ? (entry as { value: unknown }).value : entry))

const docOf = (id: string): Doc => {
  const doc = seedDocs().find((candidate) => candidate._id === id)
  if (!doc) throw new Error(`No seed document "${id}"`)
  return doc
}

/** The kinds of document the seed writes, and the ones whose fields the Love Letter Studio defines itself (the others are shared with every game). */
const SEED_TYPES = [...new Set(seedDocs().map((doc) => doc._type))]
/** One document type for all the characters: they are one kind of card. */
const OWN_TYPES = ["character", "game"]
/** The image fields of the shared types that an art slot fills: the logo is the same field in every game. */
const SHARED_IMAGE_FIELDS = ["settings.logo"]
/** What the seed leaves empty on purpose: the Spanish and the German of the ten names and of the ten card texts, which have no source yet. */
const GAPS = CHARACTER_KEYS.flatMap((key) => ["name", "text"].flatMap((field) => ["es", "de"].map((language) => `character-${key}.${field}.${language}`)))

describe("the Studio", () => {
  it("is the one of the project and the dataset the seed writes to", () => {
    expect({ projectId: studio.projectId, dataset: studio.dataset }).toEqual({ projectId: PROJECT_ID, dataset: DATASET })
  })

  it("has a document type for every kind of seed document", () => {
    expect(SEED_TYPES.map((type) => [type, types.get(type)?.type])).toEqual(SEED_TYPES.map((type) => [type, "document"]))
  })

  it("has one document type for the characters: one list, the ten kinds of one deck, and no category", () => {
    expect(types.get("character")?.type).toBe("document")
    for (const other of ["card", "numberCard", "actionCard", "modifierCard", "cardType", "category", "family"]) expect(types.has(other)).toBe(false)
  })

  it("lists the characters under their own heading", () => {
    const source = readFileSync(join(GAME_DIR, "apps/studio/sanity.config.ts"), "utf8")
    expect([...source.matchAll(/\{ type: "(\w+)", title: "([^"]+)" \}/g)].map(([, type, title]) => [type, title])).toEqual([["character", "Characters"]])
  })

  it("lets an editor create a new document of a type exactly when the seed gives its documents ids of their own", () => {
    // the Studio offers no "new document" template for a singleton, which it opens by the name of its type
    const creatable = studio.schema.templates(SEED_TYPES.map((schemaType) => ({ schemaType }))).map(({ schemaType }) => schemaType)
    const singletons = SEED_TYPES.filter((type) => !creatable.includes(type))
    expect([...singletons].sort()).toEqual(["game", "settings"])
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

  it.each(OWN_TYPES)("of the type %s fill every field of the Studio form, the images and files apart, but the Spanish and German gaps", (type) => {
    const empty = seedDocs()
      .filter((doc) => doc._type === type)
      .flatMap((doc) => emptyFields(doc, typeOf(type), doc._id, types))
    expect([...empty].sort()).toEqual(type === "character" ? [...GAPS].sort() : [])
  })

  it("leave 40 gaps on purpose: the Spanish and the German of ten names and ten card texts", () => {
    expect(GAPS).toHaveLength(40)
    expect(GAPS.slice(0, 4)).toEqual(["character-spy.name.es", "character-spy.name.de", "character-spy.text.es", "character-spy.text.de"])
  })

  it("read the validation rules of the real fields, which is what makes the checks above bite", () => {
    const names = (field: FieldDef) => constraintsOf(field.validation).map((constraint) => constraint.name)
    expect(names(fieldOf("character", "key"))).toEqual(expect.arrayContaining(["required"]))
    expect(names(fieldOf("character", "value"))).toEqual(expect.arrayContaining(["required", "integer", "min", "max"]))
    expect(names(fieldOf("character", "quantity"))).toEqual(expect.arrayContaining(["required", "integer", "min"]))
    expect(names(fieldOf("game", "cardBack"))).toEqual([])
  })

  describe("break the rules of the Studio, and are caught", () => {
    it.each<[string, string, (doc: Doc) => void, string]>([
      ["a key outside the list", "character-spy", (doc) => (doc.key = "jester"), 'character-spy.key is "jester", not one of'],
      ["a missing key", "character-spy", (doc) => delete doc.key, "character-spy.key is required"],
      ["a value above nine", "character-spy", (doc) => (doc.value = 10), "character-spy.value must be at most 9"],
      ["a negative value", "character-spy", (doc) => (doc.value = -1), "character-spy.value must be at least 0"],
      ["a value with a fraction", "character-spy", (doc) => (doc.value = 1.5), "character-spy.value must be an integer"],
      ["a missing value", "character-spy", (doc) => delete doc.value, "character-spy.value is required"],
      ["a value written as text", "character-spy", (doc) => (doc.value = "0"), "character-spy.value should be a number"],
      ["a missing quantity", "character-guard", (doc) => delete doc.quantity, "character-guard.quantity is required"],
      ["no copy of a character", "character-guard", (doc) => (doc.quantity = 0), "character-guard.quantity must be at least 1"],
      ["a fraction of a copy", "character-guard", (doc) => (doc.quantity = 1.5), "character-guard.quantity must be an integer"],
      ["a quantity written as text", "character-guard", (doc) => (doc.quantity = "6"), "character-guard.quantity should be a number"],
      ["a visual that is not an image", "character-spy", (doc) => (doc.image = "spy.webp"), "character-spy.image should be an image"],
      ["a name written as plain text", "character-spy", (doc) => (doc.name = "Spy"), "character-spy.name should be an object"],
      ["a name in a language the Studio does not have", "character-spy", (doc) => (doc.name = { _type: "localeString", fr: "Espionne", en: "Spy", it: "Spia" }), "character-spy.name.it is not a field"],
      ["a card text written as plain text", "character-spy", (doc) => (doc.text = "Does nothing."), "character-spy.text should be an object"],
      ["an effect, which a character does not have", "character-spy", (doc) => (doc.effect = "Nothing."), 'character-spy.effect is not a field of "character"'],
      ["a rule, which a character does not have either", "character-spy", (doc) => (doc.rule = "Nothing."), 'character-spy.rule is not a field of "character"'],
      ["a field the Studio does not have", "character-spy", (doc) => (doc.colour = "#ff0000"), 'character-spy.colour is not a field of "character"'],
      ["a card back that is not an image", "game", (doc) => (doc.cardBack = "back.webp"), "game.cardBack should be an image"],
      ["a favor token symbol that is not an image", "game", (doc) => (doc.favorTokenSymbol = "symbol.svg"), "game.favorTokenSymbol should be an image"],
      ["a favor token model that is not a file", "game", (doc) => (doc.favorTokenModel = "token.glb"), "game.favorTokenModel should be a file"],
      ["a publisher link that is not an address", "settings", (doc) => (doc.publisherUrl = "zmangames"), "settings.publisherUrl should be a URL"],
    ])("%s", (_name, id, change, expected) => {
      const doc = docOf(id)
      change(doc)
      expect(documentProblems(doc, types).join("\n")).toContain(expected)
    })
  })
})

describe("the option lists of the Studio", () => {
  it("of the characters offers the keys the seed is built from, in the same order", () => {
    const offered = listOf(fieldOf("character", "key"))
    expect(offered).toEqual([...CHARACTER_KEYS])
    expect(offered).toEqual(seedDocs().filter((doc) => doc._type === "character").map((doc) => doc.key))
    expect(CHARACTERS.map((choice) => choice.title)).toEqual(["Spy", "Guard", "Priest", "Baron", "Handmaid", "Prince", "Chancellor", "King", "Countess", "Princess"])
  })

  it("sorts the characters on their value by default", () => {
    const { orderings } = typeOf("character") as TypeDef & { orderings?: { by: unknown[] }[] }
    expect(orderings?.[0]?.by).toEqual([{ field: "value", direction: "asc" }])
  })
})

// The rules every game's cards follow (the skill `game-sanity-create`; the model is Hanabi's schema.test.ts). The card text is the one exception to "no Effect or Rule field": a text to display on the card's plate, by decision, named `text`.
describe("the forms of the cards", () => {
  const fieldNames = (type: string) => (typeOf(type).fields ?? []).map((field) => field.name)

  it.each(OWN_TYPES)("of the type %s have no Effect or Rule field, and no description under any field", (type) => {
    expect(fieldNames(type).filter((name) => ["effect", "rule"].includes(name.toLowerCase()))).toEqual([])
    expect((typeOf(type).fields ?? []).filter((field) => "description" in field).map((field) => field.name)).toEqual([])
  })

  it("files the game document in tabs: exactly one open by default, every field in a tab it declares", () => {
    const { groups = [], fields = [] } = typeOf("game") as Omit<TypeDef, "fields"> & {
      groups?: { name: string; default?: boolean }[]
      fields?: (FieldDef & { group?: string })[]
    }
    expect(groups.map((group) => group.name)).toEqual(["board", "backs", "token"])
    expect(groups.filter((group) => group.default).map((group) => group.name)).toEqual(["board"])
    expect(fields.map((field) => [field.name, field.group])).toEqual([
      ["mat", "board"],
      ["cardBack", "backs"],
      ["favorTokenSymbol", "token"],
      ["favorTokenMask", "token"],
      ["favorTokenModel", "token"],
    ])
  })

  it("gives the favor token its three files: a symbol and a mask as images, a 3D model as a file", () => {
    expect(fieldOf("game", "favorTokenSymbol").type).toBe("image")
    expect(fieldOf("game", "favorTokenMask").type).toBe("image")
    expect(fieldOf("game", "favorTokenModel").type).toBe("file")
  })

  it("ends a character with the visual, and the quantity comes right before it; the identity comes first, the card text after the name", () => {
    expect(fieldNames("character")).toEqual(["key", "value", "name", "text", "quantity", "image"])
    expect(fieldOf("character", "image").type).toBe("image")
  })

  it("gives a character an English game key, a value that is read-only, and a localized name and card text", () => {
    expect(fieldOf("character", "key").type).toBe("string")
    expect(listOf(fieldOf("character", "key")).length).toBeGreaterThan(0)
    expect((fieldOf("character", "value") as FieldDef & { readOnly?: boolean }).readOnly).toBe(true)
    expect(fieldOf("character", "name").type).toBe("localeString")
    expect(fieldOf("character", "text").type).toBe("localeText")
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

  it("fill every image field of the Studio types the seed owns, and none the Studio lacks (the 3D model is a file, which no slot fills)", () => {
    const filledFields = filled()
      .filter((doc) => OWN_TYPES.includes(doc._type))
      .flatMap((doc) => imagesOf(doc).map(({ path }) => imageFieldOf(doc._type, path)))
    const studioFields = OWN_TYPES.flatMap((type) => imageFields(type, types))
    expect([...new Set(filledFields)].sort()).toEqual([...studioFields].sort())
    expect(studioFields).not.toContain("game.favorTokenModel")
  })

  it("fill the image fields of the shared types that exist in the Studio, and no other", () => {
    const filledFields = filled()
      .filter((doc) => !OWN_TYPES.includes(doc._type))
      .flatMap((doc) => imagesOf(doc).map(({ path }) => imageFieldOf(doc._type, path)))
    expect([...new Set(filledFields)].sort()).toEqual(SHARED_IMAGE_FIELDS)
    for (const field of SHARED_IMAGE_FIELDS) expect(imageFields(field.split(".")[0] as string, types), field).toContain(field)
  })

  it("each fill a place of their own: ten faces, the back, the token's symbol and mask, the mat and the logo", () => {
    const places = filled().flatMap((doc) => imagesOf(doc).map(({ path }) => `${doc._id}${path}`))
    expect(places).toHaveLength(ART_SLOTS.length)
    expect(ART_SLOTS).toHaveLength(15)
    expect(new Set(places).size).toBe(ART_SLOTS.length)
  })

  it("leave documents that still satisfy the Studio, with every image in", () => {
    expect(filled().flatMap((doc) => documentProblems(doc, types))).toEqual([])
  })
})
