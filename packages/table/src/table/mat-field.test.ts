import { describe, expect, it } from "vitest"
import { latticeLines, poolFalloff, poolStops } from "./mat-field"

describe("a pool of light", () => {
  it("is whole at the middle, gone at the edge and smooth between", () => {
    expect(poolFalloff(0)).toBe(1)
    expect(poolFalloff(1)).toBe(0)
    expect(poolFalloff(0.5)).toBeCloseTo(0.5, 9)
    let last = 1
    for (let i = 1; i <= 20; i++) {
      const now = poolFalloff(i / 20)
      expect(now).toBeLessThanOrEqual(last)
      last = now
    }
  })

  it("leaves nothing past its edge and does not climb back", () => {
    expect(poolFalloff(2)).toBe(0)
    expect(poolFalloff(-1)).toBe(1)
  })

  it("has stops from the colour of the light to black", () => {
    const stops = poolStops("#336699", 4)
    expect(stops).toHaveLength(5)
    expect(stops[0]).toEqual({ at: 0, rgb: "rgb(51, 102, 153)" })
    expect(stops[4]).toEqual({ at: 1, rgb: "rgb(0, 0, 0)" })
  })
})

describe("a diamond lattice", () => {
  it("has lines of both slopes that all cross the square", () => {
    const lines = latticeLines(240, 3)
    const down = lines.filter((l) => l.to[0] > l.from[0])
    const other = lines.filter((l) => l.to[0] < l.from[0])
    expect(down.length).toBe(other.length)
    for (const l of lines) expect(Math.abs(l.to[0] - l.from[0])).toBe(240)
  })

  it("is the same one square over: the lines repeat every `size / diamonds` across", () => {
    const lines = latticeLines(240, 3)
    const spacing = 80
    const starts = new Set(lines.map((l) => l.from[0]))
    for (const x of starts) expect(starts.has(x + spacing) || x + spacing > 3 * 2 * spacing).toBe(true)
  })
})
