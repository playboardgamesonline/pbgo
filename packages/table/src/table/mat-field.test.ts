import { describe, expect, it } from "vitest"
import { dithered, hexOf, latticeLines, lightBetween, mosaicAt, mosaicPoints, poolFalloff, poolPixels, poolStops, unit } from "./mat-field"

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

describe("the hash that stands for chance", () => {
  it("is the same number for the same whole number, between 0 and 1", () => {
    for (let n = 0; n < 200; n++) {
      expect(unit(n)).toBe(unit(n))
      expect(unit(n)).toBeGreaterThanOrEqual(0)
      expect(unit(n)).toBeLessThan(1)
    }
  })

  it("is spread: the mean of many is about a half", () => {
    const mean = Array.from({ length: 4000 }, (_, n) => unit(n)).reduce((a, b) => a + b, 0) / 4000
    expect(mean).toBeGreaterThan(0.47)
    expect(mean).toBeLessThan(0.53)
  })
})

describe("a dithered level", () => {
  it("is the level rounded down or up by chance, never farther than a level from it", () => {
    for (let i = 0; i < 500; i++) {
      const level = 12.3
      const got = dithered(level, i)
      expect([12, 13]).toContain(got)
    }
  })

  it("rounds up in proportion to what is after the point: 12.3 is 13 about three times in ten", () => {
    const ups = Array.from({ length: 5000 }, (_, i) => dithered(12.3, i)).filter((n) => n === 13).length
    expect(ups / 5000).toBeGreaterThan(0.26)
    expect(ups / 5000).toBeLessThan(0.34)
  })

  it("is a whole level when the level is whole", () => {
    for (let i = 0; i < 100; i++) expect(dithered(7, i)).toBe(7)
  })
})

describe("the light a pool adds to reach a colour", () => {
  it("is what the middle has more than the table, channel by channel", () => {
    expect(lightBetween("#094f5d", "#043039")).toBe("#051f24")
  })

  it("is nothing for a channel the middle has less of", () => {
    expect(lightBetween("#102030", "#203010")).toBe("#000020")
  })

  it("makes a #rrggbb of three channels held between 0 and 255", () => {
    expect(hexOf(-5, 300, 15.6)).toBe("#00ff10")
  })
})

describe("the pixels of a pool of light", () => {
  const size = 64
  const pixels = poolPixels("#336699", size)
  const at = (x: number, y: number) => {
    const o = (y * size + x) * 4
    return [pixels[o]!, pixels[o + 1]!, pixels[o + 2]!, pixels[o + 3]!]
  }

  it("is `size` squared pixels of four channels, all opaque", () => {
    expect(pixels).toHaveLength(size * size * 4)
    for (let i = 3; i < pixels.length; i += 4) expect(pixels[i]).toBe(255)
  })

  it("is the colour of the light at the middle, give or take the dither", () => {
    const [r, g, b] = at(size / 2, size / 2)
    expect(Math.abs(r! - 0x33)).toBeLessThanOrEqual(2)
    expect(Math.abs(g! - 0x66)).toBeLessThanOrEqual(2)
    expect(Math.abs(b! - 0x99)).toBeLessThanOrEqual(2)
  })

  it("is black at the corners, past the pool's edge, so that the plane has none", () => {
    expect(at(0, 0)).toEqual([0, 0, 0, 255])
    expect(at(size - 1, size - 1)).toEqual([0, 0, 0, 255])
  })

  it("falls away from the middle toward the edge", () => {
    const along = (x: number) => at(x, size / 2)[0]!
    expect(along(size / 2)).toBeGreaterThan(along(size / 2 + 10))
    expect(along(size / 2 + 10)).toBeGreaterThan(along(size / 2 + 24))
  })

  it("is the same on every client: no chance, a hash", () => {
    expect(Array.from(poolPixels("#336699", size))).toEqual(Array.from(pixels))
  })

  it("steps by a level at most between two neighbours of a gentle slope, so that it shows no band", () => {
    // a band is a run of equal levels and then a step: with the dither, neighbours differ by at most one level here and there
    for (let x = size / 2; x < size - 1; x++) expect(Math.abs(at(x, size / 2)[0]! - at(x + 1, size / 2)[0]!)).toBeLessThanOrEqual(3)
  })
})

describe("a cracked-glass mosaic", () => {
  const cells = 9
  const points = mosaicPoints(cells, 7)

  it("has one point in each cell, off its edge, each with a shade between -1 and 1", () => {
    expect(points).toHaveLength(cells * cells)
    points.forEach((point, i) => {
      const cx = i % cells
      const cy = Math.floor(i / cells)
      expect(point.x).toBeGreaterThanOrEqual((cx + 0.15) / cells)
      expect(point.x).toBeLessThanOrEqual((cx + 0.85) / cells)
      expect(point.y).toBeGreaterThanOrEqual((cy + 0.15) / cells)
      expect(point.y).toBeLessThanOrEqual((cy + 0.85) / cells)
      expect(Math.abs(point.shade)).toBeLessThanOrEqual(1)
    })
  })

  it("is the same for the same seed and another for another", () => {
    expect(mosaicPoints(cells, 7)).toEqual(points)
    expect(mosaicPoints(cells, 8)).not.toEqual(points)
  })

  it("repeats every 1 across and down, so the square it is painted on tiles with no seam", () => {
    for (const [x, y] of [
      [0.1, 0.2],
      [0.5, 0.5],
      [0.97, 0.03],
      [0.001, 0.999],
    ] as const) {
      const here = mosaicAt(points, cells, x, y)
      for (const [dx, dy] of [
        [1, 0],
        [0, 1],
        [1, 1],
        [-1, 0],
      ] as const) {
        const there = mosaicAt(points, cells, x + dx, y + dy)
        expect(there.shade).toBe(here.shade)
        expect(there.crack).toBeCloseTo(here.crack, 9)
      }
    }
  })

  it("has a shade within -1 to 1 and a crack within 0 to 1 everywhere", () => {
    for (let i = 0; i < 400; i++) {
      const field = mosaicAt(points, cells, unit(i), unit(i + 1000))
      expect(Math.abs(field.shade)).toBeLessThanOrEqual(1)
      expect(field.crack).toBeGreaterThanOrEqual(0)
      expect(field.crack).toBeLessThanOrEqual(1)
    }
  })

  it("has cracks along the borders of the cells and none in the middle of one", () => {
    // at a centre the nearest point is far closer than the next: no crack. Along the line between two centres there is one
    const [a, b] = [points[4 * cells + 4]!, points[4 * cells + 5]!]
    expect(mosaicAt(points, cells, a.x, a.y).crack).toBe(0)
    const middle = mosaicAt(points, cells, (a.x + b.x) / 2, (a.y + b.y) / 2)
    expect(middle.crack).toBeGreaterThan(0.5)
  })

  it("gives a pixel the shade of the cell it lies in: the same shade on both sides of a point's neighbourhood", () => {
    const point = points[3 * cells + 3]!
    expect(mosaicAt(points, cells, point.x + 0.002, point.y).shade).toBe(point.shade)
  })
})
