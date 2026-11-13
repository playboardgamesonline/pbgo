import { describe, expect, it } from "vitest"
import { grainField, hexChannels, seeded } from "./grain-field"

describe("the grain of the table", () => {
  it("is the same for the same seed and different for another", () => {
    expect(Array.from(grainField(64, 7))).toEqual(Array.from(grainField(64, 7)))
    expect(Array.from(grainField(64, 7))).not.toEqual(Array.from(grainField(64, 8)))
  })
  it("stays between -1 and 1 with no drift: it lightens and darkens alike", () => {
    const field = grainField(128, 7)
    let sum = 0
    for (const v of field) {
      expect(v).toBeGreaterThanOrEqual(-1)
      expect(v).toBeLessThanOrEqual(1)
      sum += v
    }
    expect(Math.abs(sum / field.length)).toBeLessThan(0.05)
  })
  it("has enough of it to be seen: a spread well above zero", () => {
    const field = grainField(128, 7)
    const mean = field.reduce((a, v) => a + v, 0) / field.length
    const sd = Math.sqrt(field.reduce((a, v) => a + (v - mean) ** 2, 0) / field.length)
    expect(sd).toBeGreaterThan(0.25)
  })
  it("repeats with no seam: the mottling is continuous across the wrapped edge", () => {
    // the slow part changes little from the last column to the first; compare a neighbour step inside with the step across the edge, on an average over the rows
    const size = 128
    const field = grainField(size, 7)
    const step = (x0: number, x1: number) => {
      let total = 0
      for (let y = 0; y < size; y++) total += Math.abs(field[y * size + x0]! - field[y * size + x1]!)
      return total / size
    }
    expect(step(size - 1, 0)).toBeLessThan(step(10, 11) * 1.4)
  })
  it("seeds a generator in [0, 1)", () => {
    const random = seeded(1)
    for (let i = 0; i < 100; i++) {
      const v = random()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
  it("reads a hex colour", () => {
    expect(hexChannels("#102030")).toEqual([16, 32, 48])
  })
})
