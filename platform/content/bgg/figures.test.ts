import { describe, expect, it } from "vitest"
import { ADULT_AGE, MIN_WEIGHTS, describeFigures, idsToRead, planFigures, problemsAfter, run, type Doc, type Mutation } from "./figures.ts"
import { SYNC_ID, SYNC_TYPE } from "./sync.ts"
import { game, memoryStore, thing, things } from "./test-fixtures.ts"
import type { BggThing } from "./xml.ts"

describe("what is proposed", () => {
  it("is every figure the game lacks and BGG has, the weight to two decimals", () => {
    const plan = planFigures([game("azul", { bggId: 230802 })], things(thing(230802)))
    expect(plan.games).toEqual([
      expect.objectContaining({ slug: "azul", status: "proposed", set: { complexity: 1.77, playersMin: 2, playersMax: 4, duration: 45, minAge: 8 }, bggId: 230802, notes: [] }),
    ])
  })

  it("never replaces a figure the Studio holds, and proposes only the others", () => {
    const plan = planFigures([game("azul", { bggId: 230802, playersMin: 3, playersMax: 5, duration: 60 })], things(thing(230802)))
    expect(plan.games[0]?.set).toEqual({ complexity: 1.77, minAge: 8 })
  })

  it("keeps a figure that is 0 or empty as a figure: only a missing one is filled", () => {
    const plan = planFigures([game("azul", { bggId: 1, minAge: 0, complexity: 0 })], things(thing(1)))
    expect(plan.games[0]?.set).toEqual({ playersMin: 2, playersMax: 4, duration: 45 })
  })

  it("fills the players together or not at all: an empty maximum means 'or more' on the hub", () => {
    expect(planFigures([game("a", { bggId: 1, playersMin: 3, complexity: 2, duration: 30, minAge: 10 })], things(thing(1))).games[0]).toMatchObject({ status: "nothing", set: {} })
    expect(planFigures([game("a", { bggId: 1, playersMax: 6, complexity: 2, duration: 30, minAge: 10 })], things(thing(1))).games[0]?.set).toEqual({ playersMin: 2 })
    expect(planFigures([game("a", { bggId: 1, playersMax: 1, complexity: 2, duration: 30, minAge: 10 })], things(thing(1))).games[0]?.set).toEqual({})
    expect(planFigures([game("a", { bggId: 1 })], things(thing(1, { minPlayers: 4, maxPlayers: 2 }))).games[0]?.set).not.toHaveProperty("playersMin")
    expect(planFigures([game("a", { bggId: 1 })], things(thing(1, { maxPlayers: null }))).games[0]?.set).not.toHaveProperty("playersMax")
  })

  it("does not propose a weight that few people gave, and says so", () => {
    const few = planFigures([game("azul", { bggId: 1 })], things(thing(1, { weight: 2.456, weights: MIN_WEIGHTS - 1 }))).games[0]
    expect(few?.set).not.toHaveProperty("complexity")
    expect(few?.notes).toEqual([expect.stringContaining(`only ${MIN_WEIGHTS - 1} people weighed it`)])
    expect(planFigures([game("azul", { bggId: 1 })], things(thing(1, { weight: 2.456, weights: MIN_WEIGHTS }))).games[0]?.set.complexity).toBe(2.46)
    expect(planFigures([game("azul", { bggId: 1 })], things(thing(1, { weight: null, weights: 0 }))).games[0]?.set).not.toHaveProperty("complexity")
  })

  it("does not propose an age that would make the game one for adults, and says so", () => {
    const adult = planFigures([game("azul", { bggId: 1 })], things(thing(1, { minAge: ADULT_AGE }))).games[0]
    expect(adult?.set).not.toHaveProperty("minAge")
    expect(adult?.notes).toEqual([expect.stringContaining(`${ADULT_AGE}+`)])
    expect(planFigures([game("azul", { bggId: 1 })], things(thing(1, { minAge: ADULT_AGE - 1 }))).games[0]?.set.minAge).toBe(ADULT_AGE - 1)
    expect(planFigures([game("azul", { bggId: 1 })], things(thing(1, { minAge: null }))).games[0]?.set).not.toHaveProperty("minAge")
  })
})

