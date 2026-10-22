import { readFileSync } from "node:fs"
import { join } from "node:path"
import { LANGUAGE_IDS } from "@pbgo/content-kit"
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
      ["a visual that is not an image", "number-card-7", (doc) => (doc.image = "7.webp"), "number-card-7.image should be an image"],
      ["a name that is not a localeString", "action-card-freeze", (doc) => (doc.name = "Freeze"), "action-card-freeze.name should be an object"],
      ["a name typed as a localeText", "action-card-freeze", (doc) => (doc.name._type = "localeText"), 'action-card-freeze.name._type is "localeText", expected "localeString"'],
      ["a name in a language the Studio does not have", "action-card-freeze", (doc) => (doc.name.it = "Congelare"), "action-card-freeze.name.it is not a field"],
      ["a name on a number, which its figure names", "number-card-7", (doc) => (doc.name = { _type: "localeString", fr: "7", en: "7", es: "7", de: "7" }), 'number-card-7.name is not a field of "numberCard"'],
      ["a name on a modifier, which its figure names too", "modifier-card-times-2", (doc) => (doc.name = { _type: "localeString", fr: "x2", en: "x2", es: "x2", de: "x2" }), 'modifier-card-times-2.name is not a field of "modifierCard"'],
      ["an effect, which a card no longer has", "action-card-freeze", (doc) => (doc.effect = "Freezes."), 'action-card-freeze.effect is not a field of "actionCard"'],
      ["a rule, which a card does not have either", "modifier-card-times-2", (doc) => (doc.rule = "Doubles."), 'modifier-card-times-2.rule is not a field of "modifierCard"'],
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

// The rules every game's cards follow (the skill `game-sanity-create`; the model is Hanabi's schema.test.ts). The game singleton only holds the
// pictures of the card back, the box and the mat, so it follows the one about descriptions too, and the one about tabs.
describe("the forms of the cards", () => {
  const FORM_TYPES = [...CARD_TYPES, "game"]
  const fieldNames = (type: string) => (typeOf(type).fields ?? []).map((field) => field.name)

  it.each(FORM_TYPES)("of the type %s have no Effect or Rule field, and no description under any field", (type) => {
    expect(fieldNames(type).filter((name) => ["effect", "rule"].includes(name.toLowerCase()))).toEqual([])
    expect((typeOf(type).fields ?? []).filter((field) => "description" in field).map((field) => field.name)).toEqual([])
  })

  it("files the game document in tabs, as Courtisans' is: exactly one open by default, every field in a tab it declares", () => {
    const { groups = [], fields = [] } = typeOf("game") as Omit<TypeDef, "fields"> & {
      groups?: { name: string; default?: boolean }[]
      fields?: (FieldDef & { group?: string })[]
    }
    const tabs = groups.map((group) => group.name)
    expect(tabs).toEqual(["board", "backs", "box"])
    expect(groups.filter((group) => group.default).map((group) => group.name)).toEqual(["board"])
    expect(fields.map((field) => [field.name, field.group])).toEqual([
      ["mat", "board"],
      ["cardBack", "backs"],
      ["boxFront", "box"],
      ["boxBack", "box"],
    ])
  })

  it.each(CARD_TYPES)("of the type %s end with the visual, and the copies come right before it", (type) => {
    expect(fieldNames(type).at(-1)).toBe("image")
    expect(fieldOf(type, "image").type).toBe("image")
    expect(fieldNames(type).at(-2)).toBe("copies")
  })

  it.each(CARD_TYPES)("of the type %s have an English game key", (type) => {
    expect(fieldNames(type)).toContain("key")
    expect(fieldOf(type, "key").type).toBe("string")
    expect(listOf(fieldOf(type, "key")).length).toBeGreaterThan(0)
  })

  // A 7, a +4 and the x2 are named by the figure printed on them, which is their key: there is nothing to translate, so no name. Only the three
  // action cards, named by words, carry a name in the four languages.
  it("give a name in the four languages to the action cards alone: a figure card is named by its key", () => {
    expect(fieldOf("actionCard", "name").type).toBe("localeString")
    for (const type of CARD_TYPES.filter((candidate) => candidate !== "actionCard")) expect(fieldNames(type), type).not.toContain("name")
  })
})

// The words of the board the seed writes into `texts` (the printed ones only, see texts.ts): each is a field of the Flip 7 vocabulary of the Studio
// (`word()` of schemaTypes/texts.ts, a localeString in the "board" tab). The rest of the vocabulary is the owner's to write there, so the form is not
// expected to be filled, unlike the cards'.
describe("the texts, against the Studio", () => {
  const texts = () => docOf("texts")
  const seeded = () => Object.keys(texts()).filter((field) => !field.startsWith("_"))
  const slotsOf = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map(([, slot]) => slot)

  it("write fields the Studio has, each a localeString in the board tab", () => {
    expect(seeded().length).toBeGreaterThan(0)
    for (const field of seeded()) {
      const found = fieldOf("texts", field)
      expect(found.type, field).toBe("localeString")
      expect(found.group, field).toBe("board")
    }
  })

  it("only use the slots that the title of the field declares", () => {
    for (const field of seeded()) {
      const declared = slotsOf((fieldOf("texts", field) as FieldDef & { title?: string }).title ?? "")
      for (const language of LANGUAGE_IDS) {
        for (const slot of slotsOf(texts()[field][language])) expect(declared, `${field} ${language}`).toContain(slot)
      }
    }
  })

  it("leave the owner words to write: the Studio has more words of the board than the seed fills", () => {
    const vocabulary = (typeOf("texts").fields ?? []).filter((field) => field.group === "board").map((field) => field.name)
    expect(vocabulary.filter((name) => !seeded().includes(name)).length).toBeGreaterThan(0)
    expect(seeded().filter((name) => !vocabulary.includes(name))).toEqual([])
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
