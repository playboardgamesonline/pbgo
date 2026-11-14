import { describe, expect, it } from "vitest"
import { MISSING_CATALOG } from "./catalog"
import { actorsOf, sentenceOf } from "./history"
import { WORD_FIELDS, type Vocabulary } from "./words"

// The history says each event in the game's words: a stand-in vocabulary where every word is its own name keeps the test free of any text that Sanity owns.
const words = Object.fromEntries(WORD_FIELDS.map((field) => [field, `${field}|{card}|{replaced}|{value}|{sum}|{number}`])) as Vocabulary
const context = { words }
const face = (type: string) => ({ id: 1, type })

describe("the sentence of each event", () => {
  it("fills the figures of the cards, never their keys", () => {
    expect(sentenceOf({ kind: "reveal", by: "ana", position: 3, card: face("card-minus-2"), how: "opening" }, context)).toBe("eventReveal|-2|{replaced}|{value}|{sum}|{number}")
    expect(sentenceOf({ kind: "take", by: "ana", card: face("card-12") }, context)).toContain("|12|")
    expect(sentenceOf({ kind: "place", by: "ana", position: 0, card: face("card-3"), replaced: face("card-11"), replacedUp: true }, context)).toBe("eventPlace|3|11|{value}|{sum}|{number}")
  })

  it("tells a card turned over after a throw-away apart from one of the opening", () => {
    expect(sentenceOf({ kind: "reveal", by: "ana", position: 3, card: face("card-1"), how: "flip" }, context).startsWith("eventFlip|")).toBe(true)
    expect(sentenceOf({ kind: "reveal", by: "ana", position: 3, card: face("card-1"), how: "opening" }, context).startsWith("eventReveal|")).toBe(true)
  })

  it("words a draw in full for the player who drew and without the card for the others", () => {
    expect(sentenceOf({ kind: "draw", by: "ana", card: face("card-7") }, context)).toBe("eventDrawSeen|7|{replaced}|{value}|{sum}|{number}")
    expect(sentenceOf({ kind: "draw", by: "ana" }, context).startsWith("eventDraw|")).toBe(true)
  })

  it("says the column, the start, the last turn, the reshuffle, the count and the end", () => {
    expect(sentenceOf({ kind: "column", by: "ana", column: 1, value: 6, cards: [] }, context)).toContain("|6|")
    expect(sentenceOf({ kind: "start", by: "ana", sum: 10 }, context)).toContain("|10|")
    expect(sentenceOf({ kind: "last", by: "ana" }, context).startsWith("eventLast|")).toBe(true)
    expect(sentenceOf({ kind: "reshuffle" }, context).startsWith("eventReshuffle|")).toBe(true)
    expect(sentenceOf({ kind: "end", scores: [1, 2], ender: "ana", doubled: false }, context).startsWith("eventEnd|")).toBe(true)
    expect(sentenceOf({ kind: "end", scores: [1, 2], ender: "ana", doubled: true }, context).startsWith("eventEndDoubled|")).toBe(true)
    expect(sentenceOf({ kind: "over", winners: ["ana"] }, context).startsWith("eventOver|")).toBe(true)
    expect(sentenceOf({ kind: "round", number: 2, dealer: "ana" }, context)).toContain("|2")
  })

  it("reads as a visible marker for a word Sanity does not have, never as an invented text", () => {
    expect(sentenceOf({ kind: "over", winners: [] }, MISSING_CATALOG)).toBe("[missing: eventOver]")
  })
})

describe("who an event is the doing of", () => {
  it("goes to the dealer for a round, to the author for a move, and to the author before for what the table does by itself", () => {
    const actors = actorsOf([
      { kind: "round", number: 1, dealer: "ana" },
      { kind: "start", by: "bob", sum: 9 },
      { kind: "draw", by: "bob" },
      { kind: "place", by: "bob", position: 0, card: face("card-3"), replaced: face("card-4"), replacedUp: false },
      { kind: "reshuffle" },
      { kind: "end", scores: [1, 2], ender: "bob", doubled: false },
    ])
    expect(actors).toEqual(["ana", "bob", "bob", "bob", "bob", "bob"])
  })
})
