import { type AnyGameDefinition, systemAction } from "@pbgo/engine-kit"
import { describe, expect, it, vi } from "vitest"
import { deadlineDue, deadlinePatch, playDueDeadlines, playDueSafely } from "./deadlines"

// A game of four turns of ten seconds, one player after the other, a turn that runs out played by the clock.
type State = { turn: number; deadline: number | null }
const PLAYERS = ["a", "b"]
const over = (state: State) => state.turn >= 4
const advance = (state: State, at: number | undefined): State => ({ turn: state.turn + 1, deadline: at === undefined || state.turn + 1 >= 4 ? null : at + 10_000 })
const GAME = {
  id: "ticks",
  name: "Ticks",
  minPlayers: 2,
  maxPlayers: 2,
  options: {},
  clientActions: ["move"],
  setup: () => ({ turn: 0, deadline: 10_000 }),
  apply: (state: State, action: { at?: number }) => advance(state, action.at),
  view: () => ({}),
  isOver: over,
  waitingFor: (state: State) => (over(state) ? [] : [PLAYERS[state.turn % 2]!]),
  autoPlayFor: (state: State, _id: string, at?: number) => advance(state, at),
  nextDeadline: (state: State) => (over(state) || state.deadline === null ? null : { at: state.deadline, action: systemAction("timeout", state.deadline) }),
} as unknown as AnyGameDefinition

const table = (state: State | null, status: "lobby" | "starting" | "playing" | "over" = "playing") => ({ status, state })

describe("a table with a deadline", () => {
  it("has one due when its game is in play, has a clock, and the time has come", () => {
    expect(deadlineDue(GAME, table({ turn: 0, deadline: 10_000 }), 10_000)).toBe(true)
    expect(deadlineDue(GAME, table({ turn: 0, deadline: 10_000 }), 9_999)).toBe(false)
  })

  it("has none when it is not in play, whatever its state says", () => {
    for (const status of ["lobby", "starting", "over"] as const) expect(deadlineDue(GAME, table({ turn: 0, deadline: 0 }, status), 99_000)).toBe(false)
  })

  it("has none without a game, without a clock, or when the game is over", () => {
    expect(deadlineDue(GAME, table(null), 99_000)).toBe(false)
    expect(deadlineDue({ ...GAME, nextDeadline: undefined } as AnyGameDefinition, table({ turn: 0, deadline: 0 }), 99_000)).toBe(false)
    expect(deadlineDue(GAME, table({ turn: 4, deadline: 0 }), 99_000)).toBe(false)
  })
})

describe("playing what the clock owes", () => {
  it("plays each deadline at its own time, and says whom the game was waiting for each time", () => {
    const due = playDueDeadlines(GAME, { turn: 0, deadline: 10_000 }, 35_000)
    expect(due.applied).toBe(3)
    expect(due.state).toEqual({ turn: 3, deadline: 40_000 })
    expect(due.playedFor).toEqual(["a", "b"])
  })

  it("plays nothing for a state with no deadline due, and gives the state back", () => {
    const state = { turn: 0, deadline: 10_000 }
    const due = playDueDeadlines(GAME, state, 5_000)
    expect(due.state).toBe(state)
    expect(due.applied).toBe(0)
    expect(due.playedFor).toEqual([])
  })
})

describe("what a deadline writes", () => {
  it("is the new state, and whether the game is over", () => {
    expect(deadlinePatch(GAME, table({ turn: 0, deadline: 10_000 }), 15_000)?.patch).toEqual({ state: { turn: 1, deadline: 20_000 }, status: "playing" })
    expect(deadlinePatch(GAME, table({ turn: 3, deadline: 10_000 }), 15_000)?.patch).toEqual({ state: { turn: 4, deadline: null }, status: "over" })
  })

  it("is nothing when none is due, which is what a request that lost the race finds", () => {
    expect(deadlinePatch(GAME, table({ turn: 0, deadline: 10_000 }), 5_000)).toBeNull()
    expect(deadlinePatch(GAME, table({ turn: 0, deadline: 10_000 }, "over"), 99_000)).toBeNull()
  })

  it("says whom the clock played for", () => {
    expect(deadlinePatch(GAME, table({ turn: 1, deadline: 10_000 }), 15_000)?.playedFor).toEqual(["b"])
  })
})

describe("a deadline that the game refuses to play", () => {
  const broken = { ...GAME, apply: () => { throw new Error("boom") } } as unknown as AnyGameDefinition

  it("is left, so the table can still be read and its players can still move", () => {
    const state = { turn: 0, deadline: 10_000 }
    expect(() => playDueDeadlines(broken, state, 99_000)).toThrow("boom")
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {})
    const due = playDueSafely(broken, state, 99_000)
    expect(due.state).toBe(state)
    expect(due.applied).toBe(0)
    expect(quiet).toHaveBeenCalled()
    expect(deadlinePatch(broken, table(state), 99_000)).toBeNull()
    quiet.mockRestore()
  })
})