describe("which games", () => {
  it("says what it did with each: complete, without a BGG id, not found on BGG, nothing more to add", () => {
    const docs = [
      game("complete", { bggId: 1, complexity: 2, playersMin: 2, playersMax: 4, duration: 30, minAge: 8 }),
      game("no-id"),
      game("lost", { bggId: 99 }),
      game("empty", { bggId: 2 }),
    ]
    const plan = planFigures(docs, things(thing(1), thing(2, { name: "Empty", names: ["Empty"], weight: null, weights: 0, minPlayers: null, maxPlayers: null, playingTime: null, minAge: null })))
    expect(plan.games.map((one) => [one.slug, one.status])).toEqual([
      ["complete", "complete"],
      ["empty", "nothing"],
      ["lost", "not-found"],
      ["no-id", "no-id"],
    ])
    expect(plan.mutations).toEqual([])
  })

  it("proposes nothing from an id that is not a board game, or that is another game, and says which", () => {
    const plan = planFigures(
      [game("splendor-duel", { bggId: 227398, name: "Splendor Duel" }), game("forest-shuffle", { bggId: 350933, name: "Forest Shuffle" })],
      things(thing(227398, { type: "rpgitem", name: "The Lair", names: ["The Lair"], year: 2017 }), thing(350933, { name: "The Guild of Merchant Explorers", names: ["The Guild of Merchant Explorers"], year: 2022 })),
    )
    expect(plan.games.map((one) => [one.slug, one.status, one.set])).toEqual([
      ["forest-shuffle", "mismatch", {}],
      ["splendor-duel", "mismatch", {}],
    ])
    expect(plan.games[1]?.notes[0]).toContain("is not a board game (it is a rpgitem")
    expect(plan.games[0]?.notes[0]).toContain('is "The Guild of Merchant Explorers" (2022), not "Forest Shuffle"')
    expect(plan.mutations).toEqual([])
  })

  it("knows a game by any name BGG has for it, and by a longer one: 'Mind Bug' is 'Mindbug: First Contact', '6 nimmt!' is 'Take 5'", () => {
    const plan = planFigures(
      [game("mind-bug", { bggId: 1, name: "Mind Bug" }), game("6-nimmt", { bggId: 2, name: "6 nimmt!" })],
      things(thing(1, { name: "Mindbug: First Contact", names: ["Mindbug: First Contact"] }), thing(2, { name: "Take 5", names: ["Take 5", "6 nimmt!"] })),
    )
    expect(plan.games.map((one) => one.status)).toEqual(["proposed", "proposed"])
  })

  it("compares names without accents or case, and does not compare a game with no name", () => {
    const plan = planFigures([game("cafe", { bggId: 1, name: "CAFÉ" }), game("nameless", { bggId: 2, name: undefined })], things(thing(1, { name: "Cafe", names: ["Cafe"] }), thing(2, { name: "Anything", names: ["Anything"] })))
    expect(plan.games.map((one) => one.status)).toEqual(["proposed", "proposed"])
  })

  it("leaves alone the versions of a release and what is not a game", () => {
    const docs = [{ ...game("azul", { bggId: 1 }), _id: "versions.rel.game-azul" }, { ...game("other"), _type: "expansion", bggId: 1 }]
    expect(planFigures(docs, things(thing(1))).games).toEqual([])
  })

  it("takes the draft for the game when there is one, and holds the figures of the draft against BGG's", () => {
    const docs = [game("azul", { bggId: 1, duration: 99 }), game("azul", { bggId: 1, minAge: 10 }, { draft: true })]
    const plan = planFigures(docs, things(thing(1)))
    expect(plan.games).toHaveLength(1)
    // The published duration is not the draft's: the draft is what the owner sees, and it lacks one
    expect(plan.games[0]?.set).toEqual({ complexity: 1.77, playersMin: 2, playersMax: 4, duration: 45 })
  })

  it("takes the slug of the game from the document, else from its id", () => {
    const plan = planFigures([game("azul", { bggId: 1, slug: undefined }), game("other", { bggId: 2 })], things(thing(1), thing(2, { name: "Other", names: ["Other"] })))
    expect(plan.games.map((one) => one.slug)).toEqual(["azul", "other"])
  })
})

