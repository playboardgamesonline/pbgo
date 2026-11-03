import { join } from "node:path"
import { pluginTypes } from "@pbgo/content-kit/form-rules"
import { documentProblems, imageFields, referenceProblems } from "@pbgo/content-kit/testing"
import type { TypeDef, Types } from "@pbgo/content-kit/testing"
import { beforeAll, describe, expect, it } from "vitest"
import { DATASET, PLATFORM_DIR, PROJECT_ID } from "../config.ts"
import { planMigration } from "../migration/expansions.ts"
import { COURTISANS_DRAFT, PUBLISHED_AROUND } from "../migration/test-fixtures.ts"
import { OLD_BARE, OLD_CATEGORY, OLD_EXPANSION, OLD_EXPANSION_DRAFT, OLD_HANABI } from "../migration/translations-fixtures.ts"
import { applied, planTranslations, type Doc as CatalogDoc } from "../migration/translations.ts"
import { buildSeedContent } from "./index.ts"
import { seedDocs, source } from "./test-fixtures.ts"

// The seed documents against the Studio schemas as the Studio itself builds them (apps/studio/sanity.config.ts): a field renamed, a
// list changed or a rule tightened in the Studio fails here, not in front of the editor.

type StudioConfig = { projectId: string; dataset: string; schema: { types: TypeDef[] }; plugins?: unknown[] }

let studio: StudioConfig
let types: Types

/** The Studio configuration, imported from a computed path so that typechecking the content does not follow it into the Studio (DOM types, other syntax rules). */
async function loadStudio(): Promise<StudioConfig> {
  // the config reads them with `??`: absent, not empty, gives its defaults, so that a developer's own .env changes nothing here
  const saved = [process.env.SANITY_STUDIO_PROJECT_ID, process.env.SANITY_STUDIO_DATASET]
  delete process.env.SANITY_STUDIO_PROJECT_ID
  delete process.env.SANITY_STUDIO_DATASET
  try {
    const loaded = (await import(/* @vite-ignore */ join(PLATFORM_DIR, "apps/studio/sanity.config.ts"))) as { default: StudioConfig }
    return loaded.default
  } finally {
    if (saved[0] !== undefined) process.env.SANITY_STUDIO_PROJECT_ID = saved[0]
    if (saved[1] !== undefined) process.env.SANITY_STUDIO_DATASET = saved[1]
  }
}

beforeAll(async () => {
  studio = await loadStudio()
  // the types of the Studio and the ones its plugins register: a translated field is an array of the plugin's rows
  types = new Map([...studio.schema.types.map((type): [string, TypeDef] => [type.name, type]), ...pluginTypes(studio)])
}, 60_000)

describe("the seed and the Studio", () => {
  it("write to the same project and the same dataset", () => {
    expect(studio.projectId).toBe(PROJECT_ID)
    expect(studio.dataset).toBe(DATASET)
  })

  it("agree on the types: every document of the seed is of a document type the Studio has", () => {
    for (const type of new Set(seedDocs().map((doc) => doc._type))) expect(types.get(type)?.type, type).toBe("document")
  })
})

describe("the seed documents", () => {
  it("follow the Studio schema: every field is one, of the right kind, in its list and under its rules", () => {
    const problems = seedDocs().flatMap((doc) => documentProblems(doc, types))
    expect(problems).toEqual([])
  })

  it("point at documents that are in the seed, of a type their field takes", () => {
    expect(referenceProblems(seedDocs(), types)).toEqual([])
  })

  it("are caught when one does not: a reference to a document the seed lacks", () => {
    const docs = seedDocs()
    const game = docs.find((doc) => doc._id === "game-hanabi")
    if (!game) throw new Error("no Hanabi")
    game.categories = [...game.categories, { _key: "category-ghost", _type: "reference", _ref: "category-ghost" }]
    expect(referenceProblems(docs, types)).toEqual(['game-hanabi.categories[2] points at "category-ghost", which is not in the seed'])
  })

  it("are caught when one breaks a rule of the Studio: a creator on two lines, a role the list lacks, a slug the site cannot serve", () => {
    const docs = seedDocs()
    const game = docs.find((doc) => doc._id === "game-hanabi")
    if (!game) throw new Error("no Hanabi")
    game.creators = [...game.creators, { ...game.creators[0], _key: "again" }]
    game.creators[1].roles = ["designer", "composer"]
    game.slug = { _type: "slug", current: "Hanabi!" }
    const problems = documentProblems(game, types)
    expect(problems.some((problem) => problem.includes("A creator is on one line"))).toBe(true)
    expect(problems.some((problem) => problem.includes('"composer", not one of'))).toBe(true)
    expect(problems.some((problem) => problem.includes("is not a slug"))).toBe(true)
  })
})

