import { describe, expect, it } from "vitest"
import { ATLAS_LIMIT, atlasOf, cellRect, fitSize, plateSize, quadsOf, spaceOfFace, WHOLE } from "./atlas"
import { lineSpaces, loopSpaces } from "./path"

describe("plateSize", () => {
  it("is a little under the distance to the nearest neighbour, so that two plates never touch", () => {
    const { width, depth } = plateSize(lineSpaces(6, { gap: 1.5 }))
    expect(width).toBeCloseTo(1.29, 12)
    expect(depth).toBe(width)
    expect(width).toBeLessThan(1.5)
  })

  it("follows the tightest place of an uneven track", () => {
    const { width } = plateSize([
      { x: 0, z: 0, yaw: 0 },
      { x: 3, z: 0, yaw: 0 },
      { x: 3.5, z: 0, yaw: 0 },
      { x: 8, z: 0, yaw: 0 },
    ])
    expect(width).toBeCloseTo(0.43, 12)
  })

  it("is a unit for a track of one space or of spaces that are all in one place", () => {
    expect(plateSize([{ x: 2, z: 2, yaw: 0 }]).width).toBe(1)
    expect(plateSize([])).toEqual({ width: 1, depth: 1 })
    expect(
      plateSize([
        { x: 1, z: 1, yaw: 0 },
        { x: 1, z: 1, yaw: 0 },
      ]).width,
    ).toBe(1)
  })
})

describe("atlasOf", () => {
  it("holds a plate for every space, as square as it can", () => {
    for (const count of [1, 2, 3, 10, 40, 100, 250]) {
      const atlas = atlasOf(count, { width: 0.9, depth: 0.9 })
      expect(atlas.columns * atlas.rows).toBeGreaterThanOrEqual(count)
      expect(Math.abs(atlas.columns - atlas.rows)).toBeLessThanOrEqual(2)
      expect(atlas.width).toBe(atlas.columns * atlas.cellWidth)
      expect(atlas.height).toBe(atlas.rows * atlas.cellHeight)
    }
  })

  it("keeps the picture within what a texture can be, whatever the number of spaces or their size", () => {
    for (const count of [1, 40, 400, 3000]) {
      for (const side of [0.05, 0.9, 4, 30]) {
        const atlas = atlasOf(count, { width: side, depth: side })
        expect(atlas.width, `${count} of ${side}`).toBeLessThanOrEqual(ATLAS_LIMIT)
        expect(atlas.height, `${count} of ${side}`).toBeLessThanOrEqual(ATLAS_LIMIT)
        expect(atlas.cellWidth).toBeGreaterThanOrEqual(1)
        expect(atlas.cellHeight).toBeGreaterThanOrEqual(1)
      }
    }
  })

  it("draws a plate with the pixels its size asks for, no more than the limit across", () => {
    const small = atlasOf(4, { width: 0.9, depth: 0.9 })
    expect(small.cellWidth).toBe(144)
    const big = atlasOf(4, { width: 6, depth: 6 })
    expect(big.cellWidth).toBeLessThanOrEqual(256)
  })

  it("gives a plate that is not square the proportions it has", () => {
    const { cellWidth, cellHeight } = atlasOf(8, { width: 1.6, depth: 0.8 })
    expect(cellWidth / cellHeight).toBeCloseTo(2, 1)
  })

  it("holds one cell for a track with no space, so that nothing is drawn from nothing", () => {
    const atlas = atlasOf(0, { width: 1, depth: 1 })
    expect(atlas.columns).toBe(1)
    expect(atlas.rows).toBe(1)
  })
})

describe("cellRect", () => {
  it("tiles the picture: every cell is a rectangle of its own and none is outside it", () => {
    const atlas = atlasOf(13, { width: 1, depth: 1 })
    const seen = new Set<string>()
    for (let i = 0; i < 13; i++) {
      const { u0, v0, u1, v1 } = cellRect(i, atlas)
      expect(u0).toBeGreaterThanOrEqual(0)
      expect(u1).toBeLessThanOrEqual(1 + 1e-12)
      expect(v0).toBeGreaterThanOrEqual(-1e-12)
      expect(v1).toBeLessThanOrEqual(1)
      expect(u1 - u0).toBeCloseTo(atlas.cellWidth / atlas.width, 12)
      expect(v1 - v0).toBeCloseTo(atlas.cellHeight / atlas.height, 12)
      seen.add(`${u0.toFixed(6)}:${v0.toFixed(6)}`)
    }
    expect(seen.size).toBe(13)
  })

  it("puts the first cell at the top left of the canvas, which is the top left of the texture, and reads on row by row", () => {
    const atlas = atlasOf(9, { width: 1, depth: 1 })
    const first = cellRect(0, atlas)
    expect(first.u0).toBe(0)
    expect(first.v1).toBe(1)
    const next = cellRect(1, atlas)
    expect(next.u0).toBeCloseTo(first.u1, 12)
    expect(next.v1).toBe(1)
    const below = cellRect(atlas.columns, atlas)
    expect(below.u0).toBe(0)
    expect(below.v1).toBeCloseTo(first.v0, 12)
  })
})

