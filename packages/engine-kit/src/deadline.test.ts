import { describe, expect, it } from "vitest"
import type { Deadline, PlayerAction } from "./contract"
import { beginOf, deadlineIn, deadlineOf, isSystemAction, MAX_DEADLINES, settleDeadlines, SYSTEM_PLAYER, systemAction } from "./deadline"
import { EngineError } from "./errors"
import type { Step } from "./log"
import { startTimer, type Timer } from "./timer"

// A game of five turns of ten seconds. A turn that runs out is played by the clock, and the next turn starts its clock from the time the last one ended at.
type State = { turn: number; timer: Timer | null; over: boolean; played: number[] }
type Action = PlayerAction & ({ type: "move" } | { type: "timeout" })
const TURNS = 5

const game = {
  isOver: (state: State) => state.over,
  nextDeadline: (state: State): Deadline<Action> | null => (state.timer ? { at: state.timer.endsAt, action: systemAction("timeout", state.timer.endsAt) as Action } : null),
  apply: (state: State, action: Action): State => {
    const at = action.at ?? 0
    if (action.type === "timeout" && !isSystemAction(action)) throw new EngineError("INVALID_ACTION")
    const turn = state.turn + 1
    return turn >= TURNS ? { turn, timer: null, over: true, played: [...state.played, at] } : { turn, timer: startTimer(at, 10), over: false, played: [...state.played, at] }
  },
  step: (state: State, action: Action): Step<State, { type: string; at: number }> => {
    const next = game.apply(state, action)
    return { state: next, events: [{ event: { type: action.type, at: action.at ?? 0 } }] }
  },
}

const start = (at: number): State => ({ turn: 0, timer: startTimer(at, 10), over: false, played: [] })

describe("a system action", () => {
  it("is the clock's: nobody at the table is called the system", () => {
    const action = systemAction("timeout", 5_000)
    expect(action).toEqual({ type: "timeout", playerId: SYSTEM_PLAYER, at: 5_000 })
    expect(isSystemAction(action)).toBe(true)
    expect(isSystemAction({ playerId: "seat-1" })).toBe(false)
  })
})

describe("a game that goes live", () => {
  it("is begun by its own hook, once the table is playing", () => {
    const timed = { begin: (state: State, at: number): State => ({ ...state, timer: startTimer(at, 10) }) }
    expect(beginOf(timed, { ...start(0), timer: null }, 5_000).timer).toEqual({ endsAt: 15_000, seconds: 10 })
  })

  it("is left as it is when it has no clock", () => {
    const state = start(0)
    expect(beginOf({}, state, 5_000)).toBe(state)
  })
})

describe("the deadline of a game", () => {
  it("is what the game says, from its state alone", () => {
    expect(deadlineOf(game, start(1_000))).toEqual({ at: 11_000, action: { type: "timeout", playerId: SYSTEM_PLAYER, at: 11_000 } })
  })

  it("is none for a game with no clock, a state with no timer, and a game that is over", () => {
    expect(deadlineOf({ isOver: () => false }, start(0))).toBeNull()
    expect(deadlineOf(game, { ...start(0), timer: null })).toBeNull()
    expect(deadlineOf(game, { ...start(0), over: true })).toBeNull()
  })

  it("is none when what the game says is not a deadline", () => {
    const state = start(0)
    expect(deadlineOf({ isOver: () => false, nextDeadline: () => ({ at: Number.NaN, action: systemAction("timeout", 0) }) }, state)).toBeNull()
    expect(deadlineOf({ isOver: () => false, nextDeadline: () => ({ at: Number.POSITIVE_INFINITY, action: systemAction("timeout", 0) }) }, state)).toBeNull()
    // A player's action is not a system action: the clock never plays a seat's move
    expect(deadlineOf({ isOver: () => false, nextDeadline: () => ({ at: 1, action: { type: "move", playerId: "seat-1" } }) }, state)).toBeNull()
  })

  it("is read as a duration from `now`, a whole number of milliseconds that is never below zero", () => {
    const state = start(0)
    expect(deadlineIn(game, state, 0)).toBe(10_000)
    expect(deadlineIn(game, state, 2_500.4)).toBe(7_500)
    expect(deadlineIn(game, state, 10_000)).toBe(0)
    expect(deadlineIn(game, state, 99_000)).toBe(0)
    expect(deadlineIn(game, { ...state, timer: null }, 0)).toBeNull()
  })
})

