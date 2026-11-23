import { describe, expect, it } from "vitest"
import { fill, targetPromptOf, WORD_FIELDS } from "./words"

describe("the words of the board", () => {
  it("name each field of the Board tab once", () => {
    expect(new Set(WORD_FIELDS).size).toBe(WORD_FIELDS.length)
  })

  it("fill their placeholders with names, cards and numbers", () => {
    expect(fill("gives {card} to {target}", { card: "Freeze", target: "Sam" })).toBe("gives Freeze to Sam")
    expect(fill("stays and banks {points}", { points: 21 })).toBe("stays and banks 21")
    expect(fill("Round {number}", { number: 0 })).toBe("Round 0")
  })

  it("tell the holder of an action card the sentence of that card", () => {
    const words = { targetFreeze: "freeze it", targetFlipThree: "flip three", targetSecondChance: "second chance" }
    expect(targetPromptOf("freeze", words)).toBe("freeze it")
    expect(targetPromptOf("flip-three", words)).toBe("flip three")
    expect(targetPromptOf("second-chance", words)).toBe("second chance")
  })

  it("fill a placeholder as many times as it stands, and leave one that has no value as it is written", () => {
    expect(fill("{card}, {card}", { card: "7" })).toBe("7, 7")
    expect(fill("gives {card} to {target}", { card: "Freeze" })).toBe("gives Freeze to {target}")
    expect(fill("ends the round")).toBe("ends the round")
  })
})
