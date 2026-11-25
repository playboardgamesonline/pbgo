import { describe, expect, it } from "vitest"
import { widest, wrapText } from "./text-wrap"

/** A letter is one wide, as a monospaced lettering measures: the tests read the lines as they would be counted */
const length = (line: string) => line.length

describe("how a text breaks into lines", () => {
  it("is one line when it fits the room", () => {
    expect(wrapText("Draw", length, 10)).toEqual(["Draw"])
    expect(wrapText("Take the discard", length, 16)).toEqual(["Take the discard"])
  })

  it("breaks at the spaces, and never inside a word", () => {
    const lines = wrapText("Discard and flip", length, 9)
    expect(lines).toEqual(["Discard", "and flip"])
    expect(lines.join(" ")).toBe("Discard and flip")
  })

  it("keeps every line within the room when no word is wider than it", () => {
    for (const room of [9, 11, 13, 20]) for (const line of wrapText("Défausser et retourner la carte", length, room)) expect(line.length).toBeLessThanOrEqual(room)
  })

  it("evens the lines out instead of filling the first one: the same number of lines, in the narrowest room", () => {
    // filled first, the room of 11 gives "aaa bbb ccc" over "ddd"; two and two read as well and hang evenly
    expect(wrapText("aaa bbb ccc ddd", length, 11)).toEqual(["aaa bbb", "ccc ddd"])
    expect(wrapText("Take the discard", length, 12)).toEqual(["Take the", "discard"])
  })

  it("never needs more lines than filling the room would", () => {
    const text = "Prendre la carte de la défausse"
    for (const room of [6, 8, 10, 12, 16, 22]) {
      const filled = wrapText(text, length, room).length
      // a plain fill of the same room, counted by hand
      let lines = 1
      let width = 0
      for (const word of text.split(" ")) {
        const next = width === 0 ? word.length : width + 1 + word.length
        if (width !== 0 && next > room) {
          lines += 1
          width = word.length
        } else width = next
      }
      expect(filled).toBeLessThanOrEqual(lines)
    }
  })

  it("never cuts a word that is wider than the room: it has a line of its own", () => {
    expect(wrapText("Superlongword a", length, 5)).toEqual(["Superlongword", "a"])
    expect(wrapText("a Superlongword", length, 5)).toEqual(["a", "Superlongword"])
  })

  it("is one empty line for no text, and takes no notice of the spaces round and between the words", () => {
    expect(wrapText("", length, 10)).toEqual([""])
    expect(wrapText("   ", length, 10)).toEqual([""])
    expect(wrapText("  Take   the  discard ", length, 30)).toEqual(["Take the discard"])
  })

  it("measures the lines the way it is told to, so that a wide letter takes its room", () => {
    // "W" is three wide, every other letter one
    const wide = (line: string) => [...line].reduce((sum, letter) => sum + (letter === "W" ? 3 : 1), 0)
    expect(wrapText("WWW WWW", wide, 9)).toEqual(["WWW", "WWW"])
    expect(wrapText("WWW WWW", wide, 19)).toEqual(["WWW WWW"])
  })
})

describe("how wide the widest line is", () => {
  it("is the widest of them, and nothing for none", () => {
    expect(widest(["ab", "abcd", "abc"], length)).toBe(4)
    expect(widest([], length)).toBe(0)
  })
})
