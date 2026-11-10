import { describe, expect, it } from "vitest"
import { D6_NORMALS, pipPositions } from "./faces"

const VALUES = [1, 2, 3, 4, 5, 6]

describe("the faces of the six-sided die", () => {
  it("has six sides, each looking along an axis, all different", () => {
    expect(D6_NORMALS).toHaveLength(6)
    for (const face of D6_NORMALS) expect(face.length()).toBeCloseTo(1, 12)
    expect(new Set(D6_NORMALS.map((face) => face.toArray().join(","))).size).toBe(6)
  })

  it("puts opposite faces at seven", () => {
    for (const value of [1, 2, 3]) {
      const face = D6_NORMALS[value - 1]!
      const opposite = D6_NORMALS[7 - value - 1]!
      expect(face.clone().add(opposite).length()).toBeCloseTo(0, 12)
    }
  })

  it("runs 1, 2, 3 counterclockwise round their corner, like a western die", () => {
    const [one, two, three] = [D6_NORMALS[0]!, D6_NORMALS[1]!, D6_NORMALS[2]!]
    expect(one.clone().cross(two).dot(three)).toBeGreaterThan(0)
  })
})

describe("pipPositions", () => {
  it("has as many pips as the value", () => {
    for (const value of VALUES) expect(pipPositions(value)).toHaveLength(value)
  })

  it("reads a value outside the die as the nearest face, and a number it cannot read as 1", () => {
    expect(pipPositions(0)).toHaveLength(1)
    expect(pipPositions(9)).toHaveLength(6)
    expect(pipPositions(3.4)).toHaveLength(3)
    expect(pipPositions(Number.NaN)).toHaveLength(1)
  })

  it("keeps every pip inside the face, apart from the others", () => {
    for (const value of VALUES) {
      const pips = pipPositions(value)
      for (const [x, y] of pips) {
        expect(x).toBeGreaterThan(0.15)
        expect(x).toBeLessThan(0.85)
        expect(y).toBeGreaterThan(0.15)
        expect(y).toBeLessThan(0.85)
      }
      for (let i = 0; i < pips.length; i++) {
        for (let j = i + 1; j < pips.length; j++) expect(Math.hypot(pips[i]![0] - pips[j]![0], pips[i]![1] - pips[j]![1])).toBeGreaterThan(0.2)
      }
    }
  })

  it("is turned half a turn onto itself, the way a die looks when it is upside down", () => {
    for (const value of VALUES) {
      const pips = pipPositions(value).map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).sort()
      const turned = pipPositions(value).map(([x, y]) => `${(1 - x).toFixed(2)},${(1 - y).toFixed(2)}`).sort()
      expect(turned).toEqual(pips)
    }
  })
})
