import { type BufferGeometry, Quaternion, Vector3 } from "three"
import { describe, expect, it } from "vitest"
import { CUP_HEIGHT, CUP_INSIDE_POINTS, CUP_PROFILE, cupGeometry, INSIDE_TINT, litLathe, shadeLathe } from "./geometry"

/** A tint as the graphics card has it: a 32-bit number */
const INSIDE = Math.fround(INSIDE_TINT)

/** The vertices of a geometry: where each is, which way it faces, and its tint */
function vertices(geometry: BufferGeometry) {
  const [position, normal, tint] = [geometry.getAttribute("position"), geometry.getAttribute("normal"), geometry.getAttribute("tint")]
  return Array.from({ length: position.count }, (_, i) => ({ at: new Vector3().fromBufferAttribute(position, i), normal: new Vector3().fromBufferAttribute(normal, i), tint: tint.getX(i) }))
}

describe("the profile of a cup", () => {
  it("starts and ends on the axis, so the lathe closes both ends", () => {
    expect(CUP_PROFILE[0]![0]).toBe(0)
    expect(CUP_PROFILE[CUP_PROFILE.length - 1]![0]).toBe(0)
  })

  it("has no two points in the same place one after the other, which would leave a surface with no direction", () => {
    CUP_PROFILE.forEach(([radius, height], i) => {
      const [nextRadius, nextHeight] = CUP_PROFILE[i + 1] ?? [Number.NaN, Number.NaN]
      expect(radius === nextRadius && height === nextHeight, `point ${i}`).toBe(false)
    })
  })

  it("stands on its mouth: the rim is at the floor and the base is at the top", () => {
    expect(CUP_PROFILE[CUP_INSIDE_POINTS - 1]![1]).toBe(0)
    expect(CUP_PROFILE[CUP_INSIDE_POINTS]![1]).toBe(0)
    expect(Math.max(...CUP_PROFILE.map(([, height]) => height))).toBe(CUP_HEIGHT)
    expect(Math.min(...CUP_PROFILE.map(([, height]) => height))).toBe(0)
  })

  it("has a rim of some thickness: the inside of the mouth is narrower than the outside", () => {
    expect(CUP_PROFILE[CUP_INSIDE_POINTS - 1]![0]).toBeLessThan(CUP_PROFILE[CUP_INSIDE_POINTS]![0])
  })

  it("is one unit across its mouth", () => {
    expect(CUP_PROFILE[CUP_INSIDE_POINTS]![0]).toBe(0.5)
    expect(Math.max(...CUP_PROFILE.map(([radius]) => radius))).toBe(0.5)
  })
})

