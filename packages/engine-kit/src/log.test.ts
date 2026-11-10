import { describe, expect, it } from "vitest"
import { EngineError } from "./errors"
import { playStepFor, setupOf, stepOf, viewLog, type LogEntry } from "./log"
import type { TurnHooks } from "./turns"

type Event = { kind: "draw"; seat: number } | { kind: "peek"; seat: number; cards?: number[] } | { kind: "play"; seat: number; card: number }

const log: LogEntry<Event>[] = [
  { event: { kind: "draw", seat: 0 } },
  { event: { kind: "peek", seat: 0, cards: [4, 9, 12] }, to: ["ana"], masked: { kind: "peek", seat: 0 } },
  { event: { kind: "play", seat: 1, card: 7 } },
  { event: { kind: "peek", seat: 1, cards: [2] }, to: ["bob"] },
]

describe("viewLog", () => {
  it("shows the whole of an event to the players it is addressed to", () => {
    expect(viewLog(log, "ana")).toEqual([
      { kind: "draw", seat: 0 },
      { kind: "peek", seat: 0, cards: [4, 9, 12] },
      { kind: "play", seat: 1, card: 7 },
    ])
  })

  it("shows the others the masked version, or nothing when there is none", () => {
    expect(viewLog(log, "bob")).toEqual([
      { kind: "draw", seat: 0 },
      { kind: "peek", seat: 0 },
      { kind: "play", seat: 1, card: 7 },
      { kind: "peek", seat: 1, cards: [2] },
    ])
  })

  it("shows a spectator what is public and what is masked, never what is private", () => {
    expect(viewLog(log, null)).toEqual([
      { kind: "draw", seat: 0 },
      { kind: "peek", seat: 0 },
      { kind: "play", seat: 1, card: 7 },
    ])
  })

  it("treats a player who is not at the table like a spectator", () => {
    expect(viewLog(log, "stranger")).toEqual(viewLog(log, null))
  })

  it("keeps the order of the entries", () => {
    const entries: LogEntry<number>[] = [{ event: 1 }, { event: 2, to: ["a"], masked: 20 }, { event: 3 }, { event: 4, to: ["a", "b"] }]
    expect(viewLog(entries, "b")).toEqual([1, 20, 3, 4])
    expect(viewLog(entries, "a")).toEqual([1, 2, 3, 4])
  })

  it("lets an event be addressed to several players", () => {
    const entries: LogEntry<string>[] = [{ event: "secret", to: ["a", "c"], masked: "hidden" }]
    expect(viewLog(entries, "a")).toEqual(["secret"])
    expect(viewLog(entries, "b")).toEqual(["hidden"])
    expect(viewLog(entries, "c")).toEqual(["secret"])
  })

  it("keeps an event for nobody away from every player, showing only its mask", () => {
    const entries: LogEntry<string>[] = [{ event: "burned", to: [], masked: "a card was burned" }]
    expect(viewLog(entries, "a")).toEqual(["a card was burned"])
    expect(viewLog(entries, null)).toEqual(["a card was burned"])
  })

  it("keeps a falsy mask: only a missing one hides the event", () => {
    const entries: LogEntry<number>[] = [{ event: 5, to: ["a"], masked: 0 }]
    expect(viewLog(entries, "b")).toEqual([0])
  })

  it("does not modify the entries and returns an array of its own", () => {
    const before = JSON.stringify(log)
    const seen = viewLog(log, "ana")
    seen.pop()
    expect(JSON.stringify(log)).toBe(before)
  })

  it("answers an empty log with an empty list", () => {
    expect(viewLog([], "a")).toEqual([])
  })

  it("gives the same answer after the entries went through jsonb", () => {
    const stored = JSON.parse(JSON.stringify(log)) as LogEntry<Event>[]
    for (const viewer of ["ana", "bob", null]) expect(viewLog(stored, viewer)).toEqual(viewLog(log, viewer))
  })
})

// Playing a move and saying what it did

type S = { over: boolean; waiting: string[]; moves: string[] }
type Said = { kind: "said"; by: string }

