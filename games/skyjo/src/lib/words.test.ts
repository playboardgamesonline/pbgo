import { describe, expect, it } from "vitest"
import { WORD_FIELDS, fill } from "./words"

describe("the words of the board", () => {
  it("fills the placeholders and leaves an unknown one as written", () => {
    expect(fill("Round {number}", { number: 3 })).toBe("Round 3")
    expect(fill("{player} is playing", { player: "Alix" })).toBe("Alix is playing")
    expect(fill("{points} this round", {})).toBe("{points} this round")
    expect(fill("{a}{a}", { a: 1 })).toBe("11")
  })

  it("lists each word once", () => {
    expect(new Set(WORD_FIELDS).size).toBe(WORD_FIELDS.length)
  })
})
