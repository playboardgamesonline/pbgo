import { join } from "node:path"
import { constraintsOf, documentProblems } from "@pbgo/content-kit/testing"
import type { Doc, FieldDef, TypeDef, Types } from "@pbgo/content-kit/testing"
import { beforeAll, describe, expect, it } from "vitest"
import { FAMILIES, ROLES } from "../../apps/studio/schemaTypes/constants.ts"
import { DATASET, GAME_DIR, PROJECT_ID } from "../config.ts"
import { FAMILY_KEYS } from "./families.ts"
import { ROLE_KEYS } from "./roles.ts"
import { seedDocs } from "./test-fixtures.ts"

// The seed documents against the Studio schemas as the Studio itself builds them (apps/studio/sanity.config.ts):
// a field renamed, a list changed or a rule tightened in the Studio fails here, not in front of the editor.
// The form rules of the Studio (no description, tabs, the order of the fields) are checked by studio-forms.test.ts, next to its sanity.config.ts.

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

/** The kinds of document the seed writes. */
const SEED_TYPES = [...new Set(seedDocs().map((doc) => doc._type))]

/**
 * The seed only adds translations to documents the Studio already holds, so it leaves out the fields that make a family a family
 * (its key, colour and pictogram…): the required ones are listed here, and the only problems the seed documents may have.
 */
const UNWRITTEN: Record<string, string[]> = {
  family: ["key", "color", "pictogram"],
  role: ["key", "countPerFamily", "pictogram"],
  mission: ["color", "card", "condition"],
  texts: [],
}

const missing = (doc: Doc, fields: string[]) => fields.map((field) => `${doc._id}.${field} is required`)

/** What is wrong with a seed document, once the required fields it leaves to the Studio are set aside. */
function problemsOf(doc: Doc): string[] {
  const unwritten = missing(doc, UNWRITTEN[doc._type] ?? [])
  return documentProblems(doc, types).filter((problem) => !unwritten.includes(problem))
}

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

  it("lets an editor create a new document of a type exactly when the seed gives its documents ids of their own", () => {
    // the Studio offers no "new document" template for a singleton, which it opens by the name of its type
    const creatable = studio.schema.templates(SEED_TYPES.map((schemaType) => ({ schemaType }))).map(({ schemaType }) => schemaType)
    const singletons = SEED_TYPES.filter((type) => !creatable.includes(type))
    expect([...singletons].sort()).toEqual(["texts"])
    for (const doc of seedDocs()) expect(doc._id === doc._type, doc._id).toBe(singletons.includes(doc._type))
  })
})

