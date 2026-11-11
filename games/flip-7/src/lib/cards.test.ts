import { CARDS } from "@flip-7/engine"
import { describe, expect, it } from "vitest"
import { cardName, isSecondChance } from "./cards"

const NAMES = { freeze: "Freeze", "flip-three": "Flip Three", "second-chance": "Second Chance" }

describe("the name of a card", () => {
  it("is the figure printed on a number or a modifier, with no word to translate", () => {
    expect(cardName("number-0", NAMES)).toBe("0")
    expect(cardName("number-7", NAMES)).toBe("7")
    expect(cardName("number-12", NAMES)).toBe("12")
    expect(cardName("plus-2", NAMES)).toBe("+2")
    expect(cardName("plus-10", NAMES)).toBe("+10")
    expect(cardName("times-2", NAMES)).toBe("x2")
  })

  it("is the name of an action card in the language asked, which Sanity holds", () => {
    expect(cardName("freeze", NAMES)).toBe("Freeze")
    expect(cardName("flip-three", { ...NAMES, "flip-three": "Flip Trois" })).toBe("Flip Trois")
    expect(cardName("second-chance", { "second-chance": "[missing: cards.second-chance]" })).toBe("[missing: cards.second-chance]")
  })

  it("is written as it is for a key the catalogue does not know, never a crash", () => {
    expect(cardName("joker", NAMES)).toBe("joker")
    expect(cardName("toString", NAMES)).toBe("toString")
  })

  it("is something for every card of the engine's catalogue", () => {
    for (const key of Object.keys(CARDS)) expect(cardName(key, NAMES), key).not.toBe("")
  })
})

describe("the Second Chance", () => {
  it("is the one action card a player may keep", () => {
    expect(isSecondChance("second-chance")).toBe(true)
    expect(isSecondChance("freeze")).toBe(false)
    expect(isSecondChance("flip-three")).toBe(false)
    expect(isSecondChance("number-7")).toBe(false)
    expect(isSecondChance("nothing")).toBe(false)
  })
})
