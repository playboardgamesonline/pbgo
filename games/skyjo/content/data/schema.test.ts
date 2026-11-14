import { readFileSync } from "node:fs"
import { join } from "node:path"
import { constraintsOf, documentProblems, emptyFields, imageFieldOf, imageFields, imagesOf, imageValue } from "@pbgo/content-kit/testing"
import type { Doc, FieldDef, TypeDef, Types } from "@pbgo/content-kit/testing"
import { beforeAll, describe, expect, it } from "vitest"
import { BAND_KEYS, CARD_CHOICES, CARD_KEYS } from "../../apps/studio/schemaTypes/constants.ts"
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

/** The kinds of document the seed writes, and the ones whose fields the Skyjo Studio defines itself (the others are shared with every game). */
const SEED_TYPES = [...new Set(seedDocs().map((doc) => doc._type))]
/** One document type for all the faces: they are one kind of card. */
const OWN_TYPES = ["card", "game"]
/** The image fields of the shared types that an art slot fills: the logo is the same field in every game. */
const SHARED_IMAGE_FIELDS = ["settings.logo"]

describe("the Studio", () => {
  it("is the one of the project and the dataset the seed writes to", () => {
    expect({ projectId: studio.projectId, dataset: studio.dataset }).toEqual({ projectId: PROJECT_ID, dataset: DATASET })
  })

  it("has a document type for every kind of seed document", () => {
    expect(SEED_TYPES.map((type) => [type, types.get(type)?.type])).toEqual(SEED_TYPES.map((type) => [type, "document"]))
  })

  it("has one document type for the cards: one list, the faces of one deck", () => {
    expect(types.get("card")?.type).toBe("document")
    for (const other of ["numberCard", "actionCard", "modifierCard", "cardType"]) expect(types.has(other)).toBe(false)
  })

  it("lists the cards under their own heading", () => {
    const source = readFileSync(join(GAME_DIR, "apps/studio/sanity.config.ts"), "utf8")
    expect([...source.matchAll(/\{ type: "(\w+)", title: "([^"]+)" \}/g)].map(([, type, title]) => [type, title])).toEqual([["card", "Cards"]])
  })

  it("lets an editor create a new document of a type exactly when the seed gives its documents ids of their own", () => {
    // the Studio offers no "new document" template for a singleton, which it opens by the name of its type
    const creatable = studio.schema.templates(SEED_TYPES.map((schemaType) => ({ schemaType }))).map(({ schemaType }) => schemaType)
    const singletons = SEED_TYPES.filter((type) => !creatable.includes(type))
    expect([...singletons].sort()).toEqual(["game", "settings", "texts"])
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
    expect(names(fieldOf("card", "key"))).toEqual(expect.arrayContaining(["required"]))
    expect(names(fieldOf("card", "band"))).toEqual(expect.arrayContaining(["required"]))
    expect(names(fieldOf("card", "order"))).toEqual(expect.arrayContaining(["required", "integer", "min"]))
    expect(names(fieldOf("card", "quantity"))).toEqual(expect.arrayContaining(["required", "integer", "min"]))
    expect(names(fieldOf("game", "cardBack"))).toEqual([])
  })

  describe("break the rules of the Studio, and are caught", () => {
    it.each<[string, string, (doc: Doc) => void, string]>([
      ["a value outside the list", "card-7", (doc) => (doc.key = "13"), 'card-7.key is "13", not one of'],
      ["a negative written with its sign", "card-minus-2", (doc) => (doc.key = "-2"), 'card-minus-2.key is "-2", not one of'],
      ["a missing key", "card-7", (doc) => delete doc.key, "card-7.key is required"],
      ["a colour outside the list", "card-7", (doc) => (doc.band = "purple"), 'card-7.band is "purple", not one of'],
      ["a missing colour", "card-7", (doc) => delete doc.band, "card-7.band is required"],
      ["a missing place in the list", "card-7", (doc) => delete doc.order, "card-7.order is required"],
      ["a negative place", "card-7", (doc) => (doc.order = -1), "card-7.order must be at least 0"],
      ["a place with a fraction", "card-7", (doc) => (doc.order = 1.5), "card-7.order must be an integer"],
      ["a missing quantity", "card-7", (doc) => delete doc.quantity, "card-7.quantity is required"],
      ["no copy of a card", "card-7", (doc) => (doc.quantity = 0), "card-7.quantity must be at least 1"],
      ["a fraction of a copy", "card-7", (doc) => (doc.quantity = 1.5), "card-7.quantity must be an integer"],
      ["a quantity written as text", "card-7", (doc) => (doc.quantity = "10"), "card-7.quantity should be a number"],
      ["a visual that is not an image", "card-7", (doc) => (doc.image = "7.webp"), "card-7.image should be an image"],
      ["a name, which a figure does not have", "card-7", (doc) => (doc.name = { _type: "localeString", fr: "7", en: "7", es: "7", de: "7" }), 'card-7.name is not a field of "card"'],
      ["an effect, which a card no longer has", "card-7", (doc) => (doc.effect = "Nothing."), 'card-7.effect is not a field of "card"'],
      ["a rule, which a card does not have either", "card-7", (doc) => (doc.rule = "Nothing."), 'card-7.rule is not a field of "card"'],
      ["a field the Studio does not have", "card-7", (doc) => (doc.colour = "#ff0000"), 'card-7.colour is not a field of "card"'],
      ["a card back that is not an image", "game", (doc) => (doc.cardBack = "back.webp"), "game.cardBack should be an image"],
      ["a field the game document no longer has: the mat", "game", (doc) => (doc.mat = "mat.webp"), 'game.mat is not a field of "game"'],
      ["a publisher link that is not an address", "settings", (doc) => (doc.publisherUrl = "magilano"), "settings.publisherUrl should be a URL"],
    ])("%s", (_name, id, change, expected) => {
      const doc = docOf(id)
      change(doc)
      expect(documentProblems(doc, types).join("\n")).toContain(expected)
    })
  })
})

describe("the option lists of the Studio", () => {
  it("of the cards offers the keys the seed is built from, in the same order", () => {
    const offered = listOf(fieldOf("card", "key"))
    expect(offered).toEqual([...CARD_KEYS])
    expect(offered).toEqual(seedDocs().filter((doc) => doc._type === "card").map((doc) => doc.key))
    expect(CARD_CHOICES.map((choice) => choice.title)).toEqual(["-2", "-1", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"])
  })

  it("of the colours offers the five bands, lowest values first", () => {
    expect(listOf(fieldOf("card", "band"))).toEqual([...BAND_KEYS])
  })

  it("sorts the cards on their place in the list by default", () => {
    const { orderings } = typeOf("card") as TypeDef & { orderings?: { by: unknown[] }[] }
    expect(orderings?.[0]?.by).toEqual([{ field: "order", direction: "asc" }])
  })
})

// The rules every game's cards follow (the skill `game-sanity-create`; the model is Hanabi's schema.test.ts). The game singleton only holds the
// picture of the card back, so it follows the one about descriptions too, and the one about tabs.
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
    expect(groups.map((group) => group.name)).toEqual(["backs"])
    expect(groups.filter((group) => group.default).map((group) => group.name)).toEqual(["backs"])
    expect(fields.map((field) => [field.name, field.group])).toEqual([["cardBack", "backs"]])
  })

  it("ends a card with the visual, and the quantity comes right before it; the identity comes first", () => {
    expect(fieldNames("card")).toEqual(["key", "band", "order", "quantity", "image"])
    expect(fieldOf("card", "image").type).toBe("image")
  })

  it("gives a card an English game key and no name: it is named by the figure printed on it", () => {
    expect(fieldOf("card", "key").type).toBe("string")
    expect(listOf(fieldOf("card", "key")).length).toBeGreaterThan(0)
    expect(fieldNames("card")).not.toContain("name")
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

  it("each fill a place of their own: 15 faces, the back and the logo", () => {
    const places = filled().flatMap((doc) => imagesOf(doc).map(({ path }) => `${doc._id}${path}`))
    expect(places).toHaveLength(ART_SLOTS.length)
    expect(ART_SLOTS).toHaveLength(17)
    expect(new Set(places).size).toBe(ART_SLOTS.length)
  })

  it("leave documents that still satisfy the Studio, with every image in", () => {
    expect(filled().flatMap((doc) => documentProblems(doc, types))).toEqual([])
  })
})
