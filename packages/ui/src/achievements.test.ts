import { describe, expect, it } from "vitest"
import { BADGE_MARKS, BADGE_SHAPES, badgeOf, shownIn } from "./achievements"

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

describe("shownIn", () => {
  it("shows all of them when they fit", () => {
    expect(shownIn(0, 6)).toEqual({ shown: 0, hidden: 0 })
    expect(shownIn(3, 6)).toEqual({ shown: 3, hidden: 0 })
    expect(shownIn(6, 6)).toEqual({ shown: 6, hidden: 0 })
  })

  it("leaves the last place to the number of those that are left when they do not, which counts itself in", () => {
    expect(shownIn(7, 6)).toEqual({ shown: 5, hidden: 2 })
    expect(shownIn(9, 6)).toEqual({ shown: 5, hidden: 4 })
    expect(shownIn(12, 6)).toEqual({ shown: 5, hidden: 7 })
  })

  it("has only the number in a block of one place", () => {
    expect(shownIn(2, 1)).toEqual({ shown: 0, hidden: 2 })
    expect(shownIn(1, 1)).toEqual({ shown: 1, hidden: 0 })
  })
})
