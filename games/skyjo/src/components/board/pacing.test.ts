import type { SkyjoEvent } from "@skyjo/engine"
import { describe, expect, it } from "vitest"
import { HELD_KEY, PACE_SETTINGS, cardKey, cellKey, timelineOf } from "./pacing"

const line = (v: number, event: SkyjoEvent) => ({ v, event })
const face = (id: number, type = "card-5") => ({ id, type })
const players = ["ana", "bob", "cleo"]

describe("the timeline of the last move", () => {
  it("is empty for an empty log, and for a visitor who asks for less motion", () => {
    expect(timelineOf([], players).settle).toBe(0)
    const moves = [line(3, { kind: "draw", by: "ana" })]
    const instant = timelineOf(moves, players, true)
    expect(instant.entrances.size).toBe(0)
    expect(instant.settle).toBe(0)
    expect(instant.v).toBe(3)
  })

  it("only plays the last version of the log: an earlier move is already on the table", () => {
    const t = timelineOf([line(1, { kind: "draw", by: "ana" }), line(2, { kind: "take", by: "bob", card: face(7) })], players)
    expect(t.v).toBe(2)
    expect([...t.entrances.keys()]).toEqual([HELD_KEY])
    expect(t.entrances.get(HELD_KEY)?.origin).toEqual({ kind: "discard" })
  })

  it("deals every cell of every grid from the draw pile, one after the other, in no more than `dealTotal`", () => {
    const t = timelineOf([line(1, { kind: "round", number: 1, dealer: "ana" })], players)
    expect(t.entrances.size).toBe(36)
    const delays = [...t.entrances.values()].map((entrance) => entrance.delay)
    expect(Math.min(...delays)).toBe(0)
    expect(Math.max(...delays)).toBeLessThanOrEqual(PACE_SETTINGS.dealTotal)
    expect([...t.entrances.values()].every((entrance) => entrance.origin.kind === "deck")).toBe(true)
    expect(new Set(delays).size).toBe(36)
    expect(t.settle).toBeGreaterThanOrEqual(Math.max(...delays) + PACE_SETTINGS.landing)
    // a table of eight is dealt 96 cards in the same time
    const eight = timelineOf([line(1, { kind: "round", number: 1, dealer: "ana" })], Array.from({ length: 8 }, (_, i) => `p${i}`))
    expect(eight.entrances.size).toBe(96)
    expect(Math.max(...[...eight.entrances.values()].map((entrance) => entrance.delay))).toBeLessThanOrEqual(PACE_SETTINGS.dealTotal)
  })

  it("sends the card in hand into the cell and the card it replaces to the discard, at the same moment, after the draw", () => {
    const t = timelineOf(
      [
        line(5, { kind: "draw", by: "ana", card: face(1) }),
        line(5, { kind: "place", by: "ana", position: 4, card: face(1), replaced: face(2), replacedUp: false }),
      ],
      players,
    )
    expect(t.entrances.get(HELD_KEY)).toEqual({ origin: { kind: "deck" }, delay: 0 })
    const into = t.entrances.get(cellKey("ana", 4))
    const out = t.entrances.get(cardKey(2))
    expect(into).toEqual({ origin: { kind: "held" }, delay: PACE_SETTINGS.draw })
    expect(out).toEqual({ origin: { kind: "cell", player: "ana", position: 4, up: false }, delay: PACE_SETTINGS.draw })
  })

  it("turns a card over where it lies: it comes in from its own cell, face down", () => {
    const t = timelineOf([line(4, { kind: "reveal", by: "bob", position: 5, card: face(8), how: "flip" })], players)
    expect(t.entrances.get(cellKey("bob", 5))).toEqual({ origin: { kind: "cell", player: "bob", position: 5, up: false }, delay: 0 })
  })

  it("sends a thrown card from the hand to the discard", () => {
    const t = timelineOf([line(2, { kind: "discard", by: "bob", card: face(9) })], players)
    expect(t.entrances.get(cardKey(9))).toEqual({ origin: { kind: "held" }, delay: 0 })
  })

  it("plays a thrown column as one motion that begins when the move before it in the turn has landed, and has no entrance for its cards", () => {
    const cards = [face(1, "card-6"), face(2, "card-6"), face(3, "card-6")]
    const t = timelineOf(
      [
        line(8, { kind: "place", by: "cleo", position: 7, card: face(3, "card-6"), replaced: face(4), replacedUp: true }),
        line(8, { kind: "column", by: "cleo", column: 1, value: 6, cards }),
      ],
      players,
    )
    expect(t.removals).toHaveLength(1)
    const [removal] = t.removals
    expect(removal).toMatchObject({ player: "cleo", column: 1, cards, at: PACE_SETTINGS.place })
    // the cards are not flown by their entrances: the stack is, from the film of the column
    for (const card of cards) expect(t.entrances.has(cardKey(card.id))).toBe(false)
    // the card the placement put on the discard is the one the stack lands on, and flies there from its cell
    expect(t.replaced).toEqual(face(4))
    expect(t.entrances.get(cardKey(4))).toEqual({ origin: { kind: "cell", player: "cleo", position: 7, up: true }, delay: 0 })
    // the move lasts as long as the column does
    expect(t.settle).toBeCloseTo(PACE_SETTINGS.place + removal!.timing.total)
  })

  it("has no card put on the discard for a column that a turned card made", () => {
    const t = timelineOf([line(6, { kind: "reveal", by: "ana", position: 4, card: face(5, "card-6"), how: "flip" }), line(6, { kind: "column", by: "ana", column: 1, value: 6, cards: [face(3, "card-6"), face(4, "card-6"), face(5, "card-6")] })], players)
    expect(t.removals).toHaveLength(1)
    expect(t.replaced).toBeNull()
  })

  it("plays the columns of a round that is counted one after the other, in the order the engine threw them away, each faster as there are more", () => {
    const column = (by: string, column: number, base: number): SkyjoEvent => ({ kind: "column", by, column, value: 4, cards: [face(base, "card-4"), face(base + 1, "card-4"), face(base + 2, "card-4")] })
    const end: SkyjoEvent = { kind: "end", scores: [0, 1, 2], ender: "ana", doubled: false }
    const one = timelineOf([line(9, column("ana", 0, 10)), line(9, end)], players)
    const four = timelineOf([line(9, column("ana", 0, 10)), line(9, column("bob", 2, 20)), line(9, column("bob", 3, 30)), line(9, column("cleo", 1, 40)), line(9, end)], players)
    expect(four.removals.map(({ player, column }) => [player, column])).toEqual([["ana", 0], ["bob", 2], ["bob", 3], ["cleo", 1]])
    // one after the other: each begins when the one before it is over
    const [a, b, c, d] = four.removals
    expect(a!.at).toBe(0)
    expect(b!.at).toBeCloseTo(a!.at + a!.timing.total)
    expect(c!.at).toBeCloseTo(b!.at + b!.timing.total)
    expect(d!.at).toBeCloseTo(c!.at + c!.timing.total)
    // a few columns take their time, many share what a move may take: each is played faster than one alone
    expect(one.removals[0]!.timing.total).toBeGreaterThan(1)
    expect(a!.timing.total).toBeLessThan(one.removals[0]!.timing.total)
    expect(a!.timing.total * 4).toBeLessThanOrEqual(PACE_SETTINGS.columns + 1e-9)
    // and a count that throws away nothing waits only for its own beat
    expect(timelineOf([line(9, { kind: "end", scores: [0, 1, 2], ender: "ana", doubled: false })], players).removals).toEqual([])
  })

  it("gives every event of the game a beat, so that a move that says nothing new still takes its time", () => {
    const events: SkyjoEvent[] = [
      { kind: "reveal", by: "ana", position: 0, card: face(1), how: "opening" },
      { kind: "start", by: "ana", sum: 4, how: "sum" },
      { kind: "start", by: "ana", sum: 4, how: "ender" },
      { kind: "last", by: "ana" },
      { kind: "reshuffle" },
      { kind: "end", scores: [1, 2, 3], ender: "ana", doubled: false },
      { kind: "over", winners: ["ana"] },
    ]
    for (const event of events) expect(timelineOf([line(1, event)], players).settle, event.kind).toBeGreaterThan(0)
  })
})
