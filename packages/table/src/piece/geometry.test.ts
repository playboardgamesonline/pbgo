import { Box3, type BufferAttribute, type BufferGeometry, Vector3 } from "three"
import { describe, expect, it } from "vitest"
import { cubeGeometry, PAWN_HEIGHT, pawnGeometry, prismGeometry, sphereGeometry } from "./geometry"
import { area, fitOutline, type Outline, regularOutline } from "./outline"

const at = (attribute: ArrayLike<number>, i: number) => new Vector3(attribute[i * 3], attribute[i * 3 + 1], attribute[i * 3 + 2])
const boxOf = (geometry: BufferGeometry) => new Box3().setFromBufferAttribute(geometry.getAttribute("position") as BufferAttribute)

/** The triangles of a group, as the three corners of each */
function trianglesOf(geometry: BufferGeometry, material: number) {
  const index = geometry.getIndex()!
  const position = geometry.getAttribute("position")
  const group = geometry.groups.find((g) => g.materialIndex === material)!
  const out: [Vector3, Vector3, Vector3][] = []
  for (let t = group.start; t < group.start + group.count; t += 3) {
    out.push([at(position.array, index.getX(t)), at(position.array, index.getX(t + 1)), at(position.array, index.getX(t + 2))])
  }
  return out
}

const HEX = regularOutline(6)
const MEEPLE: Outline = fitOutline([
  [0, 0],
  [4, 0],
  [4, 6],
  [6, 7],
  [8, 12],
  [5, 11],
  [4, 16],
  [0, 16],
  [-1, 11],
  [-4, 12],
  [-2, 7],
  [0, 6],
])

describe("prismGeometry", () => {
  const geometry = prismGeometry(HEX, 0.12, 2)
  const index = geometry.getIndex()!

  it("has three material groups that cover every triangle once: the walls, the top, the bottom", () => {
    expect(geometry.groups.map((g) => g.materialIndex)).toEqual([0, 1, 2])
    let next = 0
    for (const g of geometry.groups) {
      expect(g.start).toBe(next)
      next += g.count
    }
    expect(next).toBe(index.count)
    expect(geometry.groups[0]!.count).toBe(6 * 6)
    expect(geometry.groups[1]!.count).toBe((6 - 2) * 3)
    expect(geometry.groups[2]!.count).toBe((6 - 2) * 3)
  })

  it("stands on the table: its base is at zero, its top at its height, its width is the size", () => {
    const box = boxOf(geometry)
    expect(box.min.y).toBe(0)
    expect(box.max.y).toBeCloseTo(0.24, 6)
    expect(box.max.x - box.min.x).toBeCloseTo(2, 6)
    expect(box.max.z - box.min.z).toBeCloseTo(Math.sqrt(3), 6)
  })

  it("has a unit normal, a picture position and a colour for every vertex", () => {
    const count = geometry.getAttribute("position").count
    expect(geometry.getAttribute("normal").count).toBe(count)
    expect(geometry.getAttribute("uv").count).toBe(count)
    expect(geometry.getAttribute("color").count).toBe(count)
    for (let i = 0; i < count; i++) expect(at(geometry.getAttribute("normal").array, i).length()).toBeCloseTo(1, 5)
  })

  it("draws every triangle facing out, the way its normal says", () => {
    const normal = geometry.getAttribute("normal")
    for (let t = 0; t < index.count; t += 3) {
      const [a, b, c] = [at(geometry.getAttribute("position").array, index.getX(t)), at(geometry.getAttribute("position").array, index.getX(t + 1)), at(geometry.getAttribute("position").array, index.getX(t + 2))]
      const drawn = b.clone().sub(a).cross(c.clone().sub(a)).normalize()
      expect(drawn.dot(at(normal.array, index.getX(t))), `triangle ${t / 3}`).toBeGreaterThan(0.8)
    }
  })

  it("has a top that looks up at the height and a bottom that looks down on the table", () => {
    for (const [a, b, c] of trianglesOf(geometry, 1)) {
      expect(a.y).toBeCloseTo(0.24, 6)
      expect(b.clone().sub(a).cross(c.clone().sub(a)).y).toBeGreaterThan(0)
    }
    for (const [a, b, c] of trianglesOf(geometry, 2)) {
      expect(a.y).toBe(0)
      expect(b.clone().sub(a).cross(c.clone().sub(a)).y).toBeLessThan(0)
    }
  })

  it("lays the picture of the top over the box of the outline, and that of the bottom mirrored so it reads right turned over", () => {
    const uv = geometry.getAttribute("uv")
    const normal = geometry.getAttribute("normal")
    const position = geometry.getAttribute("position")
    const top = new Map<string, [number, number]>()
    const bottom = new Map<string, [number, number]>()
    for (let i = 0; i < position.count; i++) {
      const key = `${position.getX(i).toFixed(5)},${position.getZ(i).toFixed(5)}`
      if (normal.getY(i) > 0.99) top.set(key, [uv.getX(i), uv.getY(i)])
      if (normal.getY(i) < -0.99) bottom.set(key, [uv.getX(i), uv.getY(i)])
    }
    expect(top.size).toBe(6)
    expect(bottom.size).toBe(6)
    for (const [key, [u, v]] of top) {
      // The same corner of the outline: u is the same, and v is turned over
      expect(bottom.get(key)![0]).toBeCloseTo(u, 6)
      expect(bottom.get(key)![1]).toBeCloseTo(1 - v, 6)
      expect(u).toBeGreaterThanOrEqual(-1e-9)
      expect(u).toBeLessThanOrEqual(1 + 1e-9)
    }
  })

  it("lights the walls of a disc as one smooth surface and the walls of a hexagon as edges", () => {
    const disc = prismGeometry(regularOutline(48), 0.1, 1)
    const normal = disc.getAttribute("normal")
    // The second corner of a wall and the first of the next share their normal on a disc
    expect(at(normal.array, 1).distanceTo(at(normal.array, 4))).toBeLessThan(1e-6)
    const hex = geometry.getAttribute("normal")
    expect(at(hex.array, 1).distanceTo(at(hex.array, 4))).toBeGreaterThan(0.3)
  })

  it("cuts a shape with a dent in it into triangles that cover exactly its area, the top and the bottom both", () => {
    const meeple = prismGeometry(MEEPLE, 0.2, 1)
    const covered = (material: number) => trianglesOf(meeple, material).reduce((sum, [a, b, c]) => sum + Math.abs(b.clone().sub(a).cross(c.clone().sub(a)).y) / 2, 0)
    expect(covered(1)).toBeCloseTo(area(MEEPLE), 6)
    expect(covered(2)).toBeCloseTo(area(MEEPLE), 6)
    expect(meeple.groups[1]!.count / 3).toBe(MEEPLE.length - 2)
  })

  it("scales with the size", () => {
    expect(boxOf(prismGeometry(HEX, 0.12, 10)).max.y).toBeCloseTo(1.2, 6)
  })
})

