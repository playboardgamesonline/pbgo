import { describe, expect, it } from "vitest"
import { CROWN_SHAPE, crownGeometry, crownHeightAt } from "./crown-geometry"

describe("crownHeightAt", () => {
  const span = (Math.PI * 2) / CROWN_SHAPE.points

  it("rises to the peak at the middle of each span and falls to the valley between two", () => {
    for (let i = 0; i < CROWN_SHAPE.points; i++) {
      expect(crownHeightAt(span * (i + 0.5))).toBeCloseTo(CROWN_SHAPE.peak, 6)
      expect(crownHeightAt(span * i)).toBeCloseTo(CROWN_SHAPE.valley, 6)
    }
  })

  it("stays between the valley and the peak all the way around", () => {
    for (let a = 0; a < Math.PI * 2; a += 0.01) {
      const h = crownHeightAt(a)
      expect(h).toBeGreaterThanOrEqual(CROWN_SHAPE.valley - 1e-9)
      expect(h).toBeLessThanOrEqual(CROWN_SHAPE.peak + 1e-9)
    }
  })
})

describe("crownGeometry", () => {
  const geometry = crownGeometry()
  const position = geometry.getAttribute("position")
  const normal = geometry.getAttribute("normal")

  it("stands on y = 0 and is one unit tall", () => {
    geometry.computeBoundingBox()
    expect(geometry.boundingBox!.min.y).toBeCloseTo(0, 6)
    expect(geometry.boundingBox!.max.y).toBeCloseTo(CROWN_SHAPE.peak, 2)
  })

  it("is closed: every edge is shared by two triangles", () => {
    const index = geometry.getIndex()!.array
    const edges = new Map<string, number>()
    for (let i = 0; i < index.length; i += 3) {
      for (let j = 0; j < 3; j++) {
        const a = index[i + j]!
        const b = index[i + ((j + 1) % 3)]!
        const key = a < b ? `${a}-${b}` : `${b}-${a}`
        edges.set(key, (edges.get(key) ?? 0) + 1)
      }
    }
    expect([...edges.values()].every((n) => n === 2)).toBe(true)
  })

  it("faces outward: the outside of the wall looks away from the axis, the inside toward it", () => {
    let outward = 0
    let inward = 0
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i)
      const z = position.getZ(i)
      const y = position.getY(i)
      const radial = Math.hypot(x, z)
      const middle = CROWN_SHAPE.radius * (1 + CROWN_SHAPE.flare * y)
      // only the straight sides of the wall, away from the rounded foot and top
      if (y < 0.2 || y > CROWN_SHAPE.valley - 0.1) continue
      const along = (normal.getX(i) * x + normal.getZ(i) * z) / radial
      if (radial > middle + 1e-6) {
        expect(along).toBeGreaterThan(0.9)
        outward++
      } else if (radial < middle - 1e-6) {
        expect(along).toBeLessThan(-0.9)
        inward++
      }
    }
    expect(outward).toBeGreaterThan(0)
    expect(inward).toBeGreaterThan(0)
  })
})