describe("the expansions of the seed", () => {
  const expansionOf = (docs: ReturnType<typeof seedDocs>) => {
    const found = docs.find((doc) => doc._id === "expansion-hanabi-extra")
    if (!found) throw new Error("no Hanabi expansion")
    return found
  }

  it("are caught when one has no base game: an expansion cannot be published without one", () => {
    const docs = seedDocs()
    const expansion = expansionOf(docs)
    delete expansion.baseGame
    expect(documentProblems(expansion, types)).toEqual(["expansion-hanabi-extra.baseGame is required"])
  })

  it("are caught when one points at a game the seed lacks, or at a document that is not a game", () => {
    const docs = seedDocs()
    const expansion = expansionOf(docs)
    expansion.baseGame = { ...expansion.baseGame, _ref: "game-ghost" }
    expect(referenceProblems(docs, types)).toEqual(['expansion-hanabi-extra.baseGame points at "game-ghost", which is not in the seed'])
    expansion.baseGame = { ...expansion.baseGame, _ref: "creator-ada-marsh" }
    expect(referenceProblems(docs, types)).toEqual(['expansion-hanabi-extra.baseGame points at "creator-ada-marsh", a "creator", and the field takes "game"'])
  })

  it("are caught when one has a field only a game has: a kind, an order, related games", () => {
    const expansion = expansionOf(seedDocs())
    Object.assign(expansion, { kind: "game", order: 10, related: [] })
    expect(documentProblems(expansion, types)).toEqual([
      'expansion-hanabi-extra.kind is not a field of "expansion"',
      'expansion-hanabi-extra.order is not a field of "expansion"',
      'expansion-hanabi-extra.related is not a field of "expansion"',
    ])
  })

  it("are caught when one breaks a rule it shares with a game: a creator on two lines, a slug the site cannot serve", () => {
    const expansion = expansionOf(seedDocs())
    expansion.creators = [...expansion.creators, { ...expansion.creators[0], _key: "again" }]
    expansion.slug = { _type: "slug", current: "Hanabi!" }
    const problems = documentProblems(expansion, types)
    expect(problems.some((problem) => problem.includes("A creator is on one line"))).toBe(true)
    expect(problems.some((problem) => problem.includes("is not a slug"))).toBe(true)
  })
})

describe("the migration of the expansions made as games (PLT-102), then the conversion to translated fields (PLT-104)", () => {
  const moved = () => {
    const { migrations, problems } = planMigration([COURTISANS_DRAFT], new Map(PUBLISHED_AROUND.map((doc) => [doc._id, doc])))
    expect(problems).toEqual([])
    const doc = migrations[0]?.doc
    if (!doc) throw new Error("nothing was migrated")
    return doc
  }
  /** What the first migration writes still has the old shape of the fields (a text, one link per language): the second converts it. */
  const migrated = () => {
    const doc = moved() as CatalogDoc
    const plan = planTranslations([doc])
    expect(plan.problems).toEqual([])
    const conversion = plan.conversions[0]
    return conversion ? (applied(doc, conversion) as Record<string, unknown> & { _id: string; _type: string }) : (doc as Record<string, unknown> & { _id: string; _type: string })
  }

  it("makes a document that follows the Studio schema of an expansion once converted: every field is one, of the right kind, under its rules", () => {
    expect(documentProblems(migrated(), types)).toEqual([])
  })

  it("makes a document that points at documents that are there, of a type their field takes", () => {
    expect(referenceProblems([migrated(), ...PUBLISHED_AROUND], types)).toEqual([])
  })

  it("is needed: the draft it starts from is a game with a kind the Studio no longer lists, and its description is a plain text", () => {
    expect(documentProblems(COURTISANS_DRAFT, types)).toEqual([
      'drafts.game-courtisans-diplomats-confidants.kind is "expansion", not one of "game", "reimplementation"',
      expect.stringContaining("drafts.game-courtisans-diplomats-confidants.description should be an array"),
    ])
  })
})

