import { describe, expect, it } from "vitest"
import { hexCells } from "../board/cells"
import { bandMesh, fillMesh, type Flat } from "./mesh"
import { cellShape, circleShape, outlineOf, rectShape } from "./shapes"

/** The up-or-down of a triangle of a mesh: positive when it faces the sky */
function facing(mesh: Flat, triangle: number): number {
  const at = (corner: number) => {
    const vertex = mesh.indices[triangle * 3 + corner]!
    return { x: mesh.positions[vertex * 3]!, z: mesh.positions[vertex * 3 + 2]! }
  }
  const [a, b, c] = [at(0), at(1), at(2)]
  const [ux, uz] = [b.x - a.x, b.z - a.z]
  const [vx, vz] = [c.x - a.x, c.z - a.z]
  // The y of the cross product of the two sides
  return uz * vx - ux * vz
}

describe("the band along the edge of a zone", () => {
  const outline = outlineOf(rectShape(0, 0, 4, 2))
  const band = bandMesh(outline, 0.2, 0.006)

  it("has two vertices at each corner and two triangles for each side", () => {
    expect(band.positions).toHaveLength(outline.length * 2 * 3)
    expect(band.indices).toHaveLength(outline.length * 6)
  })

  it("lies flat at the height it is given", () => {
    for (let vertex = 0; vertex < outline.length * 2; vertex++) expect(band.positions[vertex * 3 + 1]).toBeCloseTo(0.006, 6)
  })

  it("puts the inner vertices inside the outer ones", () => {
    // The corner at the top left of a rectangle 4 by 2: the inner one is 0.2 toward the middle along both axes
    expect(band.positions[3]).toBeCloseTo(-1.8, 5)
    expect(band.positions[5]).toBeCloseTo(-0.8, 5)
  })

  it("faces the sky", () => {
    for (let triangle = 0; triangle < outline.length * 2; triangle++) expect(facing(band, triangle)).toBeGreaterThan(0)
  })

  it("is the same for a circle and for a hexagon, a ring each", () => {
    for (const shape of [circleShape(0, 0, 2), cellShape(hexCells([[0, 0]], { size: 2 })[0]!)]) {
      const ring = bandMesh(outlineOf(shape), 0.15, 0.01)
      for (let triangle = 0; triangle < ring.indices.length / 3; triangle++) expect(facing(ring, triangle)).toBeGreaterThan(0)
    }
  })
})

describe("the inside of a zone", () => {
  const outline = outlineOf(rectShape(1, -2, 4, 2))
  const fill = fillMesh(outline, 0.004)

  it("has a vertex at the middle and one at each corner, a triangle for each side", () => {
    expect(fill.positions).toHaveLength((outline.length + 1) * 3)
    expect(fill.indices).toHaveLength(outline.length * 3)
    expect(fill.positions[0]).toBeCloseTo(1, 6)
    expect(fill.positions[1]).toBeCloseTo(0.004, 6)
    expect(fill.positions[2]).toBeCloseTo(-2, 6)
  })

  it("faces the sky", () => {
    for (let triangle = 0; triangle < outline.length; triangle++) expect(facing(fill, triangle)).toBeGreaterThan(0)
  })
})
