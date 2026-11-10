import { type BufferGeometry, Vector3 } from "three"
import { describe, expect, it } from "vitest"
import { BAG_FOLDS, BAG_HEIGHT, BAG_MOUTH, BAG_OUTSIDE_POINTS, BAG_PROFILE, BAG_WAVES, bagGeometry, bagMouth, clampFill, SLUMP } from "./geometry"
import { BAG_SIZE } from "./settings"

function vertices(geometry: BufferGeometry) {
  const [position, normal, tint] = [geometry.getAttribute("position"), geometry.getAttribute("normal"), geometry.getAttribute("tint")]
  return Array.from({ length: position.count }, (_, i) => ({ at: new Vector3().fromBufferAttribute(position, i), normal: new Vector3().fromBufferAttribute(normal, i), tint: tint.getX(i) }))
}

describe("the profile of a bag", () => {
  it("starts and ends on the axis, so the lathe closes the bottom and the inside of the mouth", () => {
    expect(BAG_PROFILE[0]![0]).toBe(0)
    expect(BAG_PROFILE[BAG_PROFILE.length - 1]![0]).toBe(0)
  })

  it("has no two points in the same place one after the other", () => {
    BAG_PROFILE.forEach(([radius, height], i) => {
      const [nextRadius, nextHeight] = BAG_PROFILE[i + 1] ?? [Number.NaN, Number.NaN]
      expect(radius === nextRadius && height === nextHeight, `point ${i}`).toBe(false)
    })
  })

  it("stands on the table, its belly one unit across and its rim at its height", () => {
    expect(Math.min(...BAG_PROFILE.map(([, height]) => height))).toBe(0)
    expect(Math.max(...BAG_PROFILE.map(([radius]) => radius))).toBe(0.5)
    expect(Math.max(...BAG_PROFILE.map(([, height]) => height))).toBe(BAG_HEIGHT)
  })

  it("has a neck that is narrower than its belly, and a mouth that flares out again", () => {
    const radiusAt = (index: number) => BAG_PROFILE[index]![0]
    expect(radiusAt(9)).toBeLessThan(radiusAt(4) / 2)
    expect(radiusAt(15)).toBeGreaterThan(radiusAt(9) * 1.5)
  })

  it("has its mouth below its rim: what comes out comes out of the opening", () => {
    expect(BAG_MOUTH).toBeLessThanOrEqual(BAG_HEIGHT)
    expect(BAG_MOUTH).toBeGreaterThan(1)
  })
})

describe("bagGeometry", () => {
  it("is as wide as the size across its belly and as high as the size makes it, standing on y = 0", () => {
    for (const size of [1, 1.8, 3]) {
      const geometry = bagGeometry(size)
      geometry.computeBoundingBox()
      const { min, max } = geometry.boundingBox!
      expect(max.x).toBeCloseTo(size / 2, 4)
      expect(min.y).toBeCloseTo(0, 6)
      expect(max.y).toBeCloseTo(BAG_HEIGHT * size, 6)
    }
  })

  it("makes every triangle face the way its normals say, so that no cloth is drawn from behind", () => {
    const geometry = bagGeometry(1)
    const [position, normal, index] = [geometry.getAttribute("position"), geometry.getAttribute("normal"), geometry.getIndex()!]
    const [a, b, c, ab, ac, n] = [new Vector3(), new Vector3(), new Vector3(), new Vector3(), new Vector3(), new Vector3()]
    let checked = 0
    for (let t = 0; t < index.count; t += 3) {
      const [ia, ib, ic] = [index.getX(t), index.getX(t + 1), index.getX(t + 2)]
      a.fromBufferAttribute(position, ia)
      b.fromBufferAttribute(position, ib)
      c.fromBufferAttribute(position, ic)
      const face = ab.subVectors(b, a).cross(ac.subVectors(c, a))
      if (face.length() < 1e-9) continue
      n.fromBufferAttribute(normal, ia).add(new Vector3().fromBufferAttribute(normal, ib)).add(new Vector3().fromBufferAttribute(normal, ic))
      expect(face.dot(n), `triangle ${t / 3}`).toBeGreaterThan(0)
      checked++
    }
    expect(checked).toBeGreaterThan(500)
  })

  it("faces the belly away from the axis and the inside of the mouth toward it", () => {
    const vs = vertices(bagGeometry(1))
    const belly = vs.filter((vertex) => vertex.tint === 1 && vertex.at.y > 0.12 && vertex.at.y < 0.6)
    expect(belly.length).toBeGreaterThan(100)
    for (const { at, normal } of belly) expect(at.x * normal.x + at.z * normal.z).toBeGreaterThan(0)
    const mouth = vs.filter((vertex) => vertex.tint < 0.5 && vertex.at.y > 0.9 && Math.hypot(vertex.at.x, vertex.at.z) > 0.05)
    expect(mouth.length).toBeGreaterThan(50)
    for (const { at, normal } of mouth) expect(at.x * normal.x + at.z * normal.z).toBeLessThan(0)
  })

  it("tints the dark of the mouth and the cord of the neck darker than the cloth", () => {
    const tints = new Set(vertices(bagGeometry(1)).map((vertex) => vertex.tint))
    expect([...tints].map((tint) => Math.round(tint * 100) / 100).sort()).toEqual([0.4, 0.7, 1])
    const points = BAG_PROFILE.length
    const inside = vertices(bagGeometry(1)).filter((vertex) => vertex.tint === Math.fround(0.4))
    expect(inside).toHaveLength(49 * (points - BAG_OUTSIDE_POINTS))
  })
})

