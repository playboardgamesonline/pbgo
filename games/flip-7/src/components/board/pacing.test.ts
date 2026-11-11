import type { Flip7Event } from "@flip-7/engine"
import type { LogLine } from "@pbgo/core/lib/game-types"
import { describe, expect, it } from "vitest"
import { PACE_FIELDS, PACE_SETTINGS as P, timelineOf } from "./pacing"

const face = (id: number, type = "number-7") => ({ id, type })
/** The lines of one move: they share their version */
const move = (v: number, ...events: Flip7Event[]): LogLine<Flip7Event>[] => events.map((event) => ({ v, event }))

describe("the timeline of a move", () => {
  it("is empty for an empty log: nothing waits and there is nothing to wait for", () => {
    expect(timelineOf([])).toEqual({ v: 0, entrances: new Map(), settle: 0 })
  })

  it("sends a card turned over by a hit at once, and the move is over when it has landed", () => {
    const t = timelineOf(move(4, { kind: "draw", by: "a", card: face(10), how: "hit" }))
    expect(t.v).toBe(4)
    expect(t.entrances.get(10)).toBe(0)
    expect(t.settle).toBe(Math.max(P.hit, P.landing))
  })

  it("sends the three cards of a Flip Three one after the other, once the card that made them has arrived", () => {
    const t = timelineOf(
      move(
        7,
        { kind: "play", by: "a", target: "b", card: face(1, "flip-three") },
        { kind: "draw", by: "b", card: face(2), how: "flip" },
        { kind: "draw", by: "b", card: face(3, "number-4"), how: "flip" },
        { kind: "draw", by: "b", card: face(4, "plus-2"), how: "flip" },
      ),
    )
    // the Flip Three itself is already on the table: it flies by its own, from where it lay, and has no entrance
    expect(t.entrances.has(1)).toBe(false)
    expect(t.entrances.get(2)).toBeCloseTo(P.play)
    expect(t.entrances.get(3)).toBeCloseTo(P.play + P.flip)
    expect(t.entrances.get(4)).toBeCloseTo(P.play + 2 * P.flip)
    // over when the third card has landed
    expect(t.settle).toBeGreaterThanOrEqual(P.play + 2 * P.flip + P.landing - 1e-9)
  })

  it("deals the opening cards round the table, a deal apart, in the order the engine dealt them", () => {
    const t = timelineOf(
      move(
        1,
        { kind: "round", number: 1, dealer: "c" },
        { kind: "draw", by: "a", card: face(20), how: "deal" },
        { kind: "draw", by: "b", card: face(21), how: "deal" },
        { kind: "draw", by: "c", card: face(22), how: "deal" },
      ),
    )
    expect(t.entrances.get(20)).toBeCloseTo(P.round)
    expect(t.entrances.get(21)).toBeCloseTo(P.round + P.deal)
    expect(t.entrances.get(22)).toBeCloseTo(P.round + 2 * P.deal)
  })

  it("gives a move that turned no card the time of what it did", () => {
    expect(timelineOf(move(3, { kind: "stay", by: "a", points: 12 })).settle).toBe(P.stay)
    const bust = timelineOf(move(3, { kind: "draw", by: "a", card: face(5), how: "hit" }, { kind: "bust", by: "a", card: face(5) }))
    expect(bust.entrances.get(5)).toBe(0)
    expect(bust.settle).toBeCloseTo(Math.max(P.hit + P.bust, P.landing))
  })

  it("reads the last move only: the lines of the versions before it are the table's past", () => {
    const t = timelineOf([...move(2, { kind: "draw", by: "a", card: face(30), how: "hit" }), ...move(3, { kind: "draw", by: "b", card: face(31), how: "hit" })])
    expect(t.v).toBe(3)
    expect([...t.entrances.keys()]).toEqual([31])
  })

  it("has nothing wait and nothing to wait for when the visitor asks for less motion", () => {
    const t = timelineOf(move(6, { kind: "draw", by: "a", card: face(40), how: "hit" }), true)
    expect(t).toEqual({ v: 6, entrances: new Map(), settle: 0 })
  })
})

describe("the pace", () => {
  it("has a field in the debug panel for every setting, and none for anything else", () => {
    expect(Object.keys(PACE_FIELDS).sort()).toEqual(Object.keys(P).sort())
  })
})
