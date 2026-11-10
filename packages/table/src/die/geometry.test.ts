import { Box3, type BufferAttribute, Vector3 } from "three"
import { describe, expect, it } from "vitest"
import { D6_NORMALS } from "./faces"
import { CHAMFER, dieGeometry } from "./geometry"

const at = (array: ArrayLike<number>, i: number) => new Vector3(array[i * 3], array[i * 3 + 1], array[i * 3 + 2])

describe("dieGeometry", () => {
  const geometry = dieGeometry(2)
  const position = geometry.getAttribute("position")
  const normal = geometry.getAttribute("normal")
  const index = geometry.getIndex()!

  it("is as big as it is asked, centred on the origin", () => {
    const box = new Box3().setFromBufferAttribute(position as BufferAttribute)
    expect(box.min.toArray()).toEqual([-1, -1, -1])
    expect(box.max.toArray()).toEqual([1, 1, 1])
  })

  it("has seven material groups that cover every triangle once: the body, then the six faces", () => {
    const groups = geometry.groups
    expect(groups.map((g) => g.materialIndex)).toEqual([0, 1, 2, 3, 4, 5, 6])
    let next = 0
    for (const g of groups) {
      expect(g.start).toBe(next)
      next += g.count
    }
    expect(next).toBe(index.count)
    for (const g of groups.slice(1)) expect(g.count).toBe(6)
    // 12 strips of two triangles and 8 corners of one
    expect(groups[0]!.count).toBe((12 * 2 + 8) * 3)
  })

  it("has a unit normal, a picture position and a colour for every vertex", () => {
    const count = position.count
    expect(normal.count).toBe(count)
    expect(geometry.getAttribute("uv").count).toBe(count)
    expect(geometry.getAttribute("color").count).toBe(count)
    for (let i = 0; i < count; i++) expect(at(normal.array, i).length()).toBeCloseTo(1, 6)
  })

  it("draws every triangle facing out, the way its normal says", () => {
    for (let t = 0; t < index.count; t += 3) {
      const [a, b, c] = [index.getX(t), index.getX(t + 1), index.getX(t + 2)].map((i) => at(position.array, i!)) as [Vector3, Vector3, Vector3]
      const drawn = b.clone().sub(a).cross(c.clone().sub(a)).normalize()
      expect(drawn.dot(at(normal.array, index.getX(t))), `triangle ${t / 3}`).toBeGreaterThan(0.99)
      // and away from the middle of the die
      expect(a.clone().add(b).add(c).dot(drawn)).toBeGreaterThan(0)
    }
  })

  it("puts the face of each value on the side its normal looks at", () => {
    geometry.groups.slice(1).forEach((g) => {
      const value = g.materialIndex!
      const side = D6_NORMALS[value - 1]!
      for (let t = g.start; t < g.start + g.count; t++) {
        const vertex = at(position.array, index.getX(t))
        expect(vertex.dot(side), `value ${value}`).toBeCloseTo(1, 9)
        expect(at(normal.array, index.getX(t)).distanceTo(side)).toBeLessThan(1e-9)
      }
    })
  })

  it("covers a face with its picture, corner to corner, and nothing else wears one", () => {
    const uv = geometry.getAttribute("uv")
    geometry.groups.slice(1).forEach((g) => {
      const seen = new Set<string>()
      for (let t = g.start; t < g.start + g.count; t++) seen.add(`${uv.getX(index.getX(t))},${uv.getY(index.getX(t))}`)
      expect([...seen].sort()).toEqual(["0,0", "0,1", "1,0", "1,1"])
    })
  })

  it("leaves a flat face smaller than the die by the chamfer on each side", () => {
    const face = geometry.groups[1]!
    const xs: number[] = []
    for (let t = face.start; t < face.start + face.count; t++) xs.push(at(position.array, index.getX(t)).x)
    expect(Math.max(...xs)).toBeCloseTo(1 - 2 * CHAMFER, 6)
  })

  it("starts with every vertex fully lit", () => {
    expect(Math.min(...geometry.getAttribute("color").array)).toBe(1)
  })

  it("scales with the size", () => {
    const big = dieGeometry(10)
    expect(new Box3().setFromBufferAttribute(big.getAttribute("position") as BufferAttribute).max.x).toBeCloseTo(5, 9)
  })
})
