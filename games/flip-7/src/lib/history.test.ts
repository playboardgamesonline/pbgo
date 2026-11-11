import type { Face, Flip7Event } from "@flip-7/engine"
import { describe, expect, it } from "vitest"
import { MISSING_CATALOG } from "./catalog"
import { actorsOf, type HistoryContext, sentenceOf } from "./history"

// The history of the ticker: what each event says, in the words of the catalog (Sanity's: here the English of the seed, written out), and who each is the doing of.
const words: HistoryContext["words"] = {
  ...MISSING_CATALOG.words,
  eventRound: "deals round {number}",
  eventDeal: "is dealt {card}",
  eventHit: "hits and turns over {card}",
  eventFlip: "flips {card}",
  eventStay: "stays and banks {points}",
  eventBust: "busts on {card}",
  eventSaved: "cancels {card} with a Second Chance",
  eventPlay: "gives {card} to {target}",
  eventKeep: "keeps {card}",
  eventDiscarded: "discards {card}",
  eventReshuffle: "shuffles the discard into a new deck",
  eventFlip7: "makes a Flip 7!",
  eventEnd: "ends the round",
  eventOver: "ends the game",
}
const context: HistoryContext = {
  words,
  names: { ...MISSING_CATALOG.names, freeze: "Freeze", "second-chance": "Second Chance" },
  nickname: (id) => ({ a: "Alex", s: "Sam" })[id] ?? "?",
}
const face = (type: string, id = 1): Face => ({ id, type })
const say = (event: Flip7Event) => sentenceOf(event, context)

describe("the sentence of an event", () => {
  it("says what a player did, with the card as it is written on it", () => {
    expect(say({ kind: "round", number: 3, dealer: "a" })).toBe("deals round 3")
    expect(say({ kind: "draw", by: "a", card: face("number-7"), how: "deal" })).toBe("is dealt 7")
    expect(say({ kind: "draw", by: "a", card: face("plus-4"), how: "hit" })).toBe("hits and turns over +4")
    expect(say({ kind: "draw", by: "a", card: face("times-2"), how: "flip" })).toBe("flips x2")
    expect(say({ kind: "stay", by: "a", points: 21 })).toBe("stays and banks 21")
    expect(say({ kind: "bust", by: "a", card: face("number-12") })).toBe("busts on 12")
    expect(say({ kind: "discarded", by: "a", card: face("freeze") })).toBe("discards Freeze")
  })

  it("names the action card by its name in the language asked", () => {
    expect(say({ kind: "saved", by: "a", card: face("number-5"), secondChance: face("second-chance", 2) })).toBe("cancels 5 with a Second Chance")
    expect(say({ kind: "draw", by: "a", card: face("flip-three"), how: "hit" })).toBe(`hits and turns over ${MISSING_CATALOG.names["flip-three"]}`)
  })

  it("gives an action card to its target, by their nickname, and keeps a Second Chance for its holder", () => {
    expect(say({ kind: "play", by: "a", target: "s", card: face("freeze") })).toBe("gives Freeze to Sam")
    expect(say({ kind: "play", by: "a", target: "a", card: face("second-chance") })).toBe("keeps Second Chance")
    // a Freeze played on oneself is still given: to oneself
    expect(say({ kind: "play", by: "a", target: "a", card: face("freeze") })).toBe("gives Freeze to Alex")
  })

  it("says what the table did and the end of a round or of the game, in a few words", () => {
    expect(say({ kind: "reshuffle" })).toBe("shuffles the discard into a new deck")
    expect(say({ kind: "flip7", by: "a" })).toBe("makes a Flip 7!")
    expect(say({ kind: "end", scores: [10, 0, 5] })).toBe("ends the round")
    expect(say({ kind: "over", winners: ["a"] })).toBe("ends the game")
  })

  it("reads [missing: <word>] when Sanity has no word for it, instead of hiding the gap", () => {
    const bare: HistoryContext = { ...context, words: MISSING_CATALOG.words }
    expect(sentenceOf({ kind: "stay", by: "a", points: 3 }, bare)).toBe("[missing: eventStay]")
    expect(sentenceOf({ kind: "end", scores: [] }, bare)).toBe("[missing: eventEnd]")
  })
})

describe("who an event is the doing of", () => {
  it("is the dealer for a round, and who made it for the others", () => {
    const events: Flip7Event[] = [
      { kind: "round", number: 1, dealer: "a" },
      { kind: "draw", by: "s", card: face("number-3"), how: "deal" },
      { kind: "draw", by: "a", card: face("number-4"), how: "deal" },
      { kind: "stay", by: "s", points: 3 },
    ]
    expect(actorsOf(events)).toEqual(["a", "s", "a", "s"])
  })

  it("goes to the player whose move set it off for what the table does by itself", () => {
    const events: Flip7Event[] = [
      { kind: "draw", by: "s", card: face("number-3"), how: "hit" },
      { kind: "reshuffle" },
      { kind: "stay", by: "a", points: 9 },
      { kind: "end", scores: [9, 3] },
      { kind: "over", winners: ["a"] },
    ]
    expect(actorsOf(events)).toEqual(["s", "s", "a", "a", "a"])
  })

  it("is nobody for an event no player set off, when there is no event before it", () => {
    expect(actorsOf([{ kind: "reshuffle" }])).toEqual([null])
    expect(actorsOf([])).toEqual([])
  })
})
