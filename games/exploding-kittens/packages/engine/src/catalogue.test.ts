import { describe, expect, it } from "vitest"
import { CARDS, DECKS, buildCatalogue } from "./catalogue"
import { EFFECTS } from "./effects"
import { ORIGINAL_RULES } from "./rules"
import { newState, typesOf } from "./test-utils"

/** The keys of the card types that the studio seeds (CONTENT): the engine and the studio must say the same words. */
const STUDIO_KEYS = [
  "exploding-kitten",
  "defuse",
  "attack",
  "skip",
  "favor",
  "shuffle",
  "see-the-future",
  "nope",
  "tacocat",
  "cattermelon",
  "hairy-potato-cat",
  "beard-cat",
  "rainbow-ralphing-cat",
]

function count(types: readonly string[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const type of types) counts[type] = (counts[type] ?? 0) + 1
  return counts
}

describe("CARDS", () => {
  it("uses the keys of the card types of the studio, in their order", () => {
    expect(Object.keys(CARDS)).toEqual(STUDIO_KEYS)
  })

  it("gives every action card an effect, and only action cards", () => {
    for (const [key, card] of Object.entries<{ kind: string; effect?: string }>(CARDS)) {
      if (card.kind === "action") expect(card.effect, key).toBeTypeOf("string")
      else expect(card.effect, key).toBeUndefined()
    }
  })

  it("has an effect in EFFECTS for every effect it names, and no effect that no card names", () => {
    const named = Object.values<{ kind: string; effect?: string }>(CARDS).flatMap((card) => (card.effect === undefined ? [] : [card.effect]))
    expect([...named].sort()).toEqual(Object.keys(EFFECTS).sort())
  })

  it("lists the kinds of the Original Edition", () => {
    const kinds = Object.fromEntries(Object.entries<{ kind: string }>(CARDS).map(([key, card]) => [key, card.kind]))
    expect(kinds).toEqual({
      "exploding-kitten": "kitten",
      defuse: "defuse",
      attack: "action",
      skip: "action",
      favor: "action",
      shuffle: "action",
      "see-the-future": "action",
      nope: "nope",
      tacocat: "cat",
      cattermelon: "cat",
      "hairy-potato-cat": "cat",
      "beard-cat": "cat",
      "rainbow-ralphing-cat": "cat",
    })
  })
})

describe("DECKS.original", () => {
  const types = buildCatalogue(ORIGINAL_RULES, {})

  it("is the 56 cards of the box", () => {
    expect(types).toHaveLength(56)
    expect(count(types)).toEqual({
      "exploding-kitten": 4,
      defuse: 6,
      attack: 4,
      skip: 4,
      favor: 4,
      shuffle: 4,
      "see-the-future": 5,
      nope: 5,
      tacocat: 4,
      cattermelon: 4,
      "hairy-potato-cat": 4,
      "beard-cat": 4,
      "rainbow-ralphing-cat": 4,
    })
  })

  it("holds 20 cats, five kinds of four", () => {
    const cats = types.filter((type) => ORIGINAL_RULES.cards[type]?.kind === "cat")
    expect(cats).toHaveLength(20)
    expect(new Set(cats).size).toBe(5)
  })

  it("only holds cards that exist", () => {
    for (const { type } of DECKS.original) expect(Object.keys(CARDS)).toContain(type)
  })

  it("keeps a card at the index of its entry (a card is its index)", () => {
    expect(types.indexOf("exploding-kitten")).toBe(0)
    expect(types.indexOf("defuse")).toBe(4)
    expect(types.lastIndexOf("rainbow-ralphing-cat")).toBe(55)
  })

  it("is the catalogue of a table", () => {
    expect(typesOf(newState(3))).toEqual(types)
  })
})

describe("buildCatalogue", () => {
  const rules = {
    cards: { a: { kind: "cat" }, b: { kind: "cat" } },
    decks: { one: [{ type: "a", copies: 2 }], two: [{ type: "b", copies: 1 }, { type: "a", copies: 1 }] },
    selectDecks: () => ["one", "two"],
  } as const

  it("puts the selected decks one after the other, each entry as many times as it has copies", () => {
    expect(buildCatalogue(rules, {})).toEqual(["a", "a", "b", "a"])
  })

  it("reads the options to select the decks", () => {
    const optional = { ...rules, selectDecks: (options: Record<string, unknown>) => (options.second === true ? ["one", "two"] : ["one"]) }
    expect(buildCatalogue(optional, {})).toEqual(["a", "a"])
    expect(buildCatalogue(optional, { second: true })).toEqual(["a", "a", "b", "a"])
  })

  it("gives the same catalogue every time", () => {
    expect(buildCatalogue(rules, {})).toEqual(buildCatalogue(rules, {}))
  })

  it("refuses a deck that does not exist", () => {
    expect(() => buildCatalogue({ ...rules, selectDecks: () => ["three"] }, {})).toThrow(RangeError)
  })

  it("refuses a deck that holds a card that does not exist", () => {
    expect(() => buildCatalogue({ ...rules, decks: { one: [{ type: "c", copies: 1 }] }, selectDecks: () => ["one"] }, {})).toThrow(/does not exist/)
  })

  it("refuses a number of copies that is not a whole number or is negative", () => {
    for (const copies of [-1, 1.5, Number.NaN]) {
      expect(() => buildCatalogue({ ...rules, decks: { one: [{ type: "a", copies }] }, selectDecks: () => ["one"] }, {}), String(copies)).toThrow(RangeError)
    }
  })

  it("lets a deck hold no copy of a card", () => {
    expect(buildCatalogue({ ...rules, decks: { one: [{ type: "a", copies: 0 }] }, selectDecks: () => ["one"] }, {})).toEqual([])
  })
})