describe("the seed documents", () => {
  it.each(SEED_TYPES)("of the type %s satisfy it: the fields, their kinds, their lists and their validation rules", (type) => {
    const problems = seedDocs()
      .filter((doc) => doc._type === type)
      .flatMap(problemsOf)
    expect(problems).toEqual([])
  })

  it.each(SEED_TYPES)("of the type %s leave out exactly the required fields of the Studio that the documents already in it hold", (type) => {
    // a new required field in the Studio fails here, and is then either written by the seed or listed in UNWRITTEN
    const doc = seedDocs().find((candidate) => candidate._type === type)
    if (!doc) throw new Error(`No seed document of the type "${type}"`)
    const required = documentProblems(doc, types).filter((problem) => problem.endsWith(" is required"))
    expect([...required].sort()).toEqual([...missing(doc, UNWRITTEN[type] ?? [])].sort())
  })

  it("read the validation rules of the real fields, which is what makes the checks above bite", () => {
    const names = (typeName: string, field: string) => constraintsOf(fieldOf(typeName, field).validation).map((constraint) => constraint.name)
    expect(names("family", "color")).toEqual(expect.arrayContaining(["required", "regex"]))
    expect(names("family", "key")).toEqual(expect.arrayContaining(["required"]))
    expect(names("role", "countPerFamily")).toEqual(expect.arrayContaining(["required", "integer", "min"]))
    expect(names("mission", "color")).toEqual(expect.arrayContaining(["required"]))
  })

  describe("break the rules of the Studio, and are caught", () => {
    it.each<[string, string, (doc: Doc) => void, string]>([
      ["a family name that is not a localeString", "family-butterfly", (doc) => (doc.name = "Papillon"), "family-butterfly.name should be an object"],
      ["a family name typed as a localeText", "family-butterfly", (doc) => (doc.name._type = "localeText"), 'family-butterfly.name._type is "localeText", expected "localeString"'],
      ["a family name in a language the Studio does not have", "family-butterfly", (doc) => (doc.name.it = "Farfalla"), "family-butterfly.name.it is not a field"],
      ["a field the Studio does not have", "family-butterfly", (doc) => (doc.colour = "#ff0000"), 'family-butterfly.colour is not a field of "family"'],
      ["a role rule typed as a localeString", "role-spy", (doc) => (doc.rule._type = "localeString"), 'role-spy.rule._type is "localeString", expected "localeText"'],
      ["a role name that is not a localeString", "role-spy", (doc) => (doc.name = "Espion"), "role-spy.name should be an object"],
      ["a mission text typed as a localeString", "mission-light-1", (doc) => (doc.text._type = "localeString"), 'mission-light-1.text._type is "localeString", expected "localeText"'],
      ["a mission text that is not an object", "mission-light-1", (doc) => (doc.text = "Une mission"), "mission-light-1.text should be an object"],
      ["an effect on a mission, which no card of any game has", "mission-light-1", (doc) => (doc.effect = "Gagner"), 'mission-light-1.effect is not a field of "mission"'],
      ["a tagline typed as a localeText", "texts", (doc) => (doc.tagline._type = "localeText"), 'texts.tagline._type is "localeText", expected "localeString"'],
      ["a home intro typed as a localeString", "texts", (doc) => (doc.homeIntro._type = "localeString"), 'texts.homeIntro._type is "localeString", expected "localeText"'],
      ["a list of victory phrases that is not a list", "texts", (doc) => (doc.victoryPhrases.fr = "Bravo"), "texts.victoryPhrases.fr should be an array"],
      ["a victory phrase in a language the Studio does not have", "texts", (doc) => (doc.victoryPhrases.it = ["Bravo"]), "texts.victoryPhrases.it is not a field"],
      ["a text of the home screen that is not a localeString", "texts", (doc) => (doc.ui_home.createButton = "Créer"), "texts.ui_home.createButton should be an object"],
      ["a text the home screen does not have", "texts", (doc) => (doc.ui_home.frobnicate = doc.ui_home.createButton), "texts.ui_home.frobnicate is not a field"],
      ["a group of texts the Studio does not have", "texts", (doc) => (doc.ui_menu = {}), 'texts.ui_menu is not a field of "texts"'],
      ["an error message without a key", "texts", (doc) => delete doc.errorMessages[0]._key, "texts.errorMessages[0] has no _key"],
      ["two error messages with the same key", "texts", (doc) => (doc.errorMessages[1]._key = doc.errorMessages[0]._key), "texts.errorMessages[1] repeats the _key"],
      ["an error message typed as a localeString", "texts", (doc) => (doc.errorMessages[0]._type = "localeString"), 'texts.errorMessages[0] has the type "localeString", which the array does not accept'],
      ["an error message that is not a localeString", "texts", (doc) => (doc.errorMessages[0].message = "Perdu"), "texts.errorMessages[0].message should be an object"],
      ["a missions button typed as a localeText", "texts", (doc) => (doc.missionsButton._type = "localeText"), 'texts.missionsButton._type is "localeText", expected "localeString"'],
      ["a banquet start in a language the Studio does not have", "texts", (doc) => (doc.banquetStarts.it = "Il banchetto comincia"), "texts.banquetStarts.it is not a field"],
      ["a hidden heading typed as a localeText", "texts", (doc) => (doc.homeHeading._type = "localeText"), 'texts.homeHeading._type is "localeText", expected "localeString"'],
      ["a list of genres that is not a list", "texts", (doc) => (doc.genres.fr = "Jeu de cartes"), "texts.genres.fr should be an array"],
      ["a board word that is not a localeString", "texts", (doc) => (doc.skip = "Passer"), "texts.skip should be an object"],
      ["a board word typed as a localeText", "texts", (doc) => (doc.youPlay._type = "localeText"), 'texts.youPlay._type is "localeText", expected "localeString"'],
      ["a list of status wordings that is not a list", "texts", (doc) => (doc.statusDisgrace.en = "in disgrace"), "texts.statusDisgrace.en should be an array"],
      ["a status wording in a language the Studio does not have", "texts", (doc) => (doc.statusLight.it = ["in luce"]), "texts.statusLight.it is not a field"],
    ])("%s", (_name, id, change, expected) => {
      const doc = docOf(id)
      change(doc)
      expect(documentProblems(doc, types).join("\n")).toContain(expected)
    })
  })
})

describe("the option lists of the Studio", () => {
  it.each<[string, () => unknown[], readonly unknown[]]>([
    ["family.key", () => listOf(fieldOf("family", "key")), FAMILY_KEYS],
    ["role.key", () => listOf(fieldOf("role", "key")), ROLE_KEYS],
  ])("of %s offers the values the seed is built from, in the same order", (_name, offered, expected) => {
    expect(offered()).toEqual([...expected])
  })

  it("are the lists of constants.ts, which the Studio forms are built from", () => {
    expect(FAMILIES.map((family) => family.value)).toEqual([...FAMILY_KEYS])
    expect(ROLES.map((role) => role.value)).toEqual([...ROLE_KEYS])
  })
})
