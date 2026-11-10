import { describe, expect, it } from "vitest"
import type { Doc } from "./figures.ts"
import { CLAIM_TOLERANCE, MIN_CHANGE, describeRefresh, idsToRefresh, planRefresh, problemsAfterRefresh, runRefresh } from "./refresh.ts"
import { SYNC_ID, SYNC_TYPE, readSync } from "./sync.ts"
import { game, memoryStore, thing, things } from "./test-fixtures.ts"

const AT = "2026-11-17"

/** The record of BGG's weights, as `sync.ts` keeps it. */
const synced = (games: Record<string, { weight: number; at: string }>): Doc => ({ _id: SYNC_ID, _type: SYNC_TYPE, _rev: "rev-sync", games })

/** BGG's answer for a game whose weight is `weight`, given by 500 people. */
const weighed = (id: number, weight: number | null, over: Partial<ReturnType<typeof thing>> = {}) => thing(id, { weight, weights: 500, ...over })

describe("which games are looked at", () => {
  it("are the ones that hold a complexity, in the draft or the published document, and have a BGG id", () => {
    const docs = [game("azul", { bggId: 2, complexity: 1.7 }), game("draft-only", { bggId: 1, complexity: 2 }, { draft: true }), game("no-complexity", { bggId: 3 }), game("no-id", { complexity: 2 }), game("zero", { bggId: 4, complexity: 0 })]
    expect(idsToRefresh(docs)).toEqual([1, 2, 4])
    const plan = planRefresh(docs, things(weighed(1, 2.1, { name: "Draft Only", names: ["Draft Only"] }), weighed(2, 1.7), weighed(4, 3, { name: "Zero", names: ["Zero"] })), AT)
    expect(plan.games.map((one) => one.slug)).toEqual(["azul", "draft-only", "zero"])
  })
})

describe("the first run, when nothing is recorded yet", () => {
  it("records the weights that are BGG's within the tolerance, and writes nothing to the games", () => {
    const docs = [game("azul", { bggId: 1, complexity: 1.77 }), game("azul", { bggId: 1, complexity: 1.77 }, { draft: true })]
    const plan = planRefresh(docs, things(weighed(1, 1.7852)), AT)
    expect(plan.games[0]).toMatchObject({ status: "claimed", from: 1.77, to: 1.77, targets: [] })
    expect(plan.mutations).toEqual([
      { createIfNotExists: { _id: SYNC_ID, _type: SYNC_TYPE, games: {} } },
      { patch: { id: SYNC_ID, set: { games: { "game-azul": { weight: 1.77, at: AT } } } } },
    ])
  })

  it("takes a value further from BGG's than the tolerance for one the owner set, and says so", () => {
    expect(CLAIM_TOLERANCE).toBeLessThan(MIN_CHANGE)
    const plan = planRefresh([game("azul", { bggId: 1, complexity: 3 })], things(weighed(1, 1.77)), AT)
    expect(plan.games[0]).toMatchObject({ status: "by-hand", notes: [expect.stringContaining("left alone")] })
    expect(plan.mutations).toEqual([])
  })

  it("does not record a value when the published document and the draft disagree", () => {
    const docs = [game("azul", { bggId: 1, complexity: 1.77 }), game("azul", { bggId: 1, complexity: 1.79 }, { draft: true })]
    expect(planRefresh(docs, things(weighed(1, 1.78)), AT).games[0]?.status).toBe("by-hand")
  })
})