describe("what is written", () => {
  it("is a patch of the draft when there is one, guarded by its revision", () => {
    const plan = planFigures([game("azul", { bggId: 1 }), game("azul", { bggId: 1 }, { draft: true })], things(thing(1)))
    expect(plan.mutations).toEqual([{ patch: { id: "drafts.game-azul", ifRevisionID: "rev-azul-draft", set: { complexity: 1.77, playersMin: 2, playersMax: 4, duration: 45, minAge: 8 } } }])
  })

  it("is a draft made of the published document, then its patch, when there is no draft: the published one is not touched", () => {
    const published = game("azul", { bggId: 1, creators: [{ _key: "a", _type: "gameCreator", role: "designer" }] })
    const plan = planFigures([published], things(thing(1)))
    expect(plan.mutations).toHaveLength(2)
    const [create, patch] = plan.mutations as [Extract<Mutation, { createIfNotExists: Doc }>, Extract<Mutation, { patch: unknown }>]
    expect(create.createIfNotExists._id).toBe("drafts.game-azul")
    expect(create.createIfNotExists).toMatchObject({ _type: "game", name: "Azul", bggId: 1, creators: published.creators })
    for (const field of ["_rev", "_createdAt", "_updatedAt"]) expect(create.createIfNotExists).not.toHaveProperty(field)
    expect(patch.patch).toEqual({ id: "drafts.game-azul", set: { complexity: 1.77, playersMin: 2, playersMax: 4, duration: 45, minAge: 8 } })
    expect(published._id).toBe("game-azul")
  })

  it("is nothing for a game with nothing to add, and the games come in the order of their ids", () => {
    const plan = planFigures([game("b", { bggId: 2 }), game("a", { bggId: 1 })], things(thing(1, { name: "A", names: ["A"] }), thing(2, { name: "B", names: ["B"] })))
    expect(plan.mutations.map((mutation) => ("patch" in mutation ? mutation.patch.id : mutation.createIfNotExists._id))).toEqual(["drafts.game-a", "drafts.game-a", "drafts.game-b", "drafts.game-b"])
  })
})

describe("the ids proposed for games that have none", () => {
  it("are written with the figures, read for the game as if it had them, and replace a wrong one", () => {
    const docs = [game("azul"), game("forest-shuffle", { bggId: 350933, name: "Forest Shuffle" })]
    const plan = planFigures(docs, things(thing(230802), thing(391163, { name: "Forest Shuffle", names: ["Forest Shuffle"] })), new Map([["game-azul", 230802], ["game-forest-shuffle", 391163]]))
    expect(plan.games.map((one) => [one.slug, one.status, one.bggId, one.set.bggId])).toEqual([
      ["azul", "proposed", 230802, 230802],
      ["forest-shuffle", "proposed", 391163, 391163],
    ])
    expect(plan.mutations.filter((mutation) => "patch" in mutation)).toHaveLength(2)
  })

  it("are written even when BGG has no figure for the game, and are checked like any id", () => {
    const empty = thing(7, { name: "Azul", weight: null, weights: 0, minPlayers: null, maxPlayers: null, playingTime: null, minAge: null })
    expect(planFigures([game("azul")], things(empty), new Map([["game-azul", 7]])).games[0]).toMatchObject({ status: "proposed", set: { bggId: 7 } })
    expect(planFigures([game("azul")], things(thing(7, { name: "Another", names: ["Another"] })), new Map([["game-azul", 7]])).games[0]).toMatchObject({ status: "mismatch", set: { bggId: 7 } })
  })

  it("make idsToRead ask for them, and for the games that hold all their figures too", () => {
    const docs = [game("azul"), game("full", { bggId: 3, complexity: 1, playersMin: 1, playersMax: 2, duration: 5, minAge: 6 })]
    expect(idsToRead(docs)).toEqual([])
    expect(idsToRead(docs, new Map([["game-azul", 230802]]))).toEqual([230802])
  })
})

