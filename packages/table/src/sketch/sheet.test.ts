import { describe, expect, it } from "vitest"
import { cleanStroke, DRAWING_GRID } from "../../../engine-kit/src/drawing"
import { buildStroke, SKETCH_GRID, simplify, toGrid, toSheet } from "./sheet"

const THIN = { tolerance: 2.5, spacing: 3, maxPoints: 400 }
const PEN = { color: 1, width: 2 }
const RULES = { colors: 4, widths: 3 }

describe("the grid", () => {
  it("is the engine kit's, so that a stroke built here is one the engine counts on the same sheet", () => {
    expect(SKETCH_GRID).toBe(DRAWING_GRID)
  })
})

describe("where a point of the table is on a sheet", () => {
  const sheet = { x: 2, z: -1, width: 6, height: 4 }

  it("is 0 across and down at the top left corner, and 1 at the bottom right one", () => {
    // The top of the sheet is away from the viewer: its top left corner has the least x and the least z
    expect(toSheet({ x: -1, z: -3 }, sheet)).toEqual([0, 0])
    expect(toSheet({ x: 5, z: 1 }, sheet)).toEqual([1, 1])
    expect(toSheet({ x: 2, z: -1 }, sheet)).toEqual([0.5, 0.5])
  })

  it("is outside 0 to 1 for a point off the sheet", () => {
    const [x, y] = toSheet({ x: 20, z: 10 }, sheet)
    expect(x).toBeGreaterThan(1)
    expect(y).toBeGreaterThan(1)
  })

  it("follows the way the sheet is turned: a quarter turn takes its right edge to the viewer's far side", () => {
    // Three's yaw: a quarter turn takes the sheet's +x to the table's -z, and its +z to the table's +x
    const turned = { ...sheet, yaw: Math.PI / 2 }
    const [x, y] = toSheet({ x: 2, z: -1 - 3 }, turned)
    expect(x).toBeCloseTo(1, 9)
    expect(y).toBeCloseTo(0.5, 9)
    const [x2, y2] = toSheet({ x: 2 + 2, z: -1 }, turned)
    expect(x2).toBeCloseTo(0.5, 9)
    expect(y2).toBeCloseTo(1, 9)
  })

  it("keeps the same place whatever the yaw, for the point that lies at the middle of the sheet", () => {
    for (const yaw of [0, 0.7, Math.PI / 2, Math.PI, -2]) expect(toSheet({ x: 2, z: -1 }, { ...sheet, yaw }).map((n) => +n.toFixed(9))).toEqual([0.5, 0.5])
  })

  it("is put on the grid, kept on the sheet", () => {
    expect(toGrid([0.5, 0.25])).toEqual([500, 250])
    expect(toGrid([-3, 9])).toEqual([0, SKETCH_GRID])
  })
})

describe("thinning a line", () => {
  it("takes out the points on a straight line, and keeps its two ends", () => {
    const line = Array.from({ length: 50 }, (_, i) => [i * 10, 100] as const)
    expect(simplify(line, 1)).toEqual([
      [0, 100],
      [490, 100],
    ])
  })

  it("keeps the corner of an L", () => {
    const l = [...Array.from({ length: 10 }, (_, i) => [i * 10, 0] as const), ...Array.from({ length: 10 }, (_, i) => [90, i * 10 + 10] as const)]
    expect(simplify(l, 1)).toEqual([
      [0, 0],
      [90, 0],
      [90, 100],
    ])
  })

  it("keeps every point when there is no tolerance, and takes the bump out when it is within it", () => {
    const bumpy = [[0, 0], [10, 1], [20, 0]] as const
    expect(simplify(bumpy, 0)).toEqual([[0, 0], [10, 1], [20, 0]])
    expect(simplify(bumpy, 2)).toEqual([[0, 0], [20, 0]])
  })

  it("handles a line that goes out and comes back to where it was", () => {
    const loop = [[0, 0], [50, 50], [0, 0]] as const
    expect(simplify(loop, 1)).toEqual([[0, 0], [50, 50], [0, 0]])
  })

  it("leaves a line of one or two points alone, and does not change the points it is given", () => {
    expect(simplify([], 1)).toEqual([])
    expect(simplify([[3, 4]], 1)).toEqual([[3, 4]])
    expect(simplify([[3, 4], [5, 6]], 99)).toEqual([[3, 4], [5, 6]])
    const given = [[0, 0], [1, 0.1], [2, 0]] as [number, number][]
    const copy = given.map((p) => [...p])
    simplify(given, 5)
    expect(given).toEqual(copy)
  })
})

