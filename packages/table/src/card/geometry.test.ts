import type { BufferGeometry } from "three"
import { describe, expect, it } from "vitest"
import { cardGeometry, cornerRadius, edgeGeometry, frameGeometry } from "./geometry"

/** Vertices are 32-bit floats: compare to about seven digits */
const DIGITS = 6

const box = (geo: BufferGeometry) => {
  geo.computeBoundingBox()
  return geo.boundingBox!
}

const expectPoint = (actual: number[], expected: number[]) => {
  expect(actual).toHaveLength(expected.length)
  expected.forEach((value, i) => expect(actual[i]).toBeCloseTo(value, DIGITS))
}

/** How far a point is from a rounded rectangle centred on the origin: negative inside it, positive outside */
function distanceToCard(x: number, y: number, halfWidth: number, halfHeight: number, radius: number) {
  const qx = Math.abs(x) - (halfWidth - radius)
  const qy = Math.abs(y) - (halfHeight - radius)
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius
}

describe("cornerRadius", () => {
  it("is 6% of the smaller side unless the game sets its own", () => {
    expect(cornerRadius({ width: 1.3, height: 1.9 })).toBeCloseTo(0.078, 12)
    expect(cornerRadius({ width: 2, height: 1 })).toBeCloseTo(0.06, 12)
    expect(cornerRadius({ width: 1.3, height: 1.9, radius: 0.2 })).toBe(0.2)
    expect(cornerRadius({ width: 1.3, height: 1.9, radius: 0 })).toBe(0)
  })
})

describe("cardGeometry", () => {
  it("is one geometry per size, shared by every card", () => {
    expect(cardGeometry(1.3, 1.9)).toBe(cardGeometry(1.3, 1.9))
    expect(cardGeometry(1.3, 1.9)).not.toBe(cardGeometry(1.3, 1.9, 0.2))
    expect(cardGeometry(1.3, 1.9)).not.toBe(cardGeometry(1.4, 1.9))
  })

  it("is centred on the origin, in the XY plane, as wide and high as asked", () => {
    const b = box(cardGeometry(1.3, 1.9))
    expectPoint(b.min.toArray(), [-0.65, -0.95, 0])
    expectPoint(b.max.toArray(), [0.65, 0.95, 0])
  })

  it("lays the picture edge to edge: the UVs run from 0 to 1 both ways", () => {
    const geo = cardGeometry(1.3, 1.9)
    const pos = geo.attributes.position!
    const uv = geo.attributes.uv!
    let lowU = 1
    let highU = 0
    let lowV = 1
    let highV = 0
    for (let i = 0; i < uv.count; i++) {
      expect(uv.getX(i)).toBeCloseTo((pos.getX(i) + 0.65) / 1.3, DIGITS)
      expect(uv.getY(i)).toBeCloseTo((pos.getY(i) + 0.95) / 1.9, DIGITS)
      lowU = Math.min(lowU, uv.getX(i))
      highU = Math.max(highU, uv.getX(i))
      lowV = Math.min(lowV, uv.getY(i))
      highV = Math.max(highV, uv.getY(i))
    }
    expectPoint([lowU, highU, lowV, highV], [0, 1, 0, 1])
  })

  it("rounds the corners: no vertex sits on the square's corner", () => {
    const geo = cardGeometry(1.3, 1.9)
    const pos = geo.attributes.position!
    for (let i = 0; i < pos.count; i++) expect(Math.abs(pos.getX(i)) === 0.65 && Math.abs(pos.getY(i)) === 0.95).toBe(false)
  })
})

describe("edgeGeometry", () => {
  it("extrudes the card's shape from z = 0 to its thickness, in two groups: the caps and the rim", () => {
    const geo = edgeGeometry(1.3, 1.9, 0.0065)
    const b = box(geo)
    expect(b.min.z).toBeCloseTo(0, DIGITS)
    expect(b.max.z).toBeCloseTo(0.0065, DIGITS)
    expect(b.max.x).toBeCloseTo(0.65, DIGITS)
    expect(geo.groups.map((g) => g.materialIndex)).toEqual([0, 1])
  })

  it("is one geometry per size and thickness", () => {
    expect(edgeGeometry(1.3, 1.9, 0.0065)).toBe(edgeGeometry(1.3, 1.9, 0.0065))
    expect(edgeGeometry(1.3, 1.9, 0.0065)).not.toBe(edgeGeometry(1.3, 1.9, 0.01))
  })
})

describe("frameGeometry", () => {
  it("is a ring `gap` away from the card's edge and `thickness` wide", () => {
    const geo = frameGeometry(1.3, 1.9, 0.07, 0.03)
    const b = box(geo)
    expect(b.max.x).toBeCloseTo(0.65 + 0.07 + 0.03, DIGITS)
    expect(b.max.y).toBeCloseTo(0.95 + 0.07 + 0.03, DIGITS)
    // The hole: nothing of the ring lies over the card or in the gap
    const pos = geo.attributes.position!
    const radius = cornerRadius({ width: 1.3, height: 1.9 })
    for (let i = 0; i < pos.count; i++) expect(distanceToCard(pos.getX(i), pos.getY(i), 0.65, 0.95, radius)).toBeGreaterThanOrEqual(0.07 - 1e-5)
  })

  it("is one geometry per ring", () => {
    expect(frameGeometry(1.3, 1.9, 0.07, 0.03)).toBe(frameGeometry(1.3, 1.9, 0.07, 0.03))
    expect(frameGeometry(1.3, 1.9, 0.07, 0.03)).not.toBe(frameGeometry(1.3, 1.9, 0.07, 0.03, 0.2))
  })
})
