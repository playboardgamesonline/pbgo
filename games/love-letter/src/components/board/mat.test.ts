import { describe, expect, it } from "vitest"
import { dithered, poolLight } from "./mat"

describe("the pool of light of the table", () => {
  it("has all its light in the middle and none at the edge, easing away between with no flat part and no knee", () => {
    expect(poolLight(0)).toBe(1)
    expect(poolLight(1)).toBe(0)
    let before = 1
    for (let i = 1; i <= 100; i++) {
      const light = poolLight(i / 100)
      expect(light).toBeLessThanOrEqual(before)
      before = light
    }
    // eased at both ends: the light is still nearly all there a little way out and nearly none a little way in from the edge
    expect(poolLight(0.05)).toBeGreaterThan(0.99)
    expect(poolLight(0.95)).toBeLessThan(0.01)
  })

  it("holds between 0 and 1 whatever it is asked", () => {
    expect(poolLight(-3)).toBe(1)
    expect(poolLight(7)).toBe(0)
  })
})

describe("the dither of a gradient painted in 8 bits", () => {
  it("rounds a level up or down by one at the most, in proportion to what it has after the point", () => {
    for (let i = 0; i < 2000; i++) {
      const level = 12.3
      const out = dithered(level, i)
      expect([12, 13]).toContain(out)
    }
    const ups = Array.from({ length: 10_000 }, (_, i) => dithered(12.3, i)).filter((v) => v === 13).length
    expect(ups / 10_000).toBeCloseTo(0.3, 1)
  })

  it("leaves a whole level as it is, and is the same for the same index on every client: no `Math.random`", () => {
    for (let i = 0; i < 100; i++) expect(dithered(40, i)).toBe(40)
    expect(Array.from({ length: 50 }, (_, i) => dithered(7.5, i))).toEqual(Array.from({ length: 50 }, (_, i) => dithered(7.5, i)))
  })
})
