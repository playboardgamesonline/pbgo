import type { SkyjoEvent } from "@skyjo/engine"
import { describe, expect, it } from "vitest"
import { MISSING_CATALOG } from "./catalog"
import { actorsOf, type HistoryContext, sentenceOf } from "./history"
import { WORD_FIELDS, type Vocabulary } from "./words"

// The history says each event in the game's words: a stand-in vocabulary where every word is its own name keeps the test free of any text that Sanity owns.
const words = Object.fromEntries(WORD_FIELDS.map((field) => [field, `${field}|{card}|{replaced}|{value}|{sum}|{number}`])) as Vocabulary
const context = { words }
const face = (type: string) => ({ id: 1, type })
/** The line of an event that has one: a test that expects a sentence fails here when the event has none */
function say(event: SkyjoEvent, at: HistoryContext): string {
  const line = sentenceOf(event, at)
  if (line === null) throw new Error(`${event.kind} has no line`)
  return line
}

describe("the sentence of each event", () => {
  it("fills the figures of the cards, never their keys", () => {
    expect(say({ kind: "reveal", by: "ana", position: 3, card: face("card-minus-2"), how: "opening" }, context)).toBe("eventReveal|-2|{replaced}|{value}|{sum}|{number}")
    expect(say({ kind: "take", by: "ana", card: face("card-12") }, context)).toContain("|12|")
    expect(say({ kind: "place", by: "ana", position: 0, card: face("card-3"), replaced: face("card-11"), replacedUp: true }, context)).toBe("eventPlace|3|11|{value}|{sum}|{number}")
  })

  it("tells a card turned over after a throw-away apart from one of the opening", () => {
    expect(say({ kind: "reveal", by: "ana", position: 3, card: face("card-1"), how: "flip" }, context).startsWith("eventFlip|")).toBe(true)
    expect(say({ kind: "reveal", by: "ana", position: 3, card: face("card-1"), how: "opening" }, context).startsWith("eventReveal|")).toBe(true)
  })

  it("words a draw in full for the player who drew and without the card for the others", () => {
    expect(say({ kind: "draw", by: "ana", card: face("card-7") }, context)).toBe("eventDrawSeen|7|{replaced}|{value}|{sum}|{number}")
    expect(say({ kind: "draw", by: "ana" }, context).startsWith("eventDraw|")).toBe(true)
  })

  it("says the column, the start, the last turn, the reshuffle, the count and the end", () => {
    expect(say({ kind: "column", by: "ana", column: 1, value: 6, cards: [] }, context)).toContain("|6|")
    expect(say({ kind: "start", by: "ana", sum: 10, how: "sum" }, context)).toContain("|10|")
    expect(say({ kind: "last", by: "ana" }, context).startsWith("eventLast|")).toBe(true)
    expect(say({ kind: "reshuffle" }, context).startsWith("eventReshuffle|")).toBe(true)
    expect(say({ kind: "end", scores: [1, 2], ender: "ana", doubled: false }, context).startsWith("eventEnd|")).toBe(true)
    expect(say({ kind: "end", scores: [1, 2], ender: "ana", doubled: true }, context).startsWith("eventEndDoubled|")).toBe(true)
    expect(say({ kind: "over", winners: ["ana"] }, context).startsWith("eventOver|")).toBe(true)
    expect(say({ kind: "round", number: 2, dealer: "ana" }, context)).toContain("|2")
  })

  it("gives the sum that began the first round, and says nothing of a later round that its previous ender begins whatever the sums", () => {
    expect(say({ kind: "start", by: "ana", sum: 10, how: "sum" }, context)).toBe("eventStart|{card}|{replaced}|{value}|10|{number}")
    expect(sentenceOf({ kind: "start", by: "bob", sum: 3, how: "ender" }, context)).toBeNull()
  })

  it("reads as a visible marker for a word Sanity does not have, never as an invented text", () => {
    expect(say({ kind: "over", winners: [] }, MISSING_CATALOG)).toBe("[missing: eventOver]")
  })
})

describe("who an event is the doing of", () => {
  it("goes to the dealer for a round, to the author for a move, and to the author before for the count of a round", () => {
    const actors = actorsOf([
      { kind: "round", number: 1, dealer: "ana" },
      { kind: "start", by: "bob", sum: 9, how: "sum" },
      { kind: "draw", by: "bob" },
      { kind: "place", by: "bob", position: 0, card: face("card-3"), replaced: face("card-4"), replacedUp: false },
      { kind: "end", scores: [1, 2], ender: "bob", doubled: false },
      { kind: "over", winners: ["ana"] },
    ])
    expect(actors).toEqual(["ana", "bob", "bob", "bob", "bob", "bob"])
  })

  it("goes to the player who draws for the discard shuffled into a new pile: the line comes right before their draw, in the same move", () => {
    const actors = actorsOf([
      { kind: "draw", by: "bob" },
      { kind: "place", by: "bob", position: 0, card: face("card-3"), replaced: face("card-4"), replacedUp: false },
      { kind: "reshuffle" },
      { kind: "draw", by: "cleo" },
    ])
    expect(actors).toEqual(["bob", "bob", "cleo", "cleo"])
  })
})