describe("quadsOf", () => {
  const plate = { width: 2, depth: 1 }
  const at = (yaw: number) => [{ x: 5, z: -3, yaw }]
  const corner = (quads: ReturnType<typeof quadsOf>, k: number) => [quads.positions[k * 3], quads.positions[k * 3 + 1], quads.positions[k * 3 + 2]] as const

  it("makes four vertices and two triangles for each space", () => {
    const quads = quadsOf(lineSpaces(7, { gap: 2 }), plate, { height: 0.01, upright: true, rect: () => WHOLE })
    expect(quads.positions).toHaveLength(7 * 12)
    expect(quads.uvs).toHaveLength(7 * 8)
    expect(quads.indices).toHaveLength(7 * 6)
    expect(Math.max(...quads.indices)).toBe(7 * 4 - 1)
  })

  it("lays a plate flat at the height it is given, around the middle of its space", () => {
    const quads = quadsOf(at(0), plate, { height: 0.01, upright: true, rect: () => WHOLE })
    // The positions are 32-bit numbers, as the graphics card has them
    const height = Math.fround(0.01)
    expect([0, 1, 2, 3].map((k) => corner(quads, k))).toEqual([
      [4, height, -3.5],
      [6, height, -3.5],
      [6, height, -2.5],
      [4, height, -2.5],
    ])
  })

  it("faces the sky: every triangle runs counterclockwise seen from above", () => {
    for (const upright of [true, false]) {
      const quads = quadsOf(loopSpaces(9, { radiusX: 3, radiusZ: 2 }), plate, { height: 0, upright, rect: () => WHOLE })
      for (let t = 0; t < quads.indices.length; t += 3) {
        const [a, b, c] = [0, 1, 2].map((k) => corner(quads, quads.indices[t + k]!))
        const [ux, uz, vx, vz] = [b![0] - a![0], b![2] - a![2], c![0] - a![0], c![2] - a![2]]
        // The y of the cross product of the two edges
        expect(uz * vx - ux * vz).toBeGreaterThan(0)
      }
    }
  })

  it("turns a plate with its space unless it is told to stay upright", () => {
    const turned = quadsOf(at(Math.PI / 2), plate, { height: 0, upright: false, rect: () => WHOLE })
    // A quarter turn: the width runs along z, away from the viewer
    expect(corner(turned, 0)[0]).toBeCloseTo(5 - 0.5, 6)
    expect(corner(turned, 0)[2]).toBeCloseTo(-3 + 1, 6)
    const upright = quadsOf(at(Math.PI / 2), plate, { height: 0, upright: true, rect: () => WHOLE })
    expect(corner(upright, 0)).toEqual([4, 0, -3.5])
  })

  it("grows a plate about its middle", () => {
    const quads = quadsOf(at(0), plate, { height: 0, upright: true, grow: 2, rect: () => WHOLE })
    expect(corner(quads, 0)).toEqual([3, 0, -4])
    expect(corner(quads, 2)).toEqual([7, 0, -2])
  })

  it("reads the picture of a cell the way it is drawn: its top left at the far left corner", () => {
    const rect = { u0: 0.25, v0: 0.5, u1: 0.5, v1: 0.75 }
    const quads = quadsOf(at(0), plate, { height: 0, upright: true, rect: () => rect })
    expect([0, 1, 2, 3].map((k) => [quads.uvs[k * 2], quads.uvs[k * 2 + 1]])).toEqual([
      [0.25, 0.75],
      [0.5, 0.75],
      [0.5, 0.5],
      [0.25, 0.5],
    ])
  })

  it("asks for the cell of each space by its place in the list", () => {
    const asked: number[] = []
    quadsOf(lineSpaces(3, { gap: 1 }), plate, {
      height: 0,
      upright: true,
      rect: (i) => {
        asked.push(i)
        return WHOLE
      },
    })
    expect(asked).toEqual([0, 1, 2])
  })
})

describe("spaceOfFace", () => {
  it("names the space of a triangle: two triangles for each", () => {
    expect([0, 1, 2, 3, 4, 5].map(spaceOfFace)).toEqual([0, 0, 1, 1, 2, 2])
  })

  it("names no space for a hit that says nothing", () => {
    expect(spaceOfFace(undefined)).toBe(-1)
    expect(spaceOfFace(null)).toBe(-1)
    expect(spaceOfFace(-3)).toBe(-1)
    expect(spaceOfFace(1.5)).toBe(-1)
  })
})

describe("fitSize", () => {
  const measure = (text: string, size: number) => text.length * size * 0.6

  it("keeps the size of a label that fits", () => {
    expect(fitSize("12", 100, 200, measure)).toBe(100)
  })

  it("shrinks a label that does not fit, until it does", () => {
    const size = fitSize("12345", 100, 200, measure)
    expect(size).toBeLessThan(100)
    expect(measure("12345", size)).toBeCloseTo(200, 9)
  })

  it("never shrinks it under its floor: a label that long is the game's to shorten", () => {
    expect(fitSize("a very long label indeed", 100, 100, measure)).toBe(45)
    expect(fitSize("a very long label indeed", 100, 100, measure, 0.6)).toBe(60)
  })

  it("keeps the size when there is nothing to measure", () => {
    expect(fitSize("", 80, 100, measure)).toBe(80)
  })
})
