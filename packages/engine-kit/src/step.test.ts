import { describe, expect, it } from "vitest"
import { closeStep, noteEvent, openStep } from "./step"
import { createSaveableRng, restoreRng } from "./rng"

type State = { rng: number; idsRng: number; count: number; nested: { list: number[] } }
type Event = { kind: "draw"; card: number } | { kind: "peek"; seat: number; cards?: number[] }

const start = (): State => ({ rng: createSaveableRng(7).save(), idsRng: createSaveableRng(99).save(), count: 0, nested: { list: [1, 2, 3] } })

describe("opening a step", () => {
  it("works on a copy: mutating it leaves the state that came in alone", () => {
    const state = start()
    const ctx = openStep<State, Event, "rng" | "idsRng">(state, ["rng", "idsRng"])
    ctx.s.count = 9
    ctx.s.nested.list.push(4)
    expect(state.count).toBe(0)
    expect(state.nested.list).toEqual([1, 2, 3])
  })

  it("picks each stream up where the last step left it", () => {
    const state = start()
    const ctx = openStep<State, Event, "rng" | "idsRng">(state, ["rng", "idsRng"])
    const rng = restoreRng(state.rng)
    const side = restoreRng(state.idsRng)
    for (let i = 0; i < 5; i++) {
      expect(ctx.rng()).toBe(rng())
      expect(ctx.idsRng()).toBe(side())
    }
  })

  it("keeps the main stream only unless it is told others", () => {
    const ctx = openStep<{ rng: number }, Event>({ rng: createSaveableRng(3).save() })
    expect(typeof ctx.rng).toBe("function")
    expect(Object.keys(ctx).sort()).toEqual(["events", "rng", "s"])
  })

  it("starts with nothing noted", () => {
    expect(openStep<State, Event>(start()).events).toEqual([])
  })
})

describe("closing a step", () => {
  it("saves every stream back, so the next step goes on from there", () => {
    const state = start()
    const ctx = openStep<State, Event, "rng" | "idsRng">(state, ["rng", "idsRng"])
    ctx.rng()
    ctx.rng()
    ctx.idsRng()
    const { state: after } = closeStep(ctx)
    const reference = restoreRng(state.rng)
    reference()
    reference()
    const side = restoreRng(state.idsRng)
    side()
    expect(restoreRng(after.rng)()).toBe(reference())
    expect(restoreRng(after.idsRng)()).toBe(side())
  })

  it("leaves a stream that was not drawn from where it was", () => {
    const state = start()
    const { state: after } = closeStep(openStep<State, Event, "rng" | "idsRng">(state, ["rng", "idsRng"]))
    expect(after.rng).toBe(state.rng)
    expect(after.idsRng).toBe(state.idsRng)
  })

  it("gives the state the step changed and what happened, and never the state that came in", () => {
    const state = start()
    const ctx = openStep<State, Event>(state)
    ctx.s.count = 3
    noteEvent(ctx, { kind: "draw", card: 12 })
    const step = closeStep(ctx)
    expect(step.state.count).toBe(3)
    expect(step.state).not.toBe(state)
    expect(step.events).toEqual([{ event: { kind: "draw", card: 12 } }])
  })

  it("saves only the streams the step opened", () => {
    const state = start()
    const ctx = openStep<State, Event>(state)
    ctx.rng()
    const { state: after } = closeStep(ctx)
    expect(after.rng).not.toBe(state.rng)
    expect(after.idsRng).toBe(state.idsRng)
  })
})

describe("noting what happened", () => {
  it("is public with no hidden part: no `to` and no `masked`", () => {
    const ctx = openStep<State, Event>(start())
    noteEvent(ctx, { kind: "draw", card: 4 })
    expect(ctx.events[0]).toEqual({ event: { kind: "draw", card: 4 } })
    expect("to" in ctx.events[0]!).toBe(false)
  })

  it("is private to the players it names, with what the others read instead", () => {
    const ctx = openStep<State, Event>(start())
    noteEvent(ctx, { kind: "peek", seat: 2, cards: [4, 9] }, { to: ["alice"], masked: { kind: "peek", seat: 2 } })
    expect(ctx.events[0]).toEqual({ event: { kind: "peek", seat: 2, cards: [4, 9] }, to: ["alice"], masked: { kind: "peek", seat: 2 } })
  })

  it("keeps the order things happened in", () => {
    const ctx = openStep<State, Event>(start())
    for (const card of [1, 2, 3]) noteEvent(ctx, { kind: "draw", card })
    expect(ctx.events.map((entry) => (entry.event.kind === "draw" ? entry.event.card : -1))).toEqual([1, 2, 3])
  })
})
