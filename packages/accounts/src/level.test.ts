import { describe, expect, it } from "vitest"
import { levelOf, levelProgress, xpToReach } from "./level"

describe("levelOf", () => {
  it("starts everybody at level 0 with nothing to show", () => {
    expect(levelOf(0)).toEqual({ level: 0, xp: 0, from: 0, to: 100 })
    expect(levelProgress(levelOf(0))).toBe(0)
  })
  it("changes level exactly at the points that reach it", () => {
    expect(levelOf(99).level).toBe(0)
    expect(levelOf(100).level).toBe(1)
    expect(levelOf(299).level).toBe(1)
    expect(levelOf(300).level).toBe(2)
    expect(levelOf(600).level).toBe(3)
    expect(levelOf(1000).level).toBe(4)
  })
  it("agrees with the table of points for the first thousand levels", () => {
    for (let n = 0; n < 1000; n++) {
      expect(levelOf(xpToReach(n)).level).toBe(n)
      expect(levelOf(xpToReach(n + 1) - 1).level).toBe(n)
    }
  })
  it("says how far the next level is", () => {
    expect(levelProgress(levelOf(200))).toBe(0.5)
    expect(levelOf(640)).toEqual({ level: 3, xp: 640, from: 600, to: 1000 })
  })
  it("counts what is not a whole number of points, or is negative, as 0", () => {
    for (const bad of [-5, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) expect(levelOf(bad).level).toBe(0)
  })
})
