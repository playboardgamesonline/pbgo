import type { CharacterKey, Face, LoveLetterEvent } from "@love-letter/engine"
import type { LogLine } from "@pbgo/core/lib/game-types"
import { describe, expect, it } from "vitest"
import { PACE_SETTINGS, timelineOf } from "./pacing"

const face = (id: number, type: CharacterKey): Face => ({ id, type })
const lines = (v: number, ...events: LoveLetterEvent[]): LogLine<LoveLetterEvent>[] => events.map((event) => ({ v, event }) as LogLine<LoveLetterEvent>)

describe("the pace of a move", () => {
  it("is nothing for an empty log, and nothing when the visitor asks for less motion", () => {
    expect(timelineOf([])).toMatchObject({ v: 0, settle: 0 })
    const move = lines(3, { kind: "play", by: "a", card: face(1, "guard") })
    expect(timelineOf(move, true)).toMatchObject({ v: 3, settle: 0 })
    expect(timelineOf(move, true).entrances.size).toBe(0)
    expect(timelineOf(move, true).reveals).toHaveLength(0)
  })

  it("reads only the last move: the lines of the greatest version", () => {
    const log = [...lines(2, { kind: "play", by: "a", card: face(1, "guard") }), ...lines(3, { kind: "play", by: "b", card: face(2, "spy") })]
    const timeline = timelineOf(log)
    expect(timeline.v).toBe(3)
    expect([...timeline.entrances.keys()]).toEqual([2])
  })

  it("brings each card in from where it came: a card drawn from the deck, a card played, discarded or laid down out of the round from the hand of its player", () => {
    const timeline = timelineOf(
      lines(
        5,
        { kind: "draw", by: "a", card: face(10, "king") },
        { kind: "play", by: "a", card: face(11, "prince") },
        { kind: "discard", by: "a", player: "b", card: face(12, "princess") },
        { kind: "out", player: "b", cards: [face(13, "spy")], cause: "princess" },
      ),
    )
    expect(timeline.entrances.get(10)).toMatchObject({ from: "deck", by: "a" })
    expect(timeline.entrances.get(11)).toMatchObject({ from: "hand", by: "a" })
    expect(timeline.entrances.get(12)).toMatchObject({ from: "hand", by: "b" })
    expect(timeline.entrances.get(13)).toMatchObject({ from: "hand", by: "b" })
  })

  it("brings the cards in one after the other, in the order the engine said, each after the time of what came before", () => {
    const timeline = timelineOf(lines(5, { kind: "draw", by: "a", card: face(10, "king") }, { kind: "play", by: "a", card: face(11, "prince") }, { kind: "discard", by: "a", player: "b", card: face(12, "princess") }))
    const delays = [10, 11, 12].map((id) => timeline.entrances.get(id)!.delay)
    expect(delays[0]).toBe(0)
    expect(delays[1]).toBeCloseTo(PACE_SETTINGS.draw)
    expect(delays[2]).toBeCloseTo(PACE_SETTINGS.draw + PACE_SETTINGS.play)
  })

  it("has no card to bring in for a card the viewer was not told: a card drawn by another player is a back, which has no id to come in under", () => {
    const timeline = timelineOf(lines(5, { kind: "draw", by: "b" }))
    expect(timeline.entrances.size).toBe(0)
    expect(timeline.settle).toBeGreaterThanOrEqual(PACE_SETTINGS.landing)
  })

  it("is over when the last thing has had its time, or the last card has landed, whichever is later", () => {
    const quick = timelineOf(lines(5, { kind: "play", by: "a", card: face(11, "spy") }))
    expect(quick.settle).toBeCloseTo(Math.max(PACE_SETTINGS.play, PACE_SETTINGS.landing))
    const long = timelineOf(lines(5, { kind: "play", by: "a", card: face(11, "priest") }, { kind: "look", by: "a", target: "b", card: "king" }))
    expect(long.settle).toBeCloseTo(PACE_SETTINGS.play + PACE_SETTINGS.look)
  })
})

describe("what a move shows to be read", () => {
  it("shows a Guard's guess to everybody: the character it named", () => {
    const [reveal] = timelineOf(lines(5, { kind: "play", by: "a", card: face(1, "guard") }, { kind: "guess", by: "a", target: "b", guess: "baron", hit: false })).reveals
    expect(reveal).toMatchObject({ kind: "guess", cards: ["baron"] })
    expect(reveal!.at).toBeCloseTo(PACE_SETTINGS.play)
  })

  it("shows a Priest's look in full to the player it was told to, and as a back to the others", () => {
    expect(timelineOf(lines(5, { kind: "look", by: "a", target: "b", card: "king" })).reveals[0]).toMatchObject({ kind: "look", cards: ["king"], owners: ["b"] })
    expect(timelineOf(lines(5, { kind: "look", by: "a", target: "b" })).reveals[0]).toMatchObject({ kind: "look", cards: [null], owners: ["b"] })
  })

  it("shows a Baron's comparison and a King's trade as two cards, the player's then the target's, as backs when the entry is masked", () => {
    expect(timelineOf(lines(5, { kind: "compare", by: "a", target: "b", cards: { by: "priest", target: "king" } })).reveals[0]).toMatchObject({ kind: "compare", cards: ["priest", "king"], owners: ["a", "b"] })
    expect(timelineOf(lines(5, { kind: "compare", by: "a", target: "b" })).reveals[0]).toMatchObject({ cards: [null, null] })
    expect(timelineOf(lines(5, { kind: "swap", by: "a", target: "b", cards: { by: "spy", target: "countess" } })).reveals[0]).toMatchObject({ kind: "swap", cards: ["spy", "countess"], owners: ["a", "b"] })
    expect(timelineOf(lines(5, { kind: "swap", by: "a", target: "b" })).reveals[0]).toMatchObject({ cards: [null, null] })
  })

  it("keeps a reveal on the table for long enough to read, and longer for two cards than for one", () => {
    const P = PACE_SETTINGS
    expect(P.look).toBeGreaterThanOrEqual(2)
    expect(P.compare).toBeGreaterThanOrEqual(P.look)
    expect(P.swap).toBeGreaterThanOrEqual(P.look)
  })
})
