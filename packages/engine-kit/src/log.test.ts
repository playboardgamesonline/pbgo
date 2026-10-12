import { describe, expect, it } from "vitest"
import { viewLog, type LogEntry } from "./log"

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