describe("cupGeometry", () => {
  it("is as wide as the size across its mouth and as high as the size makes it, standing on y = 0", () => {
    for (const size of [1, 1.8, 3]) {
      const box = cupGeometry(size).boundingBox ?? (cupGeometry(size).computeBoundingBox(), cupGeometry(size).boundingBox!)
      const geometry = cupGeometry(size)
      geometry.computeBoundingBox()
      const { min, max } = geometry.boundingBox!
      expect(box).toBeDefined()
      expect(max.x).toBeCloseTo(size / 2, 4)
      expect(min.x).toBeCloseTo(-size / 2, 4)
      expect(min.y).toBeCloseTo(0, 6)
      expect(max.y).toBeCloseTo(CUP_HEIGHT * size, 6)
    }
  })

  it("is hollow: the hollow reaches up inside, so there are vertices inside the outer wall at every height of it", () => {
    const inside = vertices(cupGeometry(1)).filter((vertex) => vertex.tint === INSIDE)
    expect(inside.length).toBeGreaterThan(0)
    expect(Math.max(...inside.map((vertex) => vertex.at.y))).toBeGreaterThan(CUP_HEIGHT - 0.1)
    expect(Math.min(...inside.map((vertex) => vertex.at.y))).toBeCloseTo(0, 6)
  })

  it("makes every triangle face the way its normals say, so that no wall is drawn from behind", () => {
    const geometry = cupGeometry(1)
    const [position, normal, index] = [geometry.getAttribute("position"), geometry.getAttribute("normal"), geometry.getIndex()!]
    const [a, b, c, ab, ac, n] = [new Vector3(), new Vector3(), new Vector3(), new Vector3(), new Vector3(), new Vector3()]
    let checked = 0
    for (let t = 0; t < index.count; t += 3) {
      const [ia, ib, ic] = [index.getX(t), index.getX(t + 1), index.getX(t + 2)]
      a.fromBufferAttribute(position, ia)
      b.fromBufferAttribute(position, ib)
      c.fromBufferAttribute(position, ic)
      const face = ab.subVectors(b, a).cross(ac.subVectors(c, a))
      // A sliver at the axis has no direction
      if (face.length() < 1e-9) continue
      n.fromBufferAttribute(normal, ia).add(new Vector3().fromBufferAttribute(normal, ib)).add(new Vector3().fromBufferAttribute(normal, ic))
      expect(face.dot(n), `triangle ${t / 3}`).toBeGreaterThan(0)
      checked++
    }
    expect(checked).toBeGreaterThan(500)
  })

  it("faces the outside wall away from the axis and the inside wall toward it", () => {
    const walls = vertices(cupGeometry(1)).filter((vertex) => vertex.at.y > 0.15 && vertex.at.y < 0.95)
    const outside = walls.filter((vertex) => vertex.tint === 1)
    const inside = walls.filter((vertex) => vertex.tint === INSIDE)
    expect(outside.length).toBeGreaterThan(50)
    expect(inside.length).toBeGreaterThan(50)
    for (const { at, normal } of outside) expect(at.x * normal.x + at.z * normal.z).toBeGreaterThan(0)
    for (const { at, normal } of inside) expect(at.x * normal.x + at.z * normal.z).toBeLessThan(0)
  })

  it("faces the base up and the rim down", () => {
    const vs = vertices(cupGeometry(1))
    const top = vs.filter((vertex) => vertex.tint === 1 && Math.abs(vertex.at.y - CUP_HEIGHT) < 1e-5 && vertex.at.length() > 0.01)
    expect(top.length).toBeGreaterThan(0)
    for (const { normal } of top) expect(normal.y).toBeGreaterThan(0.9)
    const rim = vs.filter((vertex) => Math.abs(vertex.at.y) < 1e-9 && Math.hypot(vertex.at.x, vertex.at.z) > 0.4)
    expect(rim.length).toBeGreaterThan(0)
    for (const { normal } of rim) expect(normal.y).toBeLessThan(0)
  })

  it("tints the inside darker than the outside, vertex by vertex of the profile", () => {
    const tints = vertices(cupGeometry(1)).map((vertex) => vertex.tint)
    const [segments, points] = [49, CUP_PROFILE.length]
    expect(tints).toHaveLength(segments * points)
    expect(tints.filter((tint) => tint === INSIDE)).toHaveLength(segments * CUP_INSIDE_POINTS)
    expect(tints.filter((tint) => tint === 1)).toHaveLength(segments * (points - CUP_INSIDE_POINTS))
  })

  it("has a colour attribute of its own, which a lit geometry keeps to itself", () => {
    const [a, b] = [cupGeometry(1), cupGeometry(1)]
    expect(a.getAttribute("color")).not.toBe(b.getAttribute("color"))
  })
})

describe("shadeLathe", () => {
  const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length

  it("writes a grey for every vertex, none of them dark enough to vanish or bright enough to burn", () => {
    const geometry = cupGeometry(1)
    shadeLathe(geometry, new Quaternion())
    const colors = geometry.getAttribute("color").array
    for (let i = 0; i < colors.length; i++) {
      expect(Number.isFinite(colors[i]!)).toBe(true)
      expect(colors[i]!).toBeGreaterThan(0.15)
      expect(colors[i]!).toBeLessThan(1.3)
    }
  })

  it("makes the inside of the cup darker than its outside, other things being equal", () => {
    const geometry = cupGeometry(1)
    shadeLathe(geometry, new Quaternion())
    const colors = geometry.getAttribute("color")
    const vs = vertices(geometry)
    const grey = (tint: number) => mean(vs.flatMap((vertex, i) => (vertex.tint === tint && vertex.at.y > 0.2 && vertex.at.y < 0.9 ? [colors.getX(i)] : [])))
    expect(grey(INSIDE)).toBeLessThan(grey(1))
  })

  it("lights the cup anew when it turns", () => {
    const geometry = cupGeometry(1)
    shadeLathe(geometry, new Quaternion())
    const before = Array.from(geometry.getAttribute("color").array)
    shadeLathe(geometry, new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), 1.2))
    expect(Array.from(geometry.getAttribute("color").array)).not.toEqual(before)
  })

  it("leaves the shape alone", () => {
    const geometry = cupGeometry(1)
    const [position, normal] = [Array.from(geometry.getAttribute("position").array), Array.from(geometry.getAttribute("normal").array)]
    shadeLathe(geometry, new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), 0.7))
    expect(Array.from(geometry.getAttribute("position").array)).toEqual(position)
    expect(Array.from(geometry.getAttribute("normal").array)).toEqual(normal)
  })
})

describe("litLathe", () => {
  it("gives every point of the profile the tint the game says, turn after turn", () => {
    const geometry = cupGeometry(1)
    const lit = litLathe(geometry, 4, (point) => point * 0.25)
    const tints = lit.getAttribute("tint")
    for (let i = 0; i < tints.count; i++) expect(tints.getX(i)).toBe((i % 4) * 0.25)
  })
})
