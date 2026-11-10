import { afterEach, describe, expect, it, vi } from "vitest"
import { debugEnabled, restoreState, saveState } from "./debug-table"

vi.mock("server-only", () => ({}))

afterEach(() => vi.unstubAllEnvs())

describe("debugEnabled", () => {
  it("is on everywhere but on a production deployment", () => {
    vi.stubEnv("NODE_ENV", "development")
    expect(debugEnabled()).toBe(true)
    vi.stubEnv("NODE_ENV", "test")
    expect(debugEnabled()).toBe(true)
  })

  it("is off on a production deployment, unless DEBUG_GAMES says 1", () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("DEBUG_GAMES", "")
    expect(debugEnabled()).toBe(false)
    vi.stubEnv("DEBUG_GAMES", "true")
    expect(debugEnabled()).toBe(false)
    vi.stubEnv("DEBUG_GAMES", "1")
    expect(debugEnabled()).toBe(true)
  })
})

describe("saveState and restoreState", () => {
  const state = { seats: ["p1", "p2", "p3"], hands: { p1: [1], p2: [2], p3: [3] }, turn: "p2", deck: [5, 6], round: 2 }
  const saved = saveState("flip-7", ["p1", "p2", "p3"], state, new Date("2026-11-10T12:00:00.000Z"))

  it("keeps the game, the seats in order, the state and the day", () => {
    expect(saved).toEqual({ game: "flip-7", players: ["p1", "p2", "p3"], state, savedAt: "2026-11-10T12:00:00.000Z" })
  })

  it("puts the ids of the seats of another table wherever the saved ids were, as values and as keys", () => {
    expect(restoreState(saved, "flip-7", ["a", "b", "c"])).toEqual({ seats: ["a", "b", "c"], hands: { a: [1], b: [2], c: [3] }, turn: "b", deck: [5, 6], round: 2 })
  })

  it("loads a state into the table it came from as it was", () => {
    expect(restoreState(saved, "flip-7", ["p1", "p2", "p3"])).toEqual(state)
  })

  it("maps seats that swap places in one pass", () => {
    const swapped = restoreState(saveState("g", ["a", "b"], { turn: "a", scores: { a: 1, b: 2 } }), "g", ["b", "a"])
    expect(swapped).toEqual({ turn: "b", scores: { b: 1, a: 2 } })
  })

  it("replaces whole ids only: an id inside a longer string, or another number, stays", () => {
    const text = restoreState(saveState("g", ["p1", "p2"], { a: "p10", b: ["p1", "seat-p2"], c: 1 }), "g", ["x", "y"])
    expect(text).toEqual({ a: "p10", b: ["x", "seat-p2"], c: 1 })
  })

  it("copes with ids that hold characters of a pattern", () => {
    expect(restoreState(saveState("g", ["a.b", "(c)"], { v: ["a.b", "(c)", "axb"] }), "g", ["x", "y"])).toEqual({ v: ["x", "y", "axb"] })
  })

  it("does not touch what it was given", () => {
    const before = structuredClone(saved)
    restoreState(saved, "flip-7", ["a", "b", "c"])
    expect(saved).toEqual(before)
  })

  it("refuses what is not a state saved from this game for as many seats", () => {
    expect(() => restoreState(saved, "hanabi", ["a", "b", "c"])).toThrow(RangeError)
    expect(() => restoreState(saved, "flip-7", ["a", "b"])).toThrow("3 seats")
    expect(() => restoreState(null, "flip-7", ["a"])).toThrow(RangeError)
    expect(() => restoreState("text", "flip-7", ["a"])).toThrow(RangeError)
    expect(() => restoreState({ ...saved, players: ["p1", "p1", "p3"] }, "flip-7", ["a", "b", "c"])).toThrow(RangeError)
    expect(() => restoreState({ ...saved, players: ["p1", 2, "p3"] }, "flip-7", ["a", "b", "c"])).toThrow(RangeError)
    expect(() => restoreState({ ...saved, state: null }, "flip-7", ["a", "b", "c"])).toThrow(RangeError)
    expect(() => restoreState({ ...saved, state: "x" }, "flip-7", ["a", "b", "c"])).toThrow(RangeError)
  })
})
