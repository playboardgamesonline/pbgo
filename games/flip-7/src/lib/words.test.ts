import { describe, expect, it } from "vitest"
import { fill, WORD_FIELDS } from "./words"

describe("the words of the board", () => {
  it("name each field of the Board tab once", () => {
    expect(new Set(WORD_FIELDS).size).toBe(WORD_FIELDS.length)
  })

  it("fill their placeholders with names, cards and numbers", () => {
    expect(fill("gives {card} to {target}", { card: "Freeze", target: "Sam" })).toBe("gives Freeze to Sam")
    expect(fill("stays and banks {points}", { points: 21 })).toBe("stays and banks 21")
    expect(fill("Round {number}", { number: 0 })).toBe("Round 0")
  })

  it("fill a placeholder as many times as it stands, and leave one that has no value as it is written", () => {
    expect(fill("{card}, {card}", { card: "7" })).toBe("7, 7")
    expect(fill("gives {card} to {target}", { card: "Freeze" })).toBe("gives Freeze to {target}")
    expect(fill("ends the round")).toBe("ends the round")
  })
})
