import { describe, expect, it } from "vitest"
import { area, fitOutline, type Outline, reach, regularOutline, roundedOutline } from "./outline"

const box = (outline: Outline) => {
  const xs = outline.map((p) => p[0])
  const ys = outline.map((p) => p[1])
  return { left: Math.min(...xs), right: Math.max(...xs), bottom: Math.min(...ys), top: Math.max(...ys) }
}

describe("area", () => {
  it("is positive counterclockwise and negative clockwise", () => {
    const square: Outline = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ]
    expect(area(square)).toBe(1)
    expect(area([...square].reverse())).toBe(-1)
  })
})

describe("regularOutline", () => {
  it("fits a box one unit wide, centred, counterclockwise, for any number of sides", () => {
    for (const sides of [3, 4, 5, 6, 8, 12, 48]) {
      const outline = regularOutline(sides)
      expect(outline).toHaveLength(sides)
      expect(area(outline)).toBeGreaterThan(0)
      const b = box(outline)
      expect(Math.max(b.right - b.left, b.top - b.bottom)).toBeCloseTo(1, 9)
      expect((b.left + b.right) / 2).toBeCloseTo(0, 9)
      expect((b.top + b.bottom) / 2).toBeCloseTo(0, 9)
    }
  })

  it("is a hexagon with an edge on top at a turn of zero and a corner on top at a sixth of a half turn", () => {
    const flat = box(regularOutline(6))
    expect(flat.right - flat.left).toBeCloseTo(1, 9)
    expect(flat.top - flat.bottom).toBeCloseTo(Math.sqrt(3) / 2, 9)
    const pointy = box(regularOutline(6, Math.PI / 6))
    expect(pointy.top - pointy.bottom).toBeCloseTo(1, 9)
    expect(pointy.right - pointy.left).toBeCloseTo(Math.sqrt(3) / 2, 9)
  })

  it("is a square standing on an edge at a quarter turn, with sides of one unit", () => {
    const square = regularOutline(4, Math.PI / 4)
    const b = box(square)
    expect(b.right - b.left).toBeCloseTo(1, 9)
    expect(b.top - b.bottom).toBeCloseTo(1, 9)
    expect(area(square)).toBeCloseTo(1, 9)
  })

  it("is nearly a disc with many sides: its area is close to that of the circle of diameter one", () => {
    expect(area(regularOutline(96))).toBeCloseTo(Math.PI / 4, 2)
  })

  it("refuses fewer than three sides", () => {
    expect(() => regularOutline(2)).toThrow(RangeError)
    expect(() => regularOutline(3.5)).toThrow(RangeError)
  })
})

describe("fitOutline", () => {
  const meeple: Outline = [
    [10, 0],
    [14, 0],
    [14, 10],
    [18, 12],
    [12, 24],
    [8, 12],
    [10, 10],
  ]

  it("scales a drawing of any size and place to one unit, centred", () => {
    const fitted = fitOutline(meeple)
    const b = box(fitted)
    expect(Math.max(b.right - b.left, b.top - b.bottom)).toBeCloseTo(1, 9)
    expect((b.left + b.right) / 2).toBeCloseTo(0, 9)
    expect((b.top + b.bottom) / 2).toBeCloseTo(0, 9)
  })

  it("keeps the proportions of the drawing", () => {
    const b = box(fitOutline(meeple))
    expect((b.right - b.left) / (b.top - b.bottom)).toBeCloseTo(10 / 24, 9)
  })

  it("turns a clockwise outline counterclockwise, and leaves a counterclockwise one in order", () => {
    expect(area(fitOutline([...meeple].reverse()))).toBeGreaterThan(0)
    expect(fitOutline(meeple)[0]).toEqual([(10 - 13) / 24, (0 - 12) / 24])
  })

  it("is the same whatever the scale of the drawing", () => {
    const big = meeple.map(([x, y]) => [x * 100, y * 100] as const)
    const a = fitOutline(meeple)
    const b = fitOutline(big)
    a.forEach((point, i) => {
      expect(point[0]).toBeCloseTo(b[i]![0], 9)
      expect(point[1]).toBeCloseTo(b[i]![1], 9)
    })
  })

  it("refuses an outline that has no area to speak of", () => {
    expect(() => fitOutline([[0, 0], [1, 1]])).toThrow(RangeError)
    expect(() => fitOutline([[2, 2], [2, 2], [2, 2]])).toThrow(RangeError)
  })
})

describe("roundedOutline", () => {
  const square = regularOutline(4, Math.PI / 4)

  it("has more corners, stays inside the box and keeps going counterclockwise", () => {
    const rounded = roundedOutline(square, 0.1)
    expect(rounded.length).toBeGreaterThan(square.length)
    const b = box(rounded)
    expect(b.left).toBeGreaterThanOrEqual(-0.5 - 1e-9)
    expect(b.right).toBeLessThanOrEqual(0.5 + 1e-9)
    expect(area(rounded)).toBeGreaterThan(0)
  })

  it("is a little smaller than what it rounds, and the more so the larger the radius", () => {
    const a = area(roundedOutline(square, 0.05))
    const b = area(roundedOutline(square, 0.2))
    expect(a).toBeLessThan(1)
    expect(b).toBeLessThan(a)
  })

  it("leaves an outline as it is when the radius is zero", () => {
    expect(roundedOutline(square, 0)).toBe(square)
  })

  it("never cuts more than half an edge", () => {
    const rounded = roundedOutline(square, 5)
    for (const [x, y] of rounded) expect(Math.max(Math.abs(x), Math.abs(y))).toBeLessThanOrEqual(0.5 + 1e-9)
  })
})

describe("reach", () => {
  it("is the distance of the farthest corner from the middle", () => {
    expect(reach(regularOutline(48))).toBeCloseTo(0.5, 6)
    expect(reach(regularOutline(4, Math.PI / 4))).toBeCloseTo(Math.SQRT1_2, 9)
  })
})
