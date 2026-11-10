import { describe, expect, it } from "vitest"
import { hexCells, squareCells } from "../board/cells"
import { areaOf, cellShape, centreOf, circleShape, contains, insetOf, outlineOf, polygonShape, rectShape } from "./shapes"

describe("the shapes of a zone", () => {
  it("refuses a shape that cannot be one", () => {
    expect(() => circleShape(0, 0, 0)).toThrow(RangeError)
    expect(() => circleShape(Number.NaN, 0, 1)).toThrow(RangeError)
    expect(() => rectShape(0, 0, 0, 2)).toThrow(RangeError)
    expect(() => rectShape(0, 0, 2, 2, { radius: 1.5 })).toThrow(RangeError)
    expect(() => rectShape(0, 0, 2, 2, { radius: -1 })).toThrow(RangeError)
    expect(() => polygonShape([[0, 0], [1, 1]])).toThrow(RangeError)
    expect(() => polygonShape([[0, 0], [1, 1], [Number.NaN, 2]])).toThrow(RangeError)
  })

  it("leaves out what is plain", () => {
    expect(rectShape(1, 2, 3, 4)).toEqual({ type: "rect", x: 1, z: 2, width: 3, depth: 4 })
    expect(rectShape(1, 2, 3, 4, { yaw: 0.5, radius: 1 })).toEqual({ type: "rect", x: 1, z: 2, width: 3, depth: 4, yaw: 0.5, radius: 1 })
  })
})

describe("whether a point is on a shape", () => {
  it("holds the points of a circle, its edge included", () => {
    const shape = circleShape(2, -1, 1.5)
    expect(contains(shape, 2, -1)).toBe(true)
    expect(contains(shape, 3.5, -1)).toBe(true)
    expect(contains(shape, 3.6, -1)).toBe(false)
    expect(contains(shape, 2 + 1.1, -1 + 1.1)).toBe(false)
  })

  it("holds the points of a rectangle", () => {
    const shape = rectShape(0, 0, 4, 2)
    expect(contains(shape, 1.9, 0.9)).toBe(true)
    expect(contains(shape, 2.1, 0)).toBe(false)
    expect(contains(shape, 0, -1.1)).toBe(false)
  })

  it("turns a rectangle with its yaw, the way every place of the table turns", () => {
    // A long rectangle along x, turned a quarter: it lies along -z (a Three rotation about y by a quarter takes +x to -z)
    const shape = rectShape(0, 0, 6, 1, { yaw: Math.PI / 2 })
    expect(contains(shape, 0, -2.9)).toBe(true)
    expect(contains(shape, 0, 2.9)).toBe(true)
    expect(contains(shape, 2.9, 0)).toBe(false)
    // Not a quarter: the middle of its far end is toward the point the yaw says
    const eighth = rectShape(0, 0, 6, 1, { yaw: Math.PI / 4 })
    expect(contains(eighth, 2, -2)).toBe(true)
    expect(contains(eighth, 2, 2)).toBe(false)
  })

  it("rounds the corners of a rectangle", () => {
    const shape = rectShape(0, 0, 4, 4, { radius: 1 })
    expect(contains(shape, 1.9, 1.9)).toBe(false)
    expect(contains(shape, 1.5, 1.5)).toBe(true)
    expect(contains(shape, 0, 1.99)).toBe(true)
    expect(contains(shape, 1.99, 0)).toBe(true)
  })

  it("holds the points of a polygon, a notch not filled", () => {
    const l = polygonShape([
      [0, 0],
      [4, 0],
      [4, 1],
      [1, 1],
      [1, 4],
      [0, 4],
    ])
    expect(contains(l, 0.5, 3)).toBe(true)
    expect(contains(l, 3, 0.5)).toBe(true)
    expect(contains(l, 3, 3)).toBe(false)
    expect(contains(l, -0.1, 0.5)).toBe(false)
  })

  it("holds the points of a cell of a board, and only of that cell", () => {
    const cells = squareCells([[0, 0], [1, 0], [0, 1]], { size: 1, gap: 0.1, at: { x: 0, z: 0 } })
    const shapes = cells.map(cellShape)
    const [first, second, third] = [cells[0]!, cells[1]!, cells[2]!]
    expect(contains(shapes[0]!, first.x, first.z)).toBe(true)
    expect(contains(shapes[1]!, first.x, first.z)).toBe(false)
    expect(contains(shapes[1]!, second.x + 0.3, second.z - 0.3)).toBe(true)
    expect(contains(shapes[2]!, third.x, third.z + 0.4)).toBe(true)
    // The gap between two cells is on neither
    expect(shapes.some((shape) => contains(shape, (first.x + second.x) / 2, first.z))).toBe(false)
  })

  it("holds the points of a hexagon", () => {
    const [cell] = hexCells([[0, 0]], { size: 2, gap: 0 })
    const shape = cellShape(cell!)
    expect(contains(shape, 0, 0)).toBe(true)
    expect(contains(shape, 0.9, 0)).toBe(true)
    expect(contains(shape, 1.2, 0)).toBe(false)
  })
})

