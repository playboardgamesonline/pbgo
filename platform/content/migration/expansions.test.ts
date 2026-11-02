import { describe, expect, it } from "vitest"
import { describePlan, idsToRead, migrate, mutationsOf, planMigration } from "./expansions.ts"
import type { Doc } from "./expansions.ts"
import { COURTISANS_DRAFT, MemoryDataset, PUBLISHED_AROUND, draftWith } from "./test-fixtures.ts"

// The migration of the expansions made as games (PLT-102), on the one document it was written for and on the cases it refuses.

const weak = (id: string, type: string) => ({ _type: "reference", _ref: id, _weak: true, _strengthenOnPublish: { type } })

/** The documents `idsToRead` asks for, among the ones the dataset holds. */
const around = (games: readonly Doc[], published: readonly Doc[] = PUBLISHED_AROUND): Map<string, Doc> => {
  const wanted = new Set(idsToRead(games))
  return new Map(published.filter((doc) => wanted.has(doc._id)).map((doc) => [doc._id, doc]))
}

const plan = (games: readonly Doc[], published: readonly Doc[] = PUBLISHED_AROUND) => planMigration(games, around(games, published))

/** The expansion draft the Courtisans game draft becomes. */
const EXPANSION = {
  _id: "drafts.expansion-courtisans-diplomats-confidants",
  _type: "expansion",
  name: "Courtisans: Diplomates & Confidents",
  slug: { _type: "slug", current: "courtisans-diplomats-confidants" },
  baseGame: weak("game-courtisans", "game"),
  playersMin: 2,
  playersMax: 6,
  minAge: 8,
  creators: [
    { _key: "creator-romaric-galonnier", _type: "gameCreator", creator: weak("creator-romaric-galonnier", "creator"), roles: ["designer"] },
    { _key: "creator-anthony-perone", _type: "gameCreator", creator: weak("creator-anthony-perone", "creator"), roles: ["designer"] },
    { _key: "creator-noemie-chevalier", _type: "gameCreator", creator: weak("creator-noemie-chevalier", "creator"), roles: ["artist"] },
  ],
  publishers: [{ _key: "publisher-catch-up-games", ...weak("publisher-catch-up-games", "publisher") }],
  description: COURTISANS_DRAFT.description,
}

describe("the Courtisans draft", () => {
  const result = plan([COURTISANS_DRAFT])

  it("becomes the expansion draft the ticket names: the id is made of its slug", () => {
    expect(result.problems).toEqual([])
    expect(result.migrations).toHaveLength(1)
    expect(result.migrations[0]?.to).toBe("drafts.expansion-courtisans-diplomats-confidants")
  })

  it("keeps its name, slug, figures, credits, publisher and description, and points at its base game", () => {
    expect(result.migrations[0]?.doc).toEqual(EXPANSION)
  })

  it("is created and the game draft deleted, in one transaction: create first, so that an id that exists stops it before anything goes", () => {
    expect(mutationsOf(result)).toEqual([{ create: EXPANSION }, { delete: { id: "drafts.game-courtisans-diplomats-confidants" } }])
  })

  it("loses nothing but its kind: the revision and the dates are the dataset's, the kind is the type", () => {
    const [migration] = result.migrations
    expect(migration?.drops).toEqual(['kind ("expansion")'])
    const kept = new Set(Object.keys(migration?.doc ?? {}))
    const left = Object.keys(COURTISANS_DRAFT).filter((field) => !field.startsWith("_") && !kept.has(field))
    expect(left).toEqual(["kind"])
  })

  it("says what moves, listing a list by its size", () => {
    expect(result.migrations[0]?.moves).toEqual(["name", "slug", "baseGame", "playersMin", "playersMax", "minAge", "creators (3)", "publishers (1)", "description"])
  })

  it("points at documents that are there and published", () => {
    expect(result.migrations[0]?.links).toEqual([
      { path: "baseGame", id: "game-courtisans", type: "game", state: "published" },
      { path: "creators[0]", id: "creator-romaric-galonnier", type: "creator", state: "published" },
      { path: "creators[1]", id: "creator-anthony-perone", type: "creator", state: "published" },
      { path: "creators[2]", id: "creator-noemie-chevalier", type: "creator", state: "published" },
      { path: "publishers[0]", id: "publisher-catch-up-games", type: "publisher", state: "published" },
    ])
  })

  it("is left as it is by the plan: the game draft is read, never changed", () => {
    const before = structuredClone(COURTISANS_DRAFT)
    plan([COURTISANS_DRAFT])
    expect(COURTISANS_DRAFT).toEqual(before)
  })
})

