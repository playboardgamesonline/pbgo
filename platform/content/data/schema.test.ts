import { join } from "node:path"
import { documentProblems, imageFields, referenceProblems } from "@pbgo/content-kit/testing"
import type { TypeDef, Types } from "@pbgo/content-kit/testing"
import { beforeAll, describe, expect, it } from "vitest"
import { DATASET, PLATFORM_DIR, PROJECT_ID } from "../config.ts"
import { buildSeedContent } from "./index.ts"
import { seedDocs, source } from "./test-fixtures.ts"

// The seed documents against the Studio schemas as the Studio itself builds them (apps/studio/sanity.config.ts): a field renamed, a
// list changed or a rule tightened in the Studio fails here, not in front of the editor.

type StudioConfig = { projectId: string; dataset: string; schema: { types: TypeDef[] } }

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
  types = new Map(studio.schema.types.map((type) => [type.name, type]))
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

describe("the art slots", () => {
  it("each land on an image field of the type of their document", () => {
    const { docs, slots } = buildSeedContent(source())
    const image = { _type: "image" as const, asset: { _type: "reference" as const, _ref: "image-abc-10x10-webp" } }
    for (const slot of slots) {
      const doc = docs.find((candidate) => candidate._id === slot.docId)
      if (!doc) throw new Error(`No document for ${slot.name}`)
      const before = Object.keys(doc)
      slot.place(doc, image)
      const placed = Object.keys(doc).filter((key) => !before.includes(key))
      expect(placed, slot.name).toHaveLength(1)
      expect(imageFields(doc._type, types), slot.name).toContain(`${doc._type}.${placed[0]}`)
    }
  })

  it("leave to the Studio the images Notion has no picture for", () => {
    const { slots } = buildSeedContent(source())
    const covered = new Set(slots.map((slot) => slot.name.split("-").at(-1)))
    expect([...covered].sort()).toEqual(["background", "icon", "logo"])
    expect(imageFields("game", types).sort()).toEqual(["game.background", "game.boxFront", "game.cover", "game.icon", "game.logo"])
  })
})