describe("settling the deadlines of a table", () => {
  it("leaves a table with nothing due as it is", () => {
    const state = start(0)
    const settled = settleDeadlines(game, state, 9_999)
    expect(settled.state).toBe(state)
    expect(settled.applied).toBe(0)
    expect(settled.events).toEqual([])
  })

  it("plays a deadline that is due with the time it was due at, not the time it is played at", () => {
    const settled = settleDeadlines(game, start(0), 10_000 + 3_217)
    expect(settled.applied).toBe(1)
    // The next turn started its clock when the last one ended, so it is not due yet: 20_000 is after the 13_217 it was settled at
    expect(settled.state.played).toEqual([10_000])
    expect(settled.state.timer).toEqual({ endsAt: 20_000, seconds: 10 })
    expect(settled.events).toEqual([{ event: { type: "timeout", at: 10_000 } }])
  })

  it("plays the deadlines of a table that nobody looked at for a while, in order", () => {
    const settled = settleDeadlines(game, start(0), 35_000)
    expect(settled.applied).toBe(3)
    expect(settled.state.played).toEqual([10_000, 20_000, 30_000])
    expect(settled.events.map((entry) => entry.event.at)).toEqual([10_000, 20_000, 30_000])
    expect(settled.state.timer).toEqual({ endsAt: 40_000, seconds: 10 })
  })

  it("stops when the game is over", () => {
    const settled = settleDeadlines(game, start(0), 10 * 60 * 60 * 1000)
    expect(settled.state.over).toBe(true)
    expect(settled.state.timer).toBeNull()
    expect(settled.applied).toBe(TURNS)
  })

  it("is the same game whenever the table is settled", () => {
    const late = settleDeadlines(game, start(0), 500_000).state
    // Settled a few times along the way, at times that fall between deadlines
    let state = start(0)
    for (const now of [3_000, 12_000, 12_001, 24_999, 25_000, 41_000, 500_000]) state = settleDeadlines(game, state, now).state
    expect(state).toEqual(late)
  })

  it("settling twice at the same time plays nothing the second time", () => {
    const once = settleDeadlines(game, start(0), 25_000)
    const twice = settleDeadlines(game, once.state, 25_000)
    expect(twice.applied).toBe(0)
    expect(twice.state).toBe(once.state)
  })

  it("plays no more than `maxSteps` deadlines in one go, and the rest at the next call", () => {
    const first = settleDeadlines(game, start(0), 1_000_000, 2)
    expect(first.applied).toBe(2)
    expect(first.state.over).toBe(false)
    const rest = settleDeadlines(game, first.state, 1_000_000, 2)
    expect(rest.applied).toBe(2)
    expect(settleDeadlines(game, rest.state, 1_000_000, 2).state.over).toBe(true)
    expect(MAX_DEADLINES).toBeGreaterThan(TURNS)
  })

  it("tells what it is about to play, state and deadline, before each deadline", () => {
    const seen: { turn: number; at: number }[] = []
    settleDeadlines(game, start(0), 25_000, MAX_DEADLINES, (state, due) => seen.push({ turn: state.turn, at: due.at }))
    expect(seen).toEqual([
      { turn: 0, at: 10_000 },
      { turn: 1, at: 20_000 },
    ])
  })

  it("says it when the game refuses its own deadline", () => {
    const broken = { ...game, step: undefined, apply: () => { throw new EngineError("INVALID_PHASE") } }
    expect(() => settleDeadlines(broken, start(0), 99_000)).toThrow(EngineError)
  })

  it("leaves the state it was given alone", () => {
    const state = Object.freeze({ ...start(0), played: Object.freeze([]) as unknown as number[] })
    expect(() => settleDeadlines(game, state, 99_000)).not.toThrow()
  })
})
