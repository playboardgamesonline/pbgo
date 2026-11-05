import { describe, expect, it } from "vitest"
import { BADGE_MARKS, BADGE_SHAPES, badgeOf, slotsIn } from "./achievements"

describe("badgeOf", () => {
  it("gives a shape and a mark that the badge has", () => {
    for (const seed of ["", "a1", "first-win", "a very long id with spaces, accents and symbols: é ü ñ #42", "🏆"]) {
      const { shape, mark } = badgeOf(seed)
      expect(Number.isInteger(shape) && shape >= 0 && shape < BADGE_SHAPES, seed).toBe(true)
      expect(Number.isInteger(mark) && mark >= 0 && mark < BADGE_MARKS, seed).toBe(true)
    }
  })

  it("gives the same badge to the same achievement every time", () => {
    expect(badgeOf("comeback")).toEqual(badgeOf("comeback"))
  })

  it("does not give the same badge to every achievement", () => {
    const badges = ["a1", "a2", "a3", "a4", "first-win", "regular", "comeback", "tournament"].map((id) => JSON.stringify(badgeOf(id)))
    expect(new Set(badges).size).toBeGreaterThan(4)
  })

  it("uses every shape and every mark over enough achievements", () => {
    const seeds = Array.from({ length: 200 }, (_, index) => `achievement-${index}`)
    expect(new Set(seeds.map((seed) => badgeOf(seed).shape)).size).toBe(BADGE_SHAPES)
    expect(new Set(seeds.map((seed) => badgeOf(seed).mark)).size).toBe(BADGE_MARKS)
  })
})

describe("slotsIn", () => {
  it("counts the badges and the gaps between them that a row holds", () => {
    expect(slotsIn(236, 76, 4)).toBe(3)
    expect(slotsIn(235, 76, 4)).toBe(2)
    expect(slotsIn(156, 76, 4)).toBe(2)
    expect(slotsIn(320, 76, 4)).toBe(4)
  })

  it("always has one place, whatever the row", () => {
    expect(slotsIn(0, 76, 4)).toBe(1)
    expect(slotsIn(40, 76, 4)).toBe(1)
    expect(slotsIn(Number.NaN, 76, 4)).toBe(1)
    expect(slotsIn(300, 0, 0)).toBe(1)
  })
})