describe("the refresh, once the weight is recorded", () => {
  const record = (weight: number) => synced({ "game-azul": { weight, at: "2026-11-10" } })

  it("brings the complexity up to date in the published document and the draft that hold BGG's weight, and records the new one", () => {
    const docs = [game("azul", { bggId: 1, complexity: 1.77 }), game("azul", { bggId: 1, complexity: 1.77 }, { draft: true }), record(1.77)]
    const plan = planRefresh(docs, things(weighed(1, 1.9)), AT)
    expect(plan.games[0]).toMatchObject({ status: "refreshed", from: 1.77, to: 1.9, targets: ["game-azul", "drafts.game-azul"] })
    expect(plan.mutations).toEqual([
      { patch: { id: "game-azul", ifRevisionID: "rev-azul", set: { complexity: 1.9 } } },
      { patch: { id: "drafts.game-azul", ifRevisionID: "rev-azul-draft", set: { complexity: 1.9 } } },
      { patch: { id: SYNC_ID, ifRevisionID: "rev-sync", set: { games: { "game-azul": { weight: 1.9, at: AT } } } } },
    ])
  })

  it("leaves the one that the owner changed, and refreshes the one that is still BGG's", () => {
    const docs = [game("azul", { bggId: 1, complexity: 1.77 }), game("azul", { bggId: 1, complexity: 4 }, { draft: true }), record(1.77)]
    const plan = planRefresh(docs, things(weighed(1, 2.2)), AT)
    expect(plan.games[0]?.targets).toEqual(["game-azul"])
    expect(plan.mutations).toHaveLength(2)
  })

  it("refreshes a draft that is not published yet, the only one that holds the weight", () => {
    const plan = planRefresh([game("azul", { bggId: 1, complexity: 1.77 }, { draft: true }), record(1.77)], things(weighed(1, 2.2)), AT)
    expect(plan.games[0]).toMatchObject({ status: "refreshed", targets: ["drafts.game-azul"] })
  })

  it("does nothing for a complexity the owner set by hand, however far BGG's weight moved", () => {
    const plan = planRefresh([game("azul", { bggId: 1, complexity: 3 }), record(1.77)], things(weighed(1, 2.5)), AT)
    expect(plan.games[0]).toMatchObject({ status: "by-hand", from: 1.77, notes: [expect.stringContaining("set by hand")] })
    expect(plan.mutations).toEqual([])
  })

  it("does nothing for a change under the threshold: every vote moves the second decimal", () => {
    const plan = planRefresh([game("azul", { bggId: 1, complexity: 1.77 }), record(1.77)], things(weighed(1, 1.77 + MIN_CHANGE - 0.01)), AT)
    expect(plan.games[0]).toMatchObject({ status: "unchanged", from: 1.77 })
    expect(plan.mutations).toEqual([])
    expect(planRefresh([game("azul", { bggId: 1, complexity: 1.77 }), record(1.77)], things(weighed(1, 1.77 - MIN_CHANGE - 0.001)), AT).games[0]?.status).toBe("refreshed")
  })

  it("writes the weight to two decimals", () => {
    const plan = planRefresh([game("azul", { bggId: 1, complexity: 1.77 }), record(1.77)], things(weighed(1, 2.0049)), AT)
    expect(plan.games[0]?.to).toBe(2)
  })

  it("says what it could not do: too few votes, an id that is another game, nothing from BGG", () => {
    const docs = [
      game("azul", { bggId: 1, complexity: 1.77 }),
      game("catan", { bggId: 2, complexity: 2.28 }),
      game("lost", { bggId: 3, complexity: 2 }),
    ]
    const sync = synced({ "game-azul": { weight: 1.77, at: "d" }, "game-catan": { weight: 2.28, at: "d" }, "game-lost": { weight: 2, at: "d" } })
    const plan = planRefresh([...docs, sync], things(weighed(1, 2.5, { weights: 4 }), weighed(2, 2.5, { name: "Another", names: ["Another"] })), AT)
    expect(plan.games.map((one) => [one.slug, one.status])).toEqual([
      ["azul", "few-votes"],
      ["catan", "mismatch"],
      ["lost", "not-found"],
    ])
    expect(plan.mutations).toEqual([])
  })

  it("does not touch a game with no weight from BGG either", () => {
    expect(planRefresh([game("azul", { bggId: 1, complexity: 1.77 }), record(1.77)], things(weighed(1, null, { weights: 0 })), AT).games[0]?.status).toBe("few-votes")
  })
})

describe("the report", () => {
  it("says each game refreshed with where, the ones recorded, what needs a look and the totals", () => {
    const docs = [
      game("azul", { bggId: 1, complexity: 1.77 }),
      game("azul", { bggId: 1, complexity: 1.77 }, { draft: true }),
      game("catan", { bggId: 2, complexity: 2.28 }, { draft: true }),
      game("hand", { bggId: 3, complexity: 4 }),
      game("new", { bggId: 4, complexity: 1.5 }),
      synced({ "game-azul": { weight: 1.77, at: "d" }, "game-catan": { weight: 2.28, at: "d" } }),
    ]
    const plan = planRefresh(docs, things(weighed(1, 1.95), weighed(2, 2.6, { name: "Catan", names: ["Catan"] }), weighed(3, 2.1, { name: "Hand", names: ["Hand"] }), weighed(4, 1.51, { name: "New", names: ["New"] })), AT)
    const text = describeRefresh(plan, { projectId: "p", dataset: "d", mode: "dry-run" })
    expect(text).toContain("refresh · p/d · dry run, nothing written")
    expect(text).toContain("azul: 1.77 → 1.95 (published and draft)")
    expect(text).toContain("catan: 2.28 → 2.6 (draft only)")
    expect(text).toContain("Recorded as BGG's from now on (1, the value is BGG's within 0.02): new")
    expect(text).toContain("hand: complexity 4 is not BGG's 2.1")
    expect(text).toContain("2 refreshed · 1 recorded · 0 unchanged (under 0.05) · 1 set by hand")
    expect(text).toContain("Run again with --apply")
    expect(describeRefresh(plan, { projectId: "p", dataset: "d", mode: "applied" })).toContain(" · written")
    expect(describeRefresh({ games: [], mutations: [] }, { projectId: "p", dataset: "d", mode: "applied" })).toContain("nothing to write")
  })
})

