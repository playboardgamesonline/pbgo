import { CHARACTER_KEYS } from "@love-letter/engine"
import { describe, expect, it } from "vitest"
import { FACE, largestFit, LINE_HEIGHT, NAME_PLATE, NAME_SIZE, setName, setText, TEXT_SIZE, textPlateOf, wrap } from "./lettering"

/** A measure for tests: a letter is `share` of its size wide, whatever the letter (a serif is about 0.45, a wide capital 0.7) */
const measureAt = (share: number) => (size: number) => (text: string) => text.length * size * share

describe("the plates of a face", () => {
  it("lie inside the 760 by 1060 picture, the banner right of the medallion and the text plates under the portrait", () => {
    for (const plate of [NAME_PLATE, textPlateOf("guard"), textPlateOf("princess")]) {
      expect(plate.x).toBeGreaterThanOrEqual(0)
      expect(plate.y).toBeGreaterThanOrEqual(0)
      expect(plate.x + plate.width).toBeLessThanOrEqual(FACE.width)
      expect(plate.y + plate.height).toBeLessThanOrEqual(FACE.height)
    }
    // the medallion with the value ends at about x 235: the name starts after it
    expect(NAME_PLATE.x).toBeGreaterThan(235)
  })

  it("give the four characters whose portrait runs lower the shorter plate, and the six others the taller one", () => {
    const short = CHARACTER_KEYS.filter((key) => textPlateOf(key).height < 140)
    expect(short).toEqual(["priest", "king", "countess", "princess"])
    const tall = CHARACTER_KEYS.filter((key) => textPlateOf(key).height > 160)
    expect(tall).toEqual(["spy", "guard", "baron", "handmaid", "prince", "chancellor"])
  })

  it("are centred on the same line for the text: the middle of the picture", () => {
    for (const key of CHARACTER_KEYS) expect(textPlateOf(key).x + textPlateOf(key).width / 2).toBe(380)
  })
})

describe("largestFit", () => {
  it("gives the largest size at which a text fits, and the least one when none does", () => {
    expect(largestFit(30, 10, (size) => size <= 17)).toBe(17)
    expect(largestFit(30, 10, () => true)).toBe(30)
    expect(largestFit(30, 10, () => false)).toBe(10)
  })
})

describe("wrap", () => {
  const measure = (text: string) => text.length
  it("breaks a text at the spaces into lines of at most the width", () => {
    expect(wrap("one two three four", 9, measure)).toEqual(["one two", "three", "four"])
    for (const line of wrap("the quick brown fox jumps over the lazy dog", 12, measure)) expect(line.length).toBeLessThanOrEqual(12)
  })

  it("keeps a word wider than a line whole on a line of its own, and leaves the caller to see that it does not fit", () => {
    expect(wrap("a supercalifragilistic b", 8, measure)).toEqual(["a", "supercalifragilistic", "b"])
  })

  it("gives no line for no text, and one line for a short one", () => {
    expect(wrap("", 10, measure)).toEqual([])
    expect(wrap("  hi  ", 10, measure)).toEqual(["hi"])
  })
})

describe("the card text in its plate", () => {
  // The budgets of the seed: 130 characters on the six taller plates, 90 on the four shorter ones (`content/data/data.test.ts`)
  const longest = (n: number) => Array.from({ length: n }, (_, i) => (i % 6 === 5 ? " " : "x")).join("").replace(/xxxxx /g, "word ").slice(0, n)

  it("fits a text of the budget at a size that reads, with the width of an old-style serif", () => {
    for (const key of CHARACTER_KEYS) {
      const budget = textPlateOf(key).height < 140 ? 90 : 130
      const setting = setText(longest(budget), textPlateOf(key), measureAt(0.47))
      expect(setting.fits, key).toBe(true)
      expect(setting.size, key).toBeGreaterThanOrEqual(24)
    }
  })

  it("is set smaller as the text grows, never larger than the size it starts from, and never below the least", () => {
    const plate = textPlateOf("guard")
    const sizes = [20, 60, 100, 130, 200, 400].map((n) => setText(longest(n), plate, measureAt(0.47)).size)
    for (let i = 1; i < sizes.length; i++) expect(sizes[i]!).toBeLessThanOrEqual(sizes[i - 1]!)
    expect(Math.max(...sizes)).toBeLessThanOrEqual(TEXT_SIZE.start)
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(TEXT_SIZE.least)
  })

  it("says it does not fit when even the least size overflows, so the overflow is never silent", () => {
    expect(setText(longest(2000), textPlateOf("guard"), measureAt(0.47)).fits).toBe(false)
  })

  it("keeps every line inside the width of the plate and all the lines inside its height", () => {
    const plate = textPlateOf("priest")
    const measure = measureAt(0.47)
    const setting = setText(longest(90), plate, measure)
    for (const line of setting.lines) expect(measure(setting.size)(line)).toBeLessThanOrEqual(plate.width)
    expect(setting.lines.length * setting.size * LINE_HEIGHT).toBeLessThanOrEqual(plate.height)
  })
})

describe("the name in its banner", () => {
  it("fits a name of the budget, twelve letters, at a size that reads, even set in wide capitals", () => {
    const { size, fits } = setName("Chancellor", NAME_PLATE, measureAt(0.78))
    expect(fits).toBe(true)
    expect(size).toBeGreaterThanOrEqual(26)
    expect(setName("Abcdefghijkl", NAME_PLATE, measureAt(0.78)).fits).toBe(true)
  })

  it("is set as large as the banner allows for a short name, never larger than it starts from", () => {
    const { size } = setName("King", NAME_PLATE, measureAt(0.78))
    expect(size).toBe(NAME_SIZE.start)
    expect(size).toBeLessThanOrEqual(NAME_PLATE.height)
  })

  it("says it does not fit when the name is far too long, so the overflow is never silent", () => {
    expect(setName("A name that is much too long for a banner of this size", NAME_PLATE, measureAt(0.78)).fits).toBe(false)
  })
})