describe("the size and the middle of a shape", () => {
  it("measures the area", () => {
    expect(areaOf(circleShape(0, 0, 2))).toBeCloseTo(4 * Math.PI, 10)
    expect(areaOf(rectShape(0, 0, 3, 2))).toBe(6)
    expect(areaOf(rectShape(0, 0, 4, 4, { radius: 1 }))).toBeCloseTo(16 - (4 - Math.PI), 10)
    expect(areaOf(polygonShape([[0, 0], [4, 0], [0, 3]]))).toBe(6)
    // Either way round
    expect(areaOf(polygonShape([[0, 3], [4, 0], [0, 0]]))).toBe(6)
  })

  it("finds the middle", () => {
    expect(centreOf(circleShape(3, 4, 1))).toEqual([3, 4])
    expect(centreOf(rectShape(-1, 2, 5, 1))).toEqual([-1, 2])
    const [x, z] = centreOf(polygonShape([[0, 0], [4, 0], [4, 2], [0, 2]]))
    expect(x).toBeCloseTo(2, 10)
    expect(z).toBeCloseTo(1, 10)
    const [tx, tz] = centreOf(polygonShape([[0, 0], [3, 0], [0, 3]]))
    expect(tx).toBeCloseTo(1, 10)
    expect(tz).toBeCloseTo(1, 10)
  })

  it("takes the average of the corners of a polygon with no area", () => {
    expect(centreOf(polygonShape([[0, 0], [1, 1], [2, 2]]))).toEqual([1, 1])
  })
})

describe("the edge of a shape", () => {
  const clockwise = (points: readonly (readonly [number, number])[]) => {
    let twice = 0
    points.forEach(([x, z], i) => {
      const [nx, nz] = points[(i + 1) % points.length]!
      twice += x * nz - nx * z
    })
    return twice > 0
  }

  it("goes round a circle clockwise seen from above, every point on it", () => {
    const points = outlineOf(circleShape(1, 2, 3))
    expect(clockwise(points)).toBe(true)
    for (const [x, z] of points) expect(Math.hypot(x - 1, z - 2)).toBeCloseTo(3, 10)
  })

  it("goes round a rectangle from its top left, turned by its yaw", () => {
    const points = outlineOf(rectShape(0, 0, 4, 2))
    expect(points).toHaveLength(4)
    expect(clockwise(points)).toBe(true)
    expect(points[0]).toEqual([-2, -1])
    expect(points[2]).toEqual([2, 1])
    const turned = outlineOf(rectShape(0, 0, 4, 2, { yaw: Math.PI / 2 }))
    // The far end along x went to -z, and the top left corner to the bottom left
    expect(turned[0]![0]).toBeCloseTo(-1, 10)
    expect(turned[0]![1]).toBeCloseTo(2, 10)
    expect(clockwise(turned)).toBe(true)
  })

  it("rounds the corners of a rectangle, no point farther out than the rectangle", () => {
    const points = outlineOf(rectShape(0, 0, 4, 4, { radius: 1 }))
    expect(points.length).toBeGreaterThan(4)
    expect(clockwise(points)).toBe(true)
    // Every point is on a straight side, or on the arc of a corner, a circle of radius 1 round (1, 1)
    for (const [x, z] of points) {
      const [ax, az] = [Math.abs(x), Math.abs(z)]
      const side = (Math.abs(ax - 2) < 1e-9 && az <= 1 + 1e-9) || (Math.abs(az - 2) < 1e-9 && ax <= 1 + 1e-9)
      const arc = ax >= 1 - 1e-9 && az >= 1 - 1e-9 && Math.abs(Math.hypot(ax - 1, az - 1) - 1) < 1e-9
      expect(side || arc).toBe(true)
    }
    // The corner of the rectangle itself is cut off
    expect(points.some(([x, z]) => x > 1.99 && z > 1.99)).toBe(false)
  })

  it("keeps a polygon's own points, turned clockwise when it was given the other way", () => {
    const given = [[0, 0], [0, 2], [2, 2], [2, 0]] as const
    const points = outlineOf(polygonShape(given))
    expect(clockwise(points)).toBe(true)
    expect(points).toHaveLength(4)
    expect(outlineOf(polygonShape([...given].reverse()))).toEqual(points)
  })
})

describe("the inside of a polygon", () => {
  it("moves a square's corners toward its middle by the width of the band", () => {
    const inner = insetOf([[-2, -2], [2, -2], [2, 2], [-2, 2]], 0.5)
    expect(inner).toEqual([[-1.5, -1.5], [1.5, -1.5], [1.5, 1.5], [-1.5, 1.5]])
  })

  it("does the same for a square listed the other way round", () => {
    const inner = insetOf([[-2, 2], [2, 2], [2, -2], [-2, -2]], 0.5)
    expect(inner).toEqual([[-1.5, 1.5], [1.5, 1.5], [1.5, -1.5], [-1.5, -1.5]])
  })

  it("keeps the band the same width along every side of a hexagon", () => {
    const [cell] = hexCells([[0, 0]], { size: 2 })
    const outer = outlineOf(cellShape(cell!))
    const inner = insetOf(outer, 0.2)
    // The distance of an inner side from its outer side is the width of the band
    outer.forEach(([x, z], i) => {
      const [nx, nz] = outer[(i + 1) % outer.length]!
      const [ix, iz] = inner[i]!
      const [dx, dz] = [nx - x, nz - z]
      const length = Math.hypot(dx, dz)
      expect(Math.abs(((ix - x) * dz - (iz - z) * dx) / length)).toBeCloseTo(0.2, 6)
    })
  })

  it("never moves a corner of a very sharp triangle off by a wild distance", () => {
    const inner = insetOf([[0, 0], [10, 0.2], [10, -0.2]], 0.1)
    for (const [x, z] of inner) {
      expect(Math.abs(x)).toBeLessThan(11)
      expect(Math.abs(z)).toBeLessThan(1)
    }
  })
})