describe("runRefresh", () => {
  const read = (...list: ReturnType<typeof thing>[]) => async (ids: number[]) => things(...list.filter((one) => ids.includes(one.id)))
  const stored = () => [game("azul", { bggId: 1, complexity: 1.77 }), game("azul", { bggId: 1, complexity: 1.77 }, { draft: true })]

  it("writes nothing on a dry run, and asks BGG only for the games that hold a complexity", async () => {
    const store = memoryStore(stored())
    const asked: number[][] = []
    const outcome = await runRefresh(store, async (ids) => (asked.push(ids), things(weighed(1, 1.77))), { apply: false, at: AT })
    expect(outcome.mode).toBe("dry-run")
    expect(store.commits).toEqual([])
    expect(asked).toEqual([[1]])
    expect(outcome.plan.games[0]?.status).toBe("claimed")
  })

  it("does not ask BGG at all when no game holds a complexity", async () => {
    let calls = 0
    await runRefresh(memoryStore([game("azul", { bggId: 1 })]), async () => (calls++, things()), { apply: false, at: AT })
    expect(calls).toBe(0)
  })

  it("records on the first run, refreshes on the next, and the one after that has nothing to do", async () => {
    const store = memoryStore(stored())
    const first = await runRefresh(store, read(weighed(1, 1.77)), { apply: true, at: "2026-11-10" })
    expect(first).toMatchObject({ mode: "applied", afterProblems: [] })
    expect(readSync([...store.docs.values()]).games).toEqual({ "game-azul": { weight: 1.77, at: "2026-11-10" } })

    const second = await runRefresh(store, read(weighed(1, 2.05)), { apply: true, at: AT })
    expect(second).toMatchObject({ mode: "applied", afterProblems: [] })
    expect(store.docs.get("game-azul")?.complexity).toBe(2.05)
    expect(store.docs.get("drafts.game-azul")?.complexity).toBe(2.05)
    expect(readSync([...store.docs.values()]).games["game-azul"]).toEqual({ weight: 2.05, at: AT })

    const commits = store.commits.length
    const third = await runRefresh(store, read(weighed(1, 2.05)), { apply: true, at: "2026-11-24" })
    expect(third.plan.games[0]?.status).toBe("unchanged")
    expect(store.commits).toHaveLength(commits)
  })

  it("leaves the complexity the owner changes between two runs", async () => {
    const store = memoryStore(stored())
    await runRefresh(store, read(weighed(1, 1.77)), { apply: true, at: "2026-11-10" })
    store.docs.get("game-azul")!.complexity = 3
    store.docs.get("drafts.game-azul")!.complexity = 3
    const outcome = await runRefresh(store, read(weighed(1, 2.5)), { apply: true, at: AT })
    expect(outcome.plan.games[0]?.status).toBe("by-hand")
    expect(store.docs.get("game-azul")?.complexity).toBe(3)
  })

  it("says when the dataset does not hold what the plan said after the write", async () => {
    const store = memoryStore(stored(), { lose: true })
    const outcome = await runRefresh(store, read(weighed(1, 1.77)), { apply: true, at: AT })
    expect(outcome.afterProblems).toEqual([expect.stringContaining("the record of BGG's weight is undefined after the write")])
  })
})

describe("problemsAfterRefresh", () => {
  it("compares each patched document and the record with the dataset read back", () => {
    const docs = [game("azul", { bggId: 1, complexity: 1.77 }), synced({ "game-azul": { weight: 1.77, at: "2026-11-10" } })]
    const plan = planRefresh(docs, things(weighed(1, 2.2)), AT)
    const after = [game("azul", { bggId: 1, complexity: 1.77 }), synced({ "game-azul": { weight: 1.77, at: "2026-11-10" } })]
    expect(problemsAfterRefresh(after, plan, AT)).toEqual(["game-azul: complexity is 1.77 after the write, not 2.2", expect.stringContaining("the record of BGG's weight is")])
    const written = [game("azul", { bggId: 1, complexity: 2.2 }), synced({ "game-azul": { weight: 2.2, at: AT } })]
    expect(problemsAfterRefresh(written, plan, AT)).toEqual([])
  })
})