describe("the folds of a bag", () => {
  it("has an amplitude for every point of the profile, none on the belly and the most at the rim", () => {
    expect(BAG_WAVES).toHaveLength(BAG_PROFILE.length)
    expect(BAG_WAVES.slice(0, 10).every((wave) => wave === 0)).toBe(true)
    expect(Math.max(...BAG_WAVES)).toBe(BAG_WAVES[15])
  })

  it("waves the radius round the neck and the mouth, as many times as there are folds, and leaves the belly round", () => {
    const radiusAt = (point: number) => {
      const geometry = bagGeometry(1)
      const position = geometry.getAttribute("position")
      return Array.from({ length: 49 }, (_, turn) => Math.hypot(position.getX(turn * BAG_PROFILE.length + point), position.getZ(turn * BAG_PROFILE.length + point)))
    }
    const belly = radiusAt(4)
    expect(Math.max(...belly) - Math.min(...belly)).toBeLessThan(1e-6)
    const rim = radiusAt(15)
    expect(Math.max(...rim) - Math.min(...rim)).toBeGreaterThan(0.05)
    // The radius goes up and down once for each fold: count the times it crosses its mean
    const mean = rim.reduce((sum, radius) => sum + radius, 0) / rim.length
    let crossings = 0
    for (let i = 1; i < rim.length; i++) if (rim[i - 1]! < mean !== rim[i]! < mean) crossings++
    expect(Math.abs(crossings - 2 * BAG_FOLDS)).toBeLessThanOrEqual(1)
  })

  it("closes the seam: the first turn and the last are in the same places and face the same way", () => {
    const geometry = bagGeometry(1)
    const [position, normal] = [geometry.getAttribute("position"), geometry.getAttribute("normal")]
    const points = BAG_PROFILE.length
    for (let point = 0; point < points; point++) {
      const last = 48 * points + point
      expect(position.getX(point)).toBeCloseTo(position.getX(last), 5)
      expect(position.getZ(point)).toBeCloseTo(position.getZ(last), 5)
      expect(normal.getX(point)).toBeCloseTo(normal.getX(last), 9)
      expect(normal.getY(point)).toBeCloseTo(normal.getY(last), 9)
      expect(normal.getZ(point)).toBeCloseTo(normal.getZ(last), 9)
    }
  })

  it("keeps the normals of unit length", () => {
    const normal = bagGeometry(1).getAttribute("normal")
    for (let i = 0; i < normal.count; i++) expect(Math.hypot(normal.getX(i), normal.getY(i), normal.getZ(i))).toBeCloseTo(1, 5)
  })
})

describe("bagMouth", () => {
  it("is where the bag stands, at the height of the rim of its mouth when it is full", () => {
    const mouth = bagMouth({ x: 2, z: -1 }, 2)
    expect(mouth.x).toBe(2)
    expect(mouth.z).toBe(-1)
    expect(mouth.y).toBeCloseTo(BAG_MOUTH * 2, 12)
  })

  it("is lower when the bag has slumped, down to the fraction of its height an empty one keeps", () => {
    expect(bagMouth({ x: 0, z: 0 }, 2, 0).y).toBeCloseTo(BAG_MOUTH * 2 * SLUMP, 12)
    expect(bagMouth({ x: 0, z: 0 }, 2, 0.5).y).toBeLessThan(bagMouth({ x: 0, z: 0 }, 2, 1).y)
    expect(bagMouth({ x: 0, z: 0 }, 2, 0.5).y).toBeGreaterThan(bagMouth({ x: 0, z: 0 }, 2, 0).y)
  })

  it("takes a bag that is fuller than full, emptier than empty or of no number for what it can be", () => {
    expect(bagMouth({ x: 0, z: 0 }, 2, 5).y).toBe(bagMouth({ x: 0, z: 0 }, 2, 1).y)
    expect(bagMouth({ x: 0, z: 0 }, 2, -3).y).toBe(bagMouth({ x: 0, z: 0 }, 2, 0).y)
    expect(bagMouth({ x: 0, z: 0 }, 2, Number.NaN).y).toBe(bagMouth({ x: 0, z: 0 }, 2, 1).y)
  })

  it("has a size of its own when none is given", () => {
    expect(bagMouth({ x: 0, z: 0 }).y).toBeCloseTo(BAG_MOUTH * BAG_SIZE, 12)
  })
})

describe("clampFill", () => {
  it("keeps a fill between nothing and everything", () => {
    expect([clampFill(-1), clampFill(0.3), clampFill(7), clampFill(Number.POSITIVE_INFINITY)]).toEqual([0, 0.3, 1, 1])
  })
})
