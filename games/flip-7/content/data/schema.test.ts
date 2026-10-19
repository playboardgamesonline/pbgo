import { readFileSync } from "node:fs"
import { join } from "node:path"
import { constraintsOf, documentProblems, emptyFields, imageFieldOf, imageFields, imagesOf, imageValue } from "@pbgo/content-kit/testing"
import type { Doc, FieldDef, TypeDef, Types } from "@pbgo/content-kit/testing"
import { beforeAll, describe, expect, it } from "vitest"
import { CATEGORIES, CATEGORY_KEYS } from "../../apps/studio/schemaTypes/constants.ts"
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

/** The kinds of document the seed writes, and the ones whose fields the Flip 7 Studio defines itself (the others are shared with every game). */
const SEED_TYPES = [...new Set(seedDocs().map((doc) => doc._type))]
/** One document type per category of cards, in the order the Studio lists them: number, action, modifier. */
const CARD_TYPES = CATEGORY_KEYS.map((category) => CATEGORIES[category].type)
const OWN_TYPES = [...CARD_TYPES, "game"]
/** The image fields of the shared types that an art slot fills: the logo is the same field in every game. */
const SHARED_IMAGE_FIELDS = ["settings.logo"]

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

describe("the Studio", () => {
  it("is the one of the project and the dataset the seed writes to", () => {
    expect({ projectId: studio.projectId, dataset: studio.dataset }).toEqual({ projectId: PROJECT_ID, dataset: DATASET })
  })

  it("has a document type for every kind of seed document", () => {
    expect(SEED_TYPES.map((type) => [type, types.get(type)?.type])).toEqual(SEED_TYPES.map((type) => [type, "document"]))
  })

  it("has one document type per category of cards, and no longer a single list of them all", () => {
    expect(CARD_TYPES).toEqual(["numberCard", "actionCard", "modifierCard"])
    expect(CARD_TYPES.map((type) => [type, types.get(type)?.type])).toEqual(CARD_TYPES.map((type) => [type, "document"]))
    expect(types.has("cardType")).toBe(false)
  })

  it("lists the categories of cards in this order, each under its own heading: number, action, modifier", () => {
    const source = readFileSync(join(GAME_DIR, "apps/studio/sanity.config.ts"), "utf8")
    const listed = [...source.matchAll(/\{ type: "(\w+)", title: "([^"]+)" \}/g)].map(([, type, title]) => [type, title])
    expect(listed).toEqual([
      ["numberCard", "Number cards"],
      ["actionCard", "Action cards"],
      ["modifierCard", "Modifier cards"],
    ])
    expect(listed.map(([type]) => type)).toEqual(CARD_TYPES)
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

  it.each(OWN_TYPES)("of the type %s fill every field of the Studio form, the images apart", (type) => {
    const empty = seedDocs()
      .filter((doc) => doc._type === type)
      .flatMap((doc) => emptyFields(doc, typeOf(type), doc._id, types))
    expect(empty).toEqual([])
  })

  it("read the validation rules of the real fields, which is what makes the checks above bite", () => {
    const names = (field: FieldDef) => constraintsOf(field.validation).map((constraint) => constraint.name)
    for (const type of CARD_TYPES) {
      expect(names(fieldOf(type, "key")), `${type}.key`).toEqual(expect.arrayContaining(["required"]))
      expect(names(fieldOf(type, "order")), `${type}.order`).toEqual(expect.arrayContaining(["required", "integer", "min"]))
      expect(names(fieldOf(type, "copies")), `${type}.copies`).toEqual(expect.arrayContaining(["required", "integer", "min"]))
    }
    expect(names(fieldOf("game", "mat"))).toEqual([])
  })

  describe("break the rules of the Studio, and are caught", () => {
    it.each<[string, string, (doc: Doc) => void, string]>([
      ["a number outside the list", "number-card-7", (doc) => (doc.key = "13"), 'number-card-7.key is "13", not one of'],
      ["the key of another category", "action-card-freeze", (doc) => (doc.key = "plus-2"), 'action-card-freeze.key is "plus-2", not one of'],
      ["a modifier outside the list", "modifier-card-plus-4", (doc) => (doc.key = "plus-3"), 'modifier-card-plus-4.key is "plus-3", not one of'],
      ["a missing key", "number-card-7", (doc) => delete doc.key, "number-card-7.key is required"],
      ["a kind, which the category now says", "number-card-7", (doc) => (doc.kind = "number"), 'number-card-7.kind is not a field of "numberCard"'],
      ["a missing place in the category", "number-card-7", (doc) => delete doc.order, "number-card-7.order is required"],
      ["a negative place in the category", "number-card-7", (doc) => (doc.order = -1), "number-card-7.order must be at least 0"],
      ["a place with a fraction", "number-card-7", (doc) => (doc.order = 1.5), "number-card-7.order must be an integer"],
      ["a missing number of copies", "number-card-7", (doc) => delete doc.copies, "number-card-7.copies is required"],
      ["no copy of a card", "number-card-7", (doc) => (doc.copies = 0), "number-card-7.copies must be at least 1"],
      ["a fraction of a copy", "number-card-7", (doc) => (doc.copies = 1.5), "number-card-7.copies must be an integer"],
      ["copies written as text", "number-card-7", (doc) => (doc.copies = "7"), "number-card-7.copies should be a number"],
      ["a card face that is not an image", "number-card-7", (doc) => (doc.image = "7.webp"), "number-card-7.image should be an image"],
      ["a name that is not a localeString", "action-card-freeze", (doc) => (doc.name = "Freeze"), "action-card-freeze.name should be an object"],
      ["a name typed as a localeText", "action-card-freeze", (doc) => (doc.name._type = "localeText"), 'action-card-freeze.name._type is "localeText", expected "localeString"'],
      ["a name in a language the Studio does not have", "action-card-freeze", (doc) => (doc.name.it = "Congelare"), "action-card-freeze.name.it is not a field"],
      ["an effect that is not a localeText", "action-card-freeze", (doc) => (doc.effect = "Freezes."), "action-card-freeze.effect should be an object"],
      ["a field the Studio does not have", "modifier-card-times-2", (doc) => (doc.colour = "#ff0000"), 'modifier-card-times-2.colour is not a field of "modifierCard"'],
      ["a card back that is not an image", "game", (doc) => (doc.cardBack = "back.webp"), "game.cardBack should be an image"],
      ["a mat that is not an image", "game", (doc) => (doc.mat = "mat.webp"), "game.mat should be an image"],
      ["a publisher link that is not an address", "settings", (doc) => (doc.publisherUrl = "theopgames"), "settings.publisherUrl should be a URL"],
    ])("%s", (_name, id, change, expected) => {
      const doc = docOf(id)
      change(doc)
      expect(documentProblems(doc, types).join("\n")).toContain(expected)
    })
  })
})

describe("the option lists of the Studio", () => {
  it.each(CATEGORY_KEYS)("of the %s cards offers the keys the seed is built from, in the same order", (category) => {
    const { type } = CATEGORIES[category]
    const choices: { value: string }[] = CATEGORIES[category].choices
    const offered = listOf(fieldOf(type, "key"))
    expect(offered).toEqual(choices.map((choice) => choice.value))
    expect(offered).toEqual(seedDocs().filter((doc) => doc._type === type).map((doc) => doc.key))
  })

  it.each(CARD_TYPES)("of %s sorts its cards on their place in the category by default", (type) => {
    const { orderings } = typeOf(type) as TypeDef & { orderings?: { by: unknown[] }[] }
    expect(orderings?.[0]?.by).toEqual([{ field: "order", direction: "asc" }])
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
    const filledFields = filled()
      .filter((doc) => OWN_TYPES.includes(doc._type))
      .flatMap((doc) => imagesOf(doc).map(({ path }) => imageFieldOf(doc._type, path)))
    const studioFields = OWN_TYPES.flatMap((type) => imageFields(type, types))
    expect([...new Set(filledFields)].sort()).toEqual([...studioFields].sort())
  })

  it("fill the image fields of the shared types that exist in the Studio, and no other", () => {
    const filledFields = filled()
      .filter((doc) => !OWN_TYPES.includes(doc._type))
      .flatMap((doc) => imagesOf(doc).map(({ path }) => imageFieldOf(doc._type, path)))
    expect([...new Set(filledFields)].sort()).toEqual(SHARED_IMAGE_FIELDS)
    for (const field of SHARED_IMAGE_FIELDS) expect(imageFields(field.split(".")[0] as string, types), field).toContain(field)
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