describe("the stroke a board sends", () => {
  it("takes the pen, puts the points on the grid and thins the line", () => {
    const recorded = Array.from({ length: 100 }, (_, i) => [i / 100, 0.5] as const)
    const stroke = buildStroke(recorded, PEN, THIN)
    expect(stroke.color).toBe(1)
    expect(stroke.width).toBe(2)
    expect(stroke.points).toEqual([0, 500, 990, 500])
  })

  it("is a dot for one place, and for places that are all the same", () => {
    expect(buildStroke([[0.3, 0.7]], PEN, THIN).points).toEqual([300, 700])
    expect(buildStroke([[0.3, 0.7], [0.3, 0.7], [0.3001, 0.7001]], PEN, THIN).points).toEqual([300, 700])
  })

  it("ends where the pen was lifted, even when the last place is close to the one before", () => {
    const stroke = buildStroke([[0.1, 0.1], [0.5, 0.5], [0.5004, 0.5004]], PEN, { ...THIN, tolerance: 0 })
    expect(stroke.points.slice(-2)).toEqual([500, 500])
    const far = buildStroke([[0.1, 0.1], [0.2, 0.2], [0.2005, 0.2], [0.2004, 0.2]], PEN, { ...THIN, tolerance: 0 })
    expect(far.points.length).toBeGreaterThanOrEqual(4)
  })

  it("keeps the corners of what the player drew", () => {
    const square = [[0.1, 0.1], [0.5, 0.1], [0.5, 0.5], [0.1, 0.5], [0.1, 0.1]] as const
    const dense = square.flatMap((point, i) => {
      const next = square[i + 1]
      return next ? Array.from({ length: 20 }, (_, k) => [point[0] + ((next[0] - point[0]) * k) / 20, point[1] + ((next[1] - point[1]) * k) / 20] as const) : [point]
    })
    const stroke = buildStroke(dense, PEN, THIN)
    expect(stroke.points).toEqual([100, 100, 500, 100, 500, 500, 100, 500, 100, 100])
  })

  it("keeps a scribble within the most points a stroke may have, thinning it more until it fits", () => {
    const scribble = Array.from({ length: 2000 }, (_, i) => [0.5 + 0.45 * Math.sin(i * 0.9), 0.5 + 0.45 * Math.cos(i * 1.3)] as const)
    for (const maxPoints of [400, 50, 10, 3, 1]) {
      const stroke = buildStroke(scribble, PEN, { ...THIN, maxPoints })
      expect(stroke.points.length / 2).toBeLessThanOrEqual(maxPoints)
      expect(stroke.points.length).toBeGreaterThanOrEqual(2)
    }
  })

  it("keeps a place that is off the sheet at the edge of it", () => {
    expect(buildStroke([[-0.5, 1.5], [2, -2]], PEN, { ...THIN, tolerance: 0 }).points).toEqual([0, 1000, 1000, 0])
  })

  it("never holds a negative zero", () => {
    const stroke = buildStroke([[-0.0001, -0.0001], [0.0001, 0.0001]], PEN, { ...THIN, spacing: 0, tolerance: 0 })
    for (const value of stroke.points) expect(Object.is(value, -0)).toBe(false)
  })

  it("is a stroke the engine accepts with the same rules, whatever the pen did", () => {
    // The contract between the two packages: what the table sends is what `cleanStroke` lets through
    const wander = Array.from({ length: 600 }, (_, i) => [0.5 + 0.6 * Math.sin(i * 0.37), 0.5 + 0.6 * Math.cos(i * 0.21)] as const)
    for (const recorded of [[[0.2, 0.2]], [[0, 0], [1, 1]], wander, [[0.5, 0.5], [0.5, 0.5]]] as const) {
      for (const strokePoints of [400, 20, 2]) {
        const stroke = buildStroke(recorded, { color: 3, width: 2 }, { ...THIN, maxPoints: strokePoints })
        expect(() => cleanStroke(stroke, { ...RULES, strokePoints })).not.toThrow()
        expect(cleanStroke(stroke, { ...RULES, strokePoints })).toEqual(stroke)
      }
    }
  })
})