describe("the conversion of the catalog to translated fields (PLT-104)", () => {
  // the documents as they are today, converted: what the Studio then holds must be what its own schema says
  const plan = planTranslations([OLD_HANABI, OLD_BARE, OLD_CATEGORY, OLD_EXPANSION, OLD_EXPANSION_DRAFT])
  const converted = plan.conversions.map((conversion) => {
    const doc = [OLD_HANABI, OLD_BARE, OLD_CATEGORY, OLD_EXPANSION, OLD_EXPANSION_DRAFT].find((candidate) => candidate._id === conversion.id)
    if (!doc) throw new Error(`No document ${conversion.id}`)
    // a draft's id starts with `drafts.`, which a document of the schema's checker does not mind
    return applied(doc, conversion)
  })

  it("is run on documents of the types the Studio has", () => {
    expect(plan.problems).toEqual([])
    expect(converted).toHaveLength(5)
  })

  it("makes documents that follow the Studio schema: every field is one, of the right kind, in its rows of languages", () => {
    // what the old fields held that the Studio lists no more is gone, and the references of a fixture are not the schema's business here
    const problems = converted.flatMap((doc) => documentProblems(doc as never, types)).filter((problem) => !problem.includes("baseGame") && !problem.includes("categories"))
    expect(problems).toEqual([])
  })

  it("leaves a document that does not follow it unconverted: the old shape is refused by the schema", () => {
    expect(documentProblems(OLD_HANABI as never, types).some((problem) => problem.includes("description should be an array"))).toBe(true)
    expect(documentProblems(OLD_HANABI as never, types).some((problem) => problem.includes("rulesFr is not a field"))).toBe(true)
  })
})

describe("the art slots", () => {
  /** The image fields of a type, with the picture of each row of a translated field named by the field: `game.logo[].value` is the field `game.logo`. */
  const fieldsOf = (type: string) => imageFields(type, types).map((path) => path.replace("[].value", ""))

  it("each land on an image field of the type of their document, a translated one in the row of English", () => {
    const { docs, slots } = buildSeedContent(source())
    const image = { _type: "image" as const, asset: { _type: "reference" as const, _ref: "image-abc-10x10-webp" } }
    for (const slot of slots) {
      const doc = docs.find((candidate) => candidate._id === slot.docId)
      if (!doc) throw new Error(`No document for ${slot.name}`)
      const before = structuredClone(doc)
      slot.place(doc, image)
      // the field that changed: a new one, or one the seed already gave its empty row of English
      const placed = Object.keys(doc).filter((key) => JSON.stringify(doc[key]) !== JSON.stringify(before[key]))
      expect(placed, slot.name).toHaveLength(1)
      expect(fieldsOf(doc._type), slot.name).toContain(`${doc._type}.${placed[0]}`)
    }
  })

  it("write nothing against the schema: a document with its pictures placed still follows it", () => {
    const { docs, slots } = buildSeedContent(source())
    const image = { _type: "image" as const, asset: { _type: "reference" as const, _ref: "image-abc-10x10-webp" } }
    for (const slot of slots) {
      const doc = docs.find((candidate) => candidate._id === slot.docId)
      if (doc) slot.place(doc, image)
    }
    expect(docs.flatMap((doc) => documentProblems(doc, types))).toEqual([])
  })

  it("leave to the Studio the images Notion has no picture for", () => {
    const { slots } = buildSeedContent(source())
    const covered = new Set(slots.map((slot) => slot.name.split("-").at(-1)))
    expect([...covered].sort()).toEqual(["background", "icon", "logo"])
    // The gallery's pictures and the posters of its clips are the Studio's too (a picture of a gallery is an item of a list, a poster a field of a clip)
    expect(fieldsOf("game").sort()).toEqual(["game.background", "game.boxFront", "game.cover", "game.gallery[]", "game.gallery[].poster", "game.icon", "game.logo"])
  })

  it("have none for an expansion, whose cover and box front Notion has no picture of either", () => {
    expect(fieldsOf("expansion").sort()).toEqual(["expansion.boxFront", "expansion.cover"])
    const { docs, slots } = buildSeedContent(source())
    const expansions = new Set(docs.filter((doc) => doc._type === "expansion").map((doc) => doc._id))
    expect(slots.filter((slot) => expansions.has(slot.docId))).toEqual([])
  })
})
