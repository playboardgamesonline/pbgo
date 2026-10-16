import { describe, expect, it } from "vitest"
import { CARDS, CATALOGUE, DECK, cardType } from "./catalogue"

// The box, as the booklet lists it (pages 2 and 3): 94 cards, 79 numbers, 6 score modifiers, 9 action cards.

const copiesOf = (face: string) => CATALOGUE.filter((candidate) => candidate === face).length

describe("the box", () => {
  it("holds the 94 cards of the booklet", () => {
    expect(CATALOGUE).toHaveLength(94)
    expect(DECK.reduce((total, { copies }) => total + copies, 0)).toBe(94)
  })

  it("holds 79 number cards: twelve 12s, eleven 11s … one 1, and a single 0", () => {
    const numbers = CATALOGUE.filter((face) => cardType(face).kind === "number")
    expect(numbers).toHaveLength(79)
    for (let value = 1; value <= 12; value++) expect(copiesOf(`number-${value}`), `number-${value}`).toBe(value)
    expect(copiesOf("number-0")).toBe(1)
  })

  it("holds each of the six score modifiers once: +2, +4, +6, +8, +10 and x2", () => {
    const modifiers = CATALOGUE.filter((face) => cardType(face).kind === "modifier")
    expect([...modifiers].sort()).toEqual(["plus-10", "plus-2", "plus-4", "plus-6", "plus-8", "times-2"])
    expect(cardType("plus-6")).toEqual({ kind: "modifier", plus: 6, times: 1 })
    expect(cardType("times-2")).toEqual({ kind: "modifier", plus: 0, times: 2 })
  })

  it("holds three of each action card: Freeze, Flip Three and Second Chance", () => {
    expect(CATALOGUE.filter((face) => cardType(face).kind === "action")).toHaveLength(9)
    expect(cardType("freeze")).toEqual({ kind: "action", effect: "freeze" })
    expect(cardType("flip-three")).toEqual({ kind: "action", effect: "flip-three" })
    expect(cardType("second-chance")).toEqual({ kind: "action", effect: "second-chance" })
    for (const face of ["freeze", "flip-three", "second-chance"]) expect(copiesOf(face), face).toBe(3)
  })

  it("gives every number card the value its key says", () => {
    for (const [face, card] of Object.entries(CARDS)) if (card.kind === "number") expect(face).toBe(`number-${card.value}`)
  })

  it("lists every face once, in the order of the studio's card types, and every face is in the deck", () => {
    expect(Object.keys(CARDS)).toEqual([
      "number-0",
      "number-1",
      "number-2",
      "number-3",
      "number-4",
      "number-5",
      "number-6",
      "number-7",
      "number-8",
      "number-9",
      "number-10",
      "number-11",
      "number-12",
      "plus-2",
      "plus-4",
      "plus-6",
      "plus-8",
      "plus-10",
      "times-2",
      "freeze",
      "flip-three",
      "second-chance",
    ])
    expect(DECK.map(({ type }) => type)).toEqual(Object.keys(CARDS))
  })

  it("builds the catalogue from the deck, each face as many times as it has copies, in the order of the deck", () => {
    expect(CATALOGUE.slice(0, 4)).toEqual(["number-0", "number-1", "number-2", "number-2"])
    expect(CATALOGUE.at(-1)).toBe("second-chance")
  })

  it("refuses a face that does not exist, and the names every object has", () => {
    for (const face of ["unicorn", "", "toString", "constructor", "__proto__"]) expect(() => cardType(face), face).toThrow(RangeError)
  })
})