describe("idsToRead", () => {
  it("is the ids of the games that lack a figure, once each, in order", () => {
    const docs = [game("c", { bggId: 30 }), game("a", { bggId: 10 }), game("dup", { bggId: 10 }), game("full", { bggId: 20, complexity: 1, playersMin: 1, playersMax: 2, duration: 5, minAge: 6 }), game("none")]
    expect(idsToRead(docs)).toEqual([10, 30])
  })
})

describe("the report", () => {
  it("says each proposal and its notes, the ids to fix and the totals, and how to write it", () => {
    const docs = [game("azul", { bggId: 1 }), game("forest-shuffle", { bggId: 2, name: "Forest Shuffle" }), game("no-id")]
    const plan = planFigures(docs, things(thing(1), thing(2, { name: "Other", names: ["Other"] })))
    const text = describeFigures(plan, { projectId: "p", dataset: "d", mode: "dry-run" })
    expect(text).toContain("p/d · dry run, nothing written")
    expect(text).toContain("azul: complexity 1.77, players 2–4, 45 min, age 8+ · BGG 7.7/10 by 1000, #99")
    expect(text).toContain("forest-shuffle: BGG id 2 is \"Other\"")
    expect(text).toContain("1 proposed · 1 with a wrong BGG id · 0 already complete · 0 with nothing more on BGG · 0 not found on BGG · 1 without a BGG id")
    expect(text).toContain("Run again with --apply")
    expect(describeFigures(plan, { projectId: "p", dataset: "d", mode: "applied" })).toContain("written as drafts")
    expect(describeFigures(plan, { projectId: "p", dataset: "d", mode: "applied" })).not.toContain("Run again")
  })

  it("keeps the notes of a game it proposes nothing for apart from the ids to fix", () => {
    const plan = planFigures([game("azul", { bggId: 1, playersMin: 2, playersMax: 4, duration: 45, minAge: 8 })], things(thing(1, { weights: 3 })))
    const text = describeFigures(plan, { projectId: "p", dataset: "d", mode: "dry-run" })
    expect(text).toContain("To look at:\n  azul: complexity 1.77 not proposed: only 3 people weighed it")
    expect(text).not.toContain("BGG ids to fix")
  })

  it("names the games BGG did not answer for, and says when there is nothing to write", () => {
    const plan = planFigures([game("lost", { bggId: 99 })], things())
    expect(describeFigures(plan, { projectId: "p", dataset: "d", mode: "dry-run" })).toContain("Not found on BGG: lost (99)")
    expect(describeFigures(plan, { projectId: "p", dataset: "d", mode: "applied" })).toContain("nothing to write")
  })
})

