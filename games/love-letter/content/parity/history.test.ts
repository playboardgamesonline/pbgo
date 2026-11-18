import type { CharacterKey, LoveLetterEvent } from "@love-letter/engine"
import { CHARACTER_KEYS } from "@love-letter/engine"
import { describe, expect, it } from "vitest"
import { BOARD_WORDS } from "../data/texts.ts"
import { actorsOf, sentenceOf } from "../../src/lib/history.ts"
import type { Vocabulary } from "../../src/lib/words.ts"

/** The words of the board in English, as the seed writes them: what the history reads once the seed is in Sanity */
const words = Object.fromEntries(BOARD_WORDS.map((word) => [word.key, word.en])) as Vocabulary
const names = Object.fromEntries(CHARACTER_KEYS.map((key) => [key, key[0]!.toUpperCase() + key.slice(1)])) as Record<CharacterKey, string>
const nick: Record<string, string> = { a: "Ada", b: "Ben", c: "Cleo" }
const context = { words, names, nickname: (id: string) => nick[id] ?? id }
const say = (event: LoveLetterEvent) => sentenceOf(event, context)
const face = (id: number, type: CharacterKey) => ({ id, type })

describe("the sentences of the history", () => {
  it("say what a player did, without who: the ticker heads each turn with the name", () => {
    expect(say({ kind: "round", number: 2, first: "a", faceUp: [] })).toBe("Deals round 2")
    expect(say({ kind: "play", by: "a", card: face(1, "guard") })).toBe("Plays Guard")
    expect(say({ kind: "guess", by: "a", target: "b", guess: "baron", hit: true })).toBe("Names Baron: Ben holds it")
    expect(say({ kind: "guess", by: "a", target: "b", guess: "baron", hit: false })).toBe("Names Baron: Ben does not")
    expect(say({ kind: "protect", by: "a" })).toBe("Is protected until their next turn")
    expect(say({ kind: "fizzled", by: "a" })).toBe("Plays with no effect")
    expect(say({ kind: "chancellor", by: "a", drew: 2 })).toBe("Draws cards for the Chancellor")
  })

  it("tell a card to the player the log gave it to and leave it out for the others, in the same sentence", () => {
    expect(say({ kind: "draw", by: "a", card: face(3, "king") })).toBe("Draws a card · King")
    expect(say({ kind: "draw", by: "a" })).toBe("Draws a card")
    expect(say({ kind: "look", by: "a", target: "b", card: "princess" })).toBe("Looks at the hand of Ben · Princess")
    expect(say({ kind: "look", by: "a", target: "b" })).toBe("Looks at the hand of Ben")
    expect(say({ kind: "compare", by: "a", target: "b", cards: { by: "priest", target: "king" } })).toBe("Compares hands with Ben · Priest / King")
    expect(say({ kind: "compare", by: "a", target: "b" })).toBe("Compares hands with Ben")
    expect(say({ kind: "swap", by: "a", target: "b", cards: { by: "spy", target: "countess" } })).toBe("Trades hands with Ben · Spy / Countess")
    expect(say({ kind: "swap", by: "a", target: "b" })).toBe("Trades hands with Ben")
    expect(say({ kind: "bottom", by: "a", count: 2, kept: face(4, "prince") })).toBe("Puts the others under the deck · Prince")
    expect(say({ kind: "bottom", by: "a", count: 2 })).toBe("Puts the others under the deck")
  })

  it("never name a card that a masked entry does not carry", () => {
    for (const event of [
      { kind: "draw", by: "a" },
      { kind: "look", by: "a", target: "b" },
      { kind: "compare", by: "a", target: "b" },
      { kind: "swap", by: "a", target: "b" },
      { kind: "bottom", by: "a", count: 1 },
    ] as const) {
      const sentence = say(event)
      for (const name of Object.values(names)) expect(sentence, sentence).not.toContain(name)
    }
  })

  it("tell a discard of the player's own as such, and the three ways out of the round", () => {
    expect(say({ kind: "discard", by: "a", player: "b", card: face(5, "handmaid") })).toBe("Makes Ben discard Handmaid")
    expect(say({ kind: "discard", by: "a", player: "a", card: face(5, "handmaid") })).toBe("Discards Handmaid")
    expect(say({ kind: "out", player: "b", cards: [], cause: "guard" })).toBe("Ben is out: named by the Guard")
    expect(say({ kind: "out", player: "b", cards: [], cause: "baron" })).toBe("Ben is out: the lower card")
    expect(say({ kind: "out", player: "b", cards: [], cause: "princess" })).toBe("Ben is out: the Princess")
  })

  it("end a round and the game with who won, and the Spy's token when there is one", () => {
    expect(say({ kind: "reveal", hands: [] })).toBe("The deck is empty: the hands are shown")
    expect(say({ kind: "end", how: "deck", winners: ["a"], spy: null })).toBe("Round won by Ada")
    expect(say({ kind: "end", how: "deck", winners: ["a", "c"], spy: "b" })).toBe("Round won by Ada, Cleo · Ben earns the Spy’s token")
    expect(say({ kind: "over", winners: ["b"] })).toBe("Game won by Ben")
  })
})

describe("who each event is the doing of", () => {
  it("names the player who took the turn for what they did, and keeps what the table does by itself with the move that set it off", () => {
    const events: LoveLetterEvent[] = [
      { kind: "round", number: 1, first: "a", faceUp: [] },
      { kind: "draw", by: "a", card: face(1, "guard") },
      { kind: "play", by: "a", card: face(1, "guard") },
      { kind: "guess", by: "a", target: "b", guess: "baron", hit: true },
      { kind: "out", player: "b", cards: [], cause: "guard" },
      { kind: "end", how: "last", winners: ["a"], spy: null },
      { kind: "over", winners: ["a"] },
    ]
    expect(actorsOf(events)).toEqual(["a", "a", "a", "a", "a", "a", "a"])
    expect(actorsOf([{ kind: "draw", by: "b" }, { kind: "reveal", hands: [] }, { kind: "round", number: 2, first: "c", faceUp: [] }])).toEqual(["b", "b", "c"])
  })

  it("has no author for events before anyone has acted", () => {
    expect(actorsOf([{ kind: "reveal", hands: [] }])).toEqual([null])
  })
})
