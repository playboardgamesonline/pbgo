import { describe, expect, it } from "vitest"
import { closeStep, noteEvent, openStep, type StepContext } from "./step"
import type { LogEntry } from "./log"
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

describe("a context a game names", () => {
  // A game gives the kit its types with an alias, as the docs ask it to, and closes the context with no type argument: the alias must be enough for `closeStep` to read the state and the events from
  type Main = StepContext<State, Event>
  type Both = StepContext<State, Event, "rng" | "idsRng">
  const closeMain = (ctx: Main) => closeStep(ctx)
  const closeBoth = (ctx: Both) => closeStep(ctx)
  // and the one-liner of the README, which keeps the generics of the function
  const close = closeStep

  it("closes a context of the main stream, whatever it is named", () => {
    const ctx: Main = openStep<State, Event>(start())
    ctx.s.count = 5
    noteEvent(ctx, { kind: "draw", card: 1 })
    const step = closeMain(ctx)
    expect(step.state.count).toBe(5)
    expect(step.events).toEqual([{ event: { kind: "draw", card: 1 } }])
  })

  it("closes a context of two streams, and saves both back", () => {
    const state = start()
    const ctx: Both = openStep<State, Event, "rng" | "idsRng">(state, ["rng", "idsRng"])
    ctx.rng()
    ctx.idsRng()
    const { state: after } = closeBoth(ctx)
    expect(after.rng).not.toBe(state.rng)
    expect(after.idsRng).not.toBe(state.idsRng)
  })

  it("closes a context that is only known by its shape, as one that an alias has lost is", () => {
    // TypeScript keeps what an alias says only while the type comes from the alias: a context that went through a few of them is read by its fields, and `s` and `events` are fields
    const ctx = { s: start(), events: [] as LogEntry<Event>[], rng: createSaveableRng(5) }
    ctx.s.count = 2
    expect(closeStep(ctx).state.count).toBe(2)
  })

  it("is the same function whether it is called, kept as it is or given a type", () => {
    const ctx: Both = openStep<State, Event, "rng" | "idsRng">(start(), ["rng", "idsRng"])
    ctx.rng()
    const step = close(ctx)
    expect(step.state.count).toBe(0)
    expect(restoreRng(step.state.rng)()).not.toBeNaN()
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