describe("the references of the new document", () => {
  it("are written by the rules of the seed whatever form they were in: weak, marked to be made strong, as strong references", () => {
    const strong = draftWith({
      baseGame: { _type: "reference", _ref: "game-courtisans" },
      creators: [{ _key: "k1", _type: "gameCreator", creator: { _type: "reference", _ref: "creator-anthony-perone" }, roles: ["designer"] }],
      publishers: [{ _key: "k2", _type: "reference", _ref: "publisher-catch-up-games" }],
    })
    const doc = plan([strong]).migrations[0]?.doc
    expect(doc?.baseGame).toEqual(weak("game-courtisans", "game"))
    expect(doc?.creators).toEqual([{ _key: "k1", _type: "gameCreator", creator: weak("creator-anthony-perone", "creator"), roles: ["designer"] }])
    expect(doc?.publishers).toEqual([{ _key: "k2", ...weak("publisher-catch-up-games", "publisher") }])
  })

  it("keep the keys of the lines, and make one of the id when a line has none", () => {
    const keyless = draftWith({ publishers: [{ _type: "reference", _ref: "publisher-catch-up-games" }] })
    expect(plan([keyless]).migrations[0]?.doc.publishers).toEqual([{ _key: "publisher-catch-up-games", ...weak("publisher-catch-up-games", "publisher") }])
  })

  it("say that a target is only a draft, which has to be published before the expansion", () => {
    const draftOnly: Doc[] = PUBLISHED_AROUND.map((doc) => (doc._id === "game-courtisans" ? { ...doc, _id: "drafts.game-courtisans" } : doc))
    const links = plan([COURTISANS_DRAFT], draftOnly).migrations[0]?.links
    expect(links?.[0]).toEqual({ path: "baseGame", id: "game-courtisans", type: "game", state: "draft only" })
  })
})

describe("what is copied", () => {
  it("is every field the two types share, in the order of the form, and nothing the draft leaves empty", () => {
    const full = draftWith({ bggId: 7, duration: 30, releaseDate: "2025-05-01", rulesFr: "https://example.com/fr.pdf", rulesEn: "https://example.com/en.pdf", rulesEs: "https://example.com/es.pdf", rulesDe: "https://example.com/de.pdf", description: "", categories: [], tagline: "" })
    const migration = plan([full]).migrations[0]
    expect(Object.keys(migration?.doc ?? {})).toEqual([
      "_id", "_type", "name", "slug", "baseGame", "bggId", "playersMin", "playersMax", "duration", "minAge", "releaseDate", "creators", "publishers", "rulesFr", "rulesEn", "rulesEs", "rulesDe",
    ])
    // in the order the draft holds them, which is not the form's: compared as a set
    expect([...(migration?.drops ?? [])].sort()).toEqual(['kind ("expansion")', "description (empty)", "categories (empty)", "tagline (empty)"].sort())
  })

  it("brings the cover and the front of the box along", () => {
    const image = (id: string) => ({ _type: "image", asset: { _type: "reference", _ref: id } })
    const doc = plan([draftWith({ cover: image("image-aaa-10x10-webp"), boxFront: image("image-bbb-10x10-webp") })]).migrations[0]?.doc
    expect(doc?.cover).toEqual(image("image-aaa-10x10-webp"))
    expect(doc?.boxFront).toEqual(image("image-bbb-10x10-webp"))
    expect(Object.keys(doc ?? {}).slice(-2)).toEqual(["cover", "boxFront"])
  })
})

