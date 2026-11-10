import { describe, expect, it } from "vitest"
import { layoutSheet, type Measure, SMALLEST, wrapRows } from "./layout"

// Every character is as wide as the letters are high, so a width of 10 holds ten of them at a size of 1
const at = (size: number): Measure => (text) => [...text].length * size

describe("wrapRows", () => {
  const wrap = (text: string, width: number) => wrapRows(text, width, at(1))

  it("keeps a text that fits on one line", () => {
    expect(wrap("a clue", 10)).toEqual([{ text: "a clue", start: 0 }])
  })

  it("breaks at spaces, leaving the space out of the line", () => {
    expect(wrap("the cat sat on the mat", 10)).toEqual([
      { text: "the cat", start: 0 },
      { text: "sat on the", start: 8 },
      { text: "mat", start: 19 },
    ])
  })

  it("breaks inside a word only when the word is wider than the line", () => {
    expect(wrap("extraordinary", 5)).toEqual([
      { text: "extra", start: 0 },
      { text: "ordin", start: 5 },
      { text: "ary", start: 10 },
    ])
    expect(wrap("ab extraordinary", 6)).toEqual([
      { text: "ab", start: 0 },
      { text: "extrao", start: 3 },
      { text: "rdinar", start: 9 },
      { text: "y", start: 15 },
    ])
  })

  it("starts a line at a line break of the text, empty lines included", () => {
    expect(wrap("one\ntwo\n\nfour", 10)).toEqual([
      { text: "one", start: 0 },
      { text: "two", start: 4 },
      { text: "", start: 8 },
      { text: "four", start: 9 },
    ])
  })

  it("gives one empty line for an empty text", () => {
    expect(wrap("", 10)).toEqual([{ text: "", start: 0 }])
  })

  it("never splits an emoji or an accented letter", () => {
    const family = "\u{1F468}\u200D\u{1F469}\u200D\u{1F467}"
    // A reader sees one character where the text has several code points: measure what they see
    const seen = new Intl.Segmenter("en", { granularity: "grapheme" })
    const rows = wrapRows(family.repeat(4), 2, (part) => [...seen.segment(part)].length)
    expect(rows.map((row) => row.text)).toEqual([family.repeat(2), family.repeat(2)])
    expect(rows[1]!.start).toBe(family.length * 2)
    const accented = "e\u0301".repeat(4)
    expect(wrapRows(accented, 2, (part) => [...seen.segment(part)].length).map((row) => row.text)).toEqual(["e\u0301e\u0301", "e\u0301e\u0301"])
  })

  it("covers the whole text: every character is in a line, in order", () => {
    const text = "a long clue that wraps over several lines of the sheet and runs on"
    const rows = wrap(text, 12)
    let rebuilt = ""
    let last = 0
    for (const row of rows) {
      expect(text.slice(row.start, row.start + row.text.length)).toBe(row.text)
      expect(row.start).toBeGreaterThanOrEqual(last)
      last = row.start + row.text.length
      rebuilt += `${row.text} `
    }
    expect(rebuilt.trim()).toBe(text)
    for (const row of rows) expect([...row.text].length).toBeLessThanOrEqual(12)
  })

  it("keeps spaces inside a line as they are", () => {
    expect(wrap("a  b", 10)).toEqual([{ text: "a  b", start: 0 }])
  })
})

describe("layoutSheet", () => {
  const box = (lines: number, width = 100) => ({ width, height: 20 * lines, lines })

  it("makes the letters as big as the line asks and keeps a short text on one line", () => {
    const layout = layoutSheet("hello", box(1), at)
    expect(layout.pitch).toBe(20)
    expect(layout.size).toBeCloseTo(20 * 0.68, 9)
    expect(layout.rows).toHaveLength(1)
    expect(layout.cut).toBe(false)
  })

  it("shrinks the letters until the text fits", () => {
    // 10 characters at a size of 13.6 is 136 wide: too wide for 100, and it fits once the letters are 10 or less
    const layout = layoutSheet("0123456789", box(1), at)
    expect(layout.rows).toHaveLength(1)
    expect(layout.size).toBeLessThanOrEqual(10 + 1e-9)
    expect(layout.size).toBeGreaterThan(8)
    expect(layout.cut).toBe(false)
  })

  it("does not shrink below the smallest size, and cuts what does not fit", () => {
    const layout = layoutSheet("x".repeat(40), box(1), at)
    expect(layout.size).toBeCloseTo(20 * 0.68 * SMALLEST, 6)
    expect(layout.cut).toBe(true)
    expect(layout.rows).toHaveLength(1)
  })

  it("wraps over the lines the sheet has before it shrinks", () => {
    const layout = layoutSheet("one two three four five six", box(3, 120), at)
    expect(layout.rows.length).toBeGreaterThan(1)
    expect(layout.rows.length).toBeLessThanOrEqual(3)
    expect(layout.cut).toBe(false)
  })

  it("never gives more lines than the sheet has", () => {
    const layout = layoutSheet("a b c d e f g h i j k l m n o p q r s t u v w x y z ".repeat(5), box(2, 60), at)
    expect(layout.rows.length).toBeLessThanOrEqual(2)
    expect(layout.cut).toBe(true)
  })
})
