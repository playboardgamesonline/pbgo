import { describe, expect, it } from "vitest"
import { dithered, poolLight } from "./textures"

describe("the pool of light of the mat", () => {
  it("is all there in the middle and gone at the edge", () => {
    expect(poolLight(0)).toBe(1)
    expect(poolLight(1)).toBe(0)
  })

  it("eases away with no knee: it never rises, and it is flat at both ends", () => {
    let last = 1
    for (let i = 1; i <= 100; i++) {
      const light = poolLight(i / 100)
      expect(light).toBeLessThanOrEqual(last)
      last = light
    }
    expect(poolLight(0.02)).toBeGreaterThan(0.99)
    expect(poolLight(0.98)).toBeLessThan(0.01)
  })

  it("holds past its ends", () => {
    expect(poolLight(-1)).toBe(1)
    expect(poolLight(2)).toBe(0)
  })
})

describe("the dither of the pool's gradient", () => {
  it("rounds a level up or down, never by more than one", () => {
    for (let i = 0; i < 1000; i++) {
      const level = dithered(12.3, i)
      expect(level === 12 || level === 13).toBe(true)
    }
  })

  it("keeps the level on average: 12.3 is 13 three times in ten", () => {
    let total = 0
    const count = 20000
    for (let i = 0; i < count; i++) total += dithered(12.3, i)
    expect(total / count).toBeCloseTo(12.3, 1)
  })

  it("leaves a whole level alone and is the same every time", () => {
    for (let i = 0; i < 100; i++) expect(dithered(40, i)).toBe(40)
    expect(dithered(7.5, 123)).toBe(dithered(7.5, 123))
  })
})