describe("what stops the migration, which then writes nothing", () => {
  const stops = (games: Doc[], published: readonly Doc[] = PUBLISHED_AROUND) => plan(games, published).problems

  it("is a game of that kind that is published: only drafts are moved", () => {
    expect(stops([{ ...COURTISANS_DRAFT, _id: "game-courtisans-diplomats-confidants" }])).toEqual([
      "game-courtisans-diplomats-confidants: it is not a draft (published, or in a release): the migration moves drafts only. Move it by hand in the Studio",
    ])
    expect(stops([{ ...COURTISANS_DRAFT, _id: "versions.rAbC.game-courtisans-diplomats-confidants" }])[0]).toContain("it is not a draft")
  })

  it("is a draft next to the published one: neither is moved", () => {
    const problems = stops([COURTISANS_DRAFT, { ...COURTISANS_DRAFT, _id: "game-courtisans-diplomats-confidants" }])
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain("game-courtisans-diplomats-confidants: it is not a draft")
  })

  it.each(["order", "complexity", "categories", "tagline", "related", "logo", "icon", "background"])("is a %s on the draft: an expansion has no field for it, and moving would lose it", (field) => {
    const value = field === "categories" || field === "related" ? [weak("category-x", "category")] : field === "logo" || field === "icon" || field === "background" ? { _type: "image" } : field === "tagline" ? "A line" : 10
    const problems = stops([draftWith({ [field]: value })])
    expect(problems).toHaveLength(1)
    expect(problems[0]).toMatch(new RegExp(`^drafts\\.game-courtisans-diplomats-confidants: it has a "${field}" \\(.*\\), which an expansion has no field for`))
  })

  it("is a field that is neither a game's nor an expansion's", () => {
    expect(stops([draftWith({ mystery: 1 })])).toEqual(['drafts.game-courtisans-diplomats-confidants: it has a "mystery", which is a field of neither a game nor an expansion'])
  })

  it("is a draft with no base game: an expansion cannot be published without one", () => {
    expect(stops([draftWith({}, ["baseGame"])])).toEqual(["drafts.game-courtisans-diplomats-confidants: it has no base game: pick it in the Studio first, an expansion cannot be published without one"])
  })

  it("is a reference to a document the dataset does not have, or of another type", () => {
    const missing = PUBLISHED_AROUND.filter((doc) => doc._id !== "creator-anthony-perone")
    expect(stops([COURTISANS_DRAFT], missing)).toEqual(["drafts.game-courtisans-diplomats-confidants: creators[1] points at creator-anthony-perone, which is not in the dataset"])
    const wrong = PUBLISHED_AROUND.map((doc) => (doc._id === "game-courtisans" ? { ...doc, _type: "creator" } : doc))
    expect(stops([COURTISANS_DRAFT], wrong)).toEqual(['drafts.game-courtisans-diplomats-confidants: baseGame points at game-courtisans, a "creator", and an expansion takes a "game" there'])
  })

  it("is an expansion that exists already, published or draft: nothing is overwritten", () => {
    const published = [...PUBLISHED_AROUND, { _id: "expansion-courtisans-diplomats-confidants", _type: "expansion" }]
    expect(stops([COURTISANS_DRAFT], published)).toEqual(["drafts.game-courtisans-diplomats-confidants: expansion-courtisans-diplomats-confidants exists already: nothing is overwritten"])
    const draft = [...PUBLISHED_AROUND, { _id: "drafts.expansion-courtisans-diplomats-confidants", _type: "expansion" }]
    expect(stops([COURTISANS_DRAFT], draft)).toEqual(["drafts.game-courtisans-diplomats-confidants: drafts.expansion-courtisans-diplomats-confidants exists already: nothing is overwritten"])
  })

  it("is a slug that cannot make an id, or none", () => {
    for (const slug of [{ _type: "slug", current: "not an id!" }, { _type: "slug" }, "text"]) {
      expect(stops([draftWith({ slug })])[0], JSON.stringify(slug)).toContain("it has no slug that can make the id of the expansion")
    }
    expect(stops([draftWith({}, ["slug"])])[0]).toContain("it has no slug that can make the id of the expansion")
  })

  it("is two drafts of one slug: they would be one expansion", () => {
    const twin = { ...draftWith({ name: "Twin" }), _id: "drafts.game-twin" }
    expect(stops([COURTISANS_DRAFT, twin])).toEqual(["drafts.game-courtisans-diplomats-confidants and drafts.game-twin would both become drafts.expansion-courtisans-diplomats-confidants".replace(/^/, "drafts.game-twin: ")])
  })

  it("lists every problem of every draft at once, so that they are settled in one go", () => {
    const problems = stops([draftWith({ order: 3, mystery: 1 }, ["baseGame"])])
    expect(problems).toHaveLength(3)
  })

  it("is not a problem when there is nothing to move", () => {
    const empty = planMigration([], new Map())
    expect(empty).toEqual({ found: { total: 0, drafts: 0 }, migrations: [], problems: [] })
    expect(mutationsOf(empty)).toEqual([])
  })
})