describe("run", () => {
  const read = (...list: BggThing[]) => async (ids: number[]) => things(...list.filter((one) => ids.includes(one.id)))

  it("writes nothing on a dry run, and asks BGG only for the ids that matter", async () => {
    const store = memoryStore([game("azul", { bggId: 1 })])
    const asked: number[][] = []
    const outcome = await run(store, async (ids) => (asked.push(ids), things(thing(1))), { apply: false })
    expect(outcome.mode).toBe("dry-run")
    expect(outcome.plan.games[0]?.status).toBe("proposed")
    expect(store.commits).toEqual([])
    expect(asked).toEqual([[1]])
  })

  it("does not ask BGG at all when no game lacks a figure", async () => {
    const store = memoryStore([game("no-id")])
    let calls = 0
    await run(store, async () => (calls++, things()), { apply: false })
    expect(calls).toBe(0)
  })

  it("writes the drafts in one transaction and reads them back", async () => {
    const store = memoryStore([game("azul", { bggId: 1 }), game("other", { bggId: 2, name: "Other" }, { draft: true })])
    const outcome = await run(store, read(thing(1), thing(2, { name: "Other", names: ["Other"] })), { apply: true })
    expect(outcome).toMatchObject({ mode: "applied", afterProblems: [] })
    expect(store.commits).toHaveLength(1)
    expect(store.docs.get("drafts.game-azul")).toMatchObject({ name: "Azul", complexity: 1.77, duration: 45 })
    expect(store.docs.get("game-azul")).not.toHaveProperty("complexity")
    expect(store.docs.get("drafts.game-other")).toMatchObject({ complexity: 1.77 })
  })

  it("writes nothing, and says so, when there is nothing to write", async () => {
    const store = memoryStore([game("full", { bggId: 3, complexity: 1, playersMin: 1, playersMax: 2, duration: 5, minAge: 6 })])
    expect(await run(store, read(), { apply: true })).toMatchObject({ mode: "applied", afterProblems: [] })
    expect(store.commits).toEqual([])
  })

  it("says when the dataset does not hold what the plan said after the write", async () => {
    const store = memoryStore([game("azul", { bggId: 1 })], { lose: true })
    const outcome = await run(store, read(thing(1)), { apply: true })
    expect(outcome.afterProblems).toEqual(["game-azul: no draft after the write"])
  })

  it("proposes the ids chosen for the games without one, reads the figures for them and writes them together", async () => {
    const store = memoryStore([game("azul"), game("kept", { bggId: 5, complexity: 1, playersMin: 1, playersMax: 2, duration: 5, minAge: 6 })])
    const asked: number[][] = []
    const outcome = await run(
      store,
      async (ids) => (asked.push(ids), things(thing(230802))),
      { apply: true, chooseIds: async (plan) => new Map(plan.games.filter((one) => one.status === "no-id").map((one) => [one.id, 230802])) },
    )
    expect(asked).toEqual([[230802]])
    expect(outcome.afterProblems).toEqual([])
    expect(store.docs.get("drafts.game-azul")).toMatchObject({ bggId: 230802, complexity: 1.77 })
  })

  it("records the complexity it writes as BGG's, so that it can be refreshed, and writes no record for the other figures", async () => {
    const store = memoryStore([game("azul", { bggId: 1 }), game("two", { bggId: 2, name: "Two", complexity: 3 })])
    const outcome = await run(store, read(thing(1), thing(2, { name: "Two", names: ["Two"] })), { apply: true, at: "2026-11-10" })
    expect(outcome.afterProblems).toEqual([])
    expect(store.docs.get(SYNC_ID)).toMatchObject({ _type: SYNC_TYPE, games: { "game-azul": { weight: 1.77, at: "2026-11-10" } } })
    expect(Object.keys((store.docs.get(SYNC_ID)?.games ?? {}) as object)).toEqual(["game-azul"])
  })

  it("does not touch the record when no complexity is written", async () => {
    const store = memoryStore([game("azul", { bggId: 1, complexity: 3 })])
    await run(store, read(thing(1)), { apply: true })
    expect(store.docs.has(SYNC_ID)).toBe(false)
  })

  it("keeps the first plan when nothing is chosen", async () => {
    const store = memoryStore([game("azul")])
    const outcome = await run(store, read(), { apply: false, chooseIds: async () => new Map() })
    expect(outcome.plan.games[0]?.status).toBe("no-id")
  })
})

describe("problemsAfter", () => {
  it("compares each figure of a proposal with the draft read back", () => {
    const plan = planFigures([game("azul", { bggId: 1 })], things(thing(1)))
    const after: Doc[] = [{ ...game("azul", { bggId: 1 }, { draft: true }), complexity: 2, playersMin: 2, playersMax: 4, duration: 45, minAge: 8 }]
    expect(problemsAfter(after, plan)).toEqual(["game-azul: complexity is 2 after the write, not 1.77"])
    expect(problemsAfter([], plan)).toEqual(["game-azul: no draft after the write"])
  })
})