const state = (patch: Partial<S> = {}): S => ({ over: false, waiting: ["a"], moves: [], ...patch })
const said = (by: string): LogEntry<Said> => ({ event: { kind: "said", by } })
/** A definition made of the turn hooks only, which is all `playStepFor` reads besides `autoPlayStep`. */
const hooks = (extra: Partial<TurnHooks<S>> = {}): TurnHooks<S> => ({ isOver: (s) => s.over, ...extra })

describe("stepOf", () => {
  it("plays the action with step when the game has one, and gives the entries it says", () => {
    const game = {
      apply: (s: S) => ({ ...s, moves: ["apply"] }),
      step: (s: S, a: { type: string; playerId: string }) => ({ state: { ...s, moves: [...s.moves, a.type] }, events: [said(a.playerId)] }),
    }
    const result = stepOf(game, state(), { type: "go", playerId: "a" })
    expect(result.state.moves).toEqual(["go"])
    expect(result.events).toEqual([said("a")])
  })

  it("plays the action with apply and has nothing to log when the game has no step", () => {
    const game = { apply: (s: S, a: { type: string; playerId: string }) => ({ ...s, moves: [...s.moves, a.type] }) }
    expect(stepOf(game, state(), { type: "go", playerId: "a" })).toEqual({ state: state({ moves: ["go"] }), events: [] })
  })

  it("lets the refusal of the game through", () => {
    const game = {
      apply: () => {
        throw new EngineError("NOT_YOUR_TURN")
      },
    }
    expect(() => stepOf(game, state(), { type: "go", playerId: "a" })).toThrow(EngineError)
  })
})

describe("playStepFor", () => {
  it("plays with autoPlayStep when the game has one, and gives the entries it says", () => {
    const game = { ...hooks({ waitingFor: (s) => s.waiting, autoPlayFor: () => state({ moves: ["auto"] }) }), autoPlayStep: (s: S) => ({ state: { ...s, moves: ["step"] }, events: [said("a")] }) }
    const result = playStepFor(game, state(), "a")
    expect(result.state.moves).toEqual(["step"])
    expect(result.events).toEqual([said("a")])
  })

  it("plays with playFor and has nothing to log when the game has no autoPlayStep", () => {
    const game = hooks({ waitingFor: (s) => s.waiting, autoPlayFor: (s, id) => ({ ...s, moves: [...s.moves, id] }) })
    expect(playStepFor(game, state(), "a")).toEqual({ state: state({ moves: ["a"] }), events: [] })
  })

  it("throws NOT_WAITING for a player who is not waiting, before reaching autoPlayStep", () => {
    let reached = false
    const game = {
      ...hooks({ waitingFor: (s) => s.waiting }),
      autoPlayStep: (s: S) => {
        reached = true
        return { state: s, events: [] }
      },
    }
    expect(() => playStepFor(game, state({ waiting: ["a"] }), "b")).toThrow(expect.objectContaining({ code: "NOT_WAITING" }))
    expect(reached).toBe(false)
  })

  it("keeps the refusals of playFor when there is no autoPlayStep", () => {
    expect(() => playStepFor(hooks({ waitingFor: (s) => s.waiting }), state(), "a")).toThrow(expect.objectContaining({ code: "AUTOPLAY_UNSUPPORTED" }))
  })
})

describe("setupOf", () => {
  const table = { players: [{ id: "a", nickname: "Ana" }], options: {}, seed: 5 }

  it("sets the game up with setupStep when the game has one, and gives the entries it says", () => {
    const game = { setup: () => state(), setupStep: () => ({ state: state({ moves: ["dealt"] }), events: [said("a")] }) }
    expect(setupOf(game, table)).toEqual({ state: state({ moves: ["dealt"] }), events: [said("a")] })
  })

  it("sets the game up with setup and has nothing to log when the game has no setupStep", () => {
    const game = { setup: (args: { seed?: number }) => state({ moves: [String(args.seed)] }) }
    expect(setupOf(game, table)).toEqual({ state: state({ moves: ["5"] }), events: [] })
  })

  it("lets the refusal of a table the game cannot play through", () => {
    const game = {
      setup: () => {
        throw new EngineError("INVALID_PLAYERS")
      },
    }
    expect(() => setupOf(game, table)).toThrow(EngineError)
  })
})