describe("the other shapes", () => {
  it("is a cube standing on the table, one material, lit", () => {
    const cube = cubeGeometry(0.6)
    const box = boxOf(cube)
    expect(box.min.y).toBeCloseTo(0, 6)
    expect(box.max.y).toBeCloseTo(0.6, 6)
    expect(box.max.x).toBeCloseTo(0.3, 6)
    expect(cube.groups).toHaveLength(1)
    expect(cube.groups[0]!.materialIndex).toBe(0)
    expect(cube.groups[0]!.count).toBe(cube.getIndex()!.count)
    expect(cube.getAttribute("color").count).toBe(cube.getAttribute("position").count)
  })

  it("is a sphere resting on the table, one material, lit", () => {
    const sphere = sphereGeometry(0.4)
    const box = boxOf(sphere)
    expect(box.min.y).toBeCloseTo(0, 6)
    expect(box.max.y).toBeCloseTo(0.4, 6)
    expect(sphere.groups).toHaveLength(1)
    expect(sphere.groups[0]!.count).toBe(sphere.getIndex()!.count)
    expect(sphere.getAttribute("color")).toBeDefined()
  })

  it("is a pawn with a foot the width of the size and a head at the height of the profile", () => {
    const pawn = pawnGeometry(1)
    const box = boxOf(pawn)
    expect(box.min.y).toBeCloseTo(0, 6)
    expect(box.max.y).toBeCloseTo(PAWN_HEIGHT, 6)
    expect(box.max.x).toBeCloseTo(0.5, 2)
    expect(pawn.groups).toHaveLength(1)
    expect(pawn.groups[0]!.count).toBe(pawn.getIndex()!.count)
    expect(pawn.getAttribute("color").count).toBe(pawn.getAttribute("position").count)
  })
})
