import { describe, expect, it } from "vitest"
import { SYNC_ID, SYNC_TYPE, readSync, syncMutations } from "./sync.ts"

const record = (games: Record<string, unknown>, rev = "rev-1") => ({ _id: SYNC_ID, _type: SYNC_TYPE, _rev: rev, games })

describe("readSync", () => {
  it("reads the weight and the day recorded for each game", () => {
    const sync = readSync([{ _id: "game-azul", _type: "game" }, record({ "game-azul": { weight: 1.77, at: "2026-11-10" }, "game-catan": { weight: 2.28, at: "2026-11-11" } })])
    expect(sync.games).toEqual({ "game-azul": { weight: 1.77, at: "2026-11-10" }, "game-catan": { weight: 2.28, at: "2026-11-11" } })
    expect(sync.doc?._rev).toBe("rev-1")
  })

  it("has nothing when there is no record yet, or a document of another type under its id", () => {
    expect(readSync([])).toEqual({ doc: undefined, games: {} })
    expect(readSync([{ _id: SYNC_ID, _type: "game", games: { "game-azul": { weight: 1, at: "x" } } }])).toEqual({ doc: undefined, games: {} })
  })

  it("leaves out an entry that is not a weight and a day, and a record whose games are not a map", () => {
    const sync = readSync([record({ ok: { weight: 2, at: "2026-11-10" }, noWeight: { at: "2026-11-10" }, noDay: { weight: 2 }, text: { weight: "2", at: "d" }, nan: { weight: Number.NaN, at: "d" }, string: "x", nothing: null })])
    expect(Object.keys(sync.games)).toEqual(["ok"])
    expect(readSync([record([] as unknown as Record<string, unknown>)]).games).toEqual({})
    expect(readSync([{ _id: SYNC_ID, _type: SYNC_TYPE }]).games).toEqual({})
  })
})

describe("syncMutations", () => {
  it("makes the record when there is none, then sets the map in one patch", () => {
    expect(syncMutations(readSync([]), { "game-azul": { weight: 1.77, at: "2026-11-10" } })).toEqual([
      { createIfNotExists: { _id: SYNC_ID, _type: SYNC_TYPE, games: {} } },
      { patch: { id: SYNC_ID, set: { games: { "game-azul": { weight: 1.77, at: "2026-11-10" } } } } },
    ])
  })

  it("keeps what was recorded, replaces what is updated, guards the patch with the revision read and sorts the keys", () => {
    const sync = readSync([record({ "game-b": { weight: 2, at: "2026-11-01" }, "game-c": { weight: 3, at: "2026-11-01" } }, "rev-9")])
    const [patch, ...others] = syncMutations(sync, { "game-a": { weight: 1, at: "2026-11-10" }, "game-b": { weight: 2.5, at: "2026-11-10" } })
    expect(others).toEqual([])
    expect(patch).toEqual({
      patch: {
        id: SYNC_ID,
        ifRevisionID: "rev-9",
        set: { games: { "game-a": { weight: 1, at: "2026-11-10" }, "game-b": { weight: 2.5, at: "2026-11-10" }, "game-c": { weight: 3, at: "2026-11-01" } } },
      },
    })
    const set = patch && "patch" in patch ? patch.patch.set : {}
    expect(Object.keys((set.games ?? {}) as object)).toEqual(["game-a", "game-b", "game-c"])
  })

  it("writes nothing when nothing is updated", () => {
    expect(syncMutations(readSync([record({})]), {})).toEqual([])
  })
})