describe("the ids to read", () => {
  it("are where the expansion goes, published and draft, and what the draft points at, published and draft, each once", () => {
    expect(idsToRead([COURTISANS_DRAFT])).toEqual([
      "expansion-courtisans-diplomats-confidants",
      "drafts.expansion-courtisans-diplomats-confidants",
      "game-courtisans",
      "drafts.game-courtisans",
      "creator-romaric-galonnier",
      "drafts.creator-romaric-galonnier",
      "creator-anthony-perone",
      "drafts.creator-anthony-perone",
      "creator-noemie-chevalier",
      "drafts.creator-noemie-chevalier",
      "publisher-catch-up-games",
      "drafts.publisher-catch-up-games",
    ])
  })

  it("are none for no draft, and none for a slug that cannot make an id", () => {
    expect(idsToRead([])).toEqual([])
    expect(idsToRead([draftWith({ slug: { _type: "slug", current: "not an id!" } }, ["baseGame", "creators", "publishers"])])).toEqual([])
  })
})

describe("the plan in words", () => {
  const words = { projectId: "mhgqs6fe", dataset: "production" }

  it("says for a dry run exactly what is created, deleted, moved and left behind, with the new document in full", () => {
    const text = describePlan(plan([COURTISANS_DRAFT]), { ...words, mode: "dry-run" })
    expect(text).toContain("on mhgqs6fe/production: DRY RUN, nothing is written")
    expect(text).toContain('1 game of kind "expansion" (1 draft, 0 other).')
    expect(text).toContain("create  drafts.expansion-courtisans-diplomats-confidants  (expansion)")
    expect(text).toContain("delete  drafts.game-courtisans-diplomats-confidants")
    expect(text).toContain("moves   name, slug, baseGame, playersMin, playersMax, minAge, creators (3), publishers (1), description")
    expect(text).toContain('drops   kind ("expansion")')
    expect(text).toContain("points at  game-courtisans (game, published), creator-romaric-galonnier (creator, published)")
    expect(text).toContain(JSON.stringify(EXPANSION, null, 2).replace(/^/gm, "  "))
    expect(text).toContain("Nothing was written. Run again with --apply")
  })

  it("says for a write that it is written, and what to do next", () => {
    const text = describePlan(plan([COURTISANS_DRAFT]), { ...words, mode: "applied" })
    expect(text).toContain("on mhgqs6fe/production: WRITTEN")
    expect(text).toContain("Written in one transaction, then read back. Publish in the Studio")
    expect(text).not.toContain("DRY RUN")
  })

  it("lists the problems instead of promising a write", () => {
    const text = describePlan(plan([draftWith({ order: 3 })]), { ...words, mode: "stopped" })
    expect(text).toContain("NOTHING WRITTEN")
    expect(text).toContain("Nothing can be moved until this is settled:")
    expect(text).toContain('  - drafts.game-courtisans-diplomats-confidants: it has a "order" (3)')
    expect(text).not.toContain("Run again with --apply")
  })

  it("says there is nothing to move when there is no such game", () => {
    const text = describePlan(planMigration([], new Map()), { ...words, mode: "dry-run" })
    expect(text).toContain('No game of kind "expansion": nothing to move.')
    expect(text).not.toContain("Run again with --apply")
  })

  it("counts other states apart", () => {
    const text = describePlan(plan([COURTISANS_DRAFT, { ...COURTISANS_DRAFT, _id: "game-published-one" }]), { ...words, mode: "dry-run" })
    expect(text).toContain('2 games of kind "expansion" (1 draft, 1 other).')
  })
})

describe("the run", () => {
  const dataset = () => new MemoryDataset([...PUBLISHED_AROUND, COURTISANS_DRAFT])

  it("writes nothing for a dry run, and says what it would write", async () => {
    const store = dataset()
    const outcome = await migrate(store, { apply: false })
    expect(outcome.mode).toBe("dry-run")
    expect(outcome.plan.migrations).toHaveLength(1)
    expect(store.commits).toEqual([])
    expect(store.docs.has("drafts.game-courtisans-diplomats-confidants")).toBe(true)
  })

  it("moves the draft in one transaction and reads the dataset back", async () => {
    const store = dataset()
    const outcome = await migrate(store, { apply: true })
    expect(outcome).toMatchObject({ mode: "applied", afterProblems: [] })
    expect(store.commits).toEqual([[{ create: EXPANSION }, { delete: { id: "drafts.game-courtisans-diplomats-confidants" } }]])
    expect(store.docs.get("drafts.expansion-courtisans-diplomats-confidants")).toEqual(EXPANSION)
    expect(store.docs.has("drafts.game-courtisans-diplomats-confidants")).toBe(false)
  })

  it("writes a draft only, publishes nothing and leaves every other document as it is", async () => {
    const store = dataset()
    await migrate(store, { apply: true })
    expect([...store.docs.keys()].filter((id) => !PUBLISHED_AROUND.some((doc) => doc._id === id))).toEqual(["drafts.expansion-courtisans-diplomats-confidants"])
    for (const doc of PUBLISHED_AROUND) expect(store.docs.get(doc._id)).toEqual(doc)
  })

  it("does nothing the second time: no game of that kind is left", async () => {
    const store = dataset()
    await migrate(store, { apply: true })
    const again = await migrate(store, { apply: true })
    expect(again.mode).toBe("stopped")
    expect(again.plan.found.total).toBe(0)
    expect(store.commits).toHaveLength(1)
  })

  it("writes nothing when a problem is left, even when it is asked to", async () => {
    const store = new MemoryDataset([...PUBLISHED_AROUND, draftWith({ order: 3 })])
    const outcome = await migrate(store, { apply: true })
    expect(outcome.mode).toBe("stopped")
    expect(outcome.plan.problems).toHaveLength(1)
    expect(store.commits).toEqual([])
  })

  it("writes nothing when one of two drafts has a problem: all or nothing", async () => {
    const second = { ...draftWith({ name: "Second", slug: { _type: "slug", current: "second" } }, ["baseGame"]), _id: "drafts.game-second" }
    const store = new MemoryDataset([...PUBLISHED_AROUND, COURTISANS_DRAFT, second])
    const outcome = await migrate(store, { apply: true })
    expect(outcome.mode).toBe("stopped")
    expect(store.commits).toEqual([])
    expect(store.docs.has("drafts.game-courtisans-diplomats-confidants")).toBe(true)
  })

  it("moves several drafts in one transaction", async () => {
    const second = { ...draftWith({ name: "Second", slug: { _type: "slug", current: "courtisans-second" } }), _id: "drafts.game-courtisans-second" }
    const store = new MemoryDataset([...PUBLISHED_AROUND, COURTISANS_DRAFT, second])
    await migrate(store, { apply: true })
    expect(store.commits).toHaveLength(1)
    expect(store.commits[0]).toHaveLength(4)
    expect([...store.docs.keys()].filter((id) => id.includes("expansion"))).toEqual(["drafts.expansion-courtisans-diplomats-confidants", "drafts.expansion-courtisans-second"])
  })

  it("is all or nothing when the dataset refuses a mutation: the game draft stays when the expansion cannot be created", async () => {
    const store = dataset()
    store.docs.set("drafts.expansion-courtisans-diplomats-confidants", { _id: "drafts.expansion-courtisans-diplomats-confidants", _type: "expansion" })
    // the plan would have refused: the transaction is sent as it would be after an edit made between the read and the write
    await expect(store.commit(mutationsOf(plan([COURTISANS_DRAFT])))).rejects.toThrow("already exists")
    expect(store.docs.has("drafts.game-courtisans-diplomats-confidants")).toBe(true)
  })

  it("passes a dataset that refuses a strong reference to a draft: the references it writes are weak", async () => {
    // the only published document is the base game; a strong reference to a creator that is not published would be refused
    const store = new MemoryDataset([PUBLISHED_AROUND[0] as Doc, ...PUBLISHED_AROUND.slice(1), COURTISANS_DRAFT])
    for (const id of ["creator-romaric-galonnier", "creator-anthony-perone", "creator-noemie-chevalier", "publisher-catch-up-games"]) {
      const doc = store.docs.get(id)
      if (doc) store.docs.set(`drafts.${id}`, { ...doc, _id: `drafts.${id}` })
      store.docs.delete(id)
    }
    const outcome = await migrate(store, { apply: true })
    expect(outcome.mode).toBe("applied")
    expect(outcome.plan.migrations[0]?.links.filter((link) => link.state === "draft only")).toHaveLength(4)
  })

  it("reports a write that the dataset did not keep", async () => {
    const store = dataset()
    const commit = store.commit.bind(store)
    store.commit = async (mutations) => {
      await commit(mutations)
      store.docs.delete("drafts.expansion-courtisans-diplomats-confidants")
      store.docs.set("drafts.game-courtisans-diplomats-confidants", COURTISANS_DRAFT)
    }
    const outcome = await migrate(store, { apply: true })
    expect(outcome.afterProblems).toEqual([
      "drafts.expansion-courtisans-diplomats-confidants is not in the dataset after the write",
      "drafts.game-courtisans-diplomats-confidants is still in the dataset after the write",
    ])
  })
})
