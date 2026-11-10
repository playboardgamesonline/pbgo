import { describe, expect, it } from "vitest"
import { type BoardCell, hexCells, squareCells } from "./cells"
import { cellColors, cellOfFace, plateMesh, ringMesh } from "./mesh"

const square = squareCells(
  [
    [0, 0],
    [1, 0],
    [0, 1],
  ],
  { size: 2 },
)
const hexes = hexCells(
  [
    [0, 0],
    [1, 0],
    [0, 1],
  ],
  { size: 2 },
)
/** A square and then a hexagon: cells that do not have the same number of corners */
const mixed: BoardCell[] = [square[0]!, hexes[1]!, square[2]!]

/** Where a vertex of a mesh is */
const vertex = (positions: Float32Array, index: number) => [positions[index * 3]!, positions[index * 3 + 1]!, positions[index * 3 + 2]!] as const
/** The y of the cross product of the two edges of a triangle: above zero when it faces the sky */
function faces(positions: Float32Array, indices: Uint32Array, triangle: number) {
  const [a, b, c] = [0, 1, 2].map((k) => vertex(positions, indices[triangle * 3 + k]!))
  return (b![2] - a![2]) * (c![0] - a![0]) - (b![0] - a![0]) * (c![2] - a![2])
}

describe("plateMesh", () => {
  it("makes a vertex at the middle of each cell and one at each corner, and a triangle for each side", () => {
    const { positions, indices, vertexStarts, triangleStarts } = plateMesh(mixed, 0.004)
    expect(vertexStarts).toEqual([0, 5, 12, 17])
    expect(triangleStarts).toEqual([0, 4, 10, 14])
    expect(positions).toHaveLength(17 * 3)
    expect(indices).toHaveLength(14 * 3)
    expect(Math.max(...indices)).toBe(16)
  })

  it("lays the cells flat at the height it is given, the first vertex of each at its middle", () => {
    const { positions, vertexStarts } = plateMesh(mixed, 0.004)
    for (let i = 0; i < mixed.length; i++) {
      const [x, y, z] = vertex(positions, vertexStarts[i]!)
      expect(x).toBeCloseTo(mixed[i]!.x, 6)
      expect(y).toBeCloseTo(0.004, 9)
      expect(z).toBeCloseTo(mixed[i]!.z, 6)
    }
    for (let v = 0; v < positions.length / 3; v++) expect(vertex(positions, v)[1]).toBeCloseTo(0.004, 9)
  })

  it("puts the corners where the cell's corners are, round its middle", () => {
    const { positions, vertexStarts } = plateMesh([square[1]!], 0)
    const cell = square[1]!
    cell.corners.forEach(([cx, cz], k) => {
      const [x, , z] = vertex(positions, vertexStarts[0]! + 1 + k)
      expect(x).toBeCloseTo(cell.x + cx, 6)
      expect(z).toBeCloseTo(cell.z + cz, 6)
    })
  })

  it("faces the sky: every triangle runs counterclockwise seen from above, whatever the shape", () => {
    for (const cells of [square, hexes, mixed]) {
      const { positions, indices } = plateMesh(cells, 0)
      for (let triangle = 0; triangle < indices.length / 3; triangle++) expect(faces(positions, indices, triangle)).toBeGreaterThan(0)
    }
  })

  it("keeps the triangles of a cell to the vertices of that cell", () => {
    const { indices, vertexStarts, triangleStarts } = plateMesh(mixed, 0)
    for (let i = 0; i < mixed.length; i++) {
      for (let triangle = triangleStarts[i]!; triangle < triangleStarts[i + 1]!; triangle++) {
        for (let k = 0; k < 3; k++) {
          expect(indices[triangle * 3 + k]).toBeGreaterThanOrEqual(vertexStarts[i]!)
          expect(indices[triangle * 3 + k]).toBeLessThan(vertexStarts[i + 1]!)
        }
      }
    }
  })

  it("makes nothing for no cell", () => {
    const { positions, indices, vertexStarts, triangleStarts } = plateMesh([], 0)
    expect(positions).toHaveLength(0)
    expect(indices).toHaveLength(0)
    expect(vertexStarts).toEqual([0])
    expect(triangleStarts).toEqual([0])
  })
})

describe("cellColors", () => {
  it("gives every vertex of a cell the colour of that cell", () => {
    const { vertexStarts } = plateMesh(mixed, 0)
    const colours = cellColors(vertexStarts, [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ])
    expect(colours).toHaveLength(17 * 3)
    for (let v = 0; v < 5; v++) expect([...colours.slice(v * 3, v * 3 + 3)]).toEqual([1, 0, 0])
    for (let v = 5; v < 12; v++) expect([...colours.slice(v * 3, v * 3 + 3)]).toEqual([0, 1, 0])
    for (let v = 12; v < 17; v++) expect([...colours.slice(v * 3, v * 3 + 3)]).toEqual([0, 0, 1])
  })
})

describe("cellOfFace", () => {
  const { triangleStarts } = plateMesh(mixed, 0)

  it("names the cell of a triangle, whatever the number of sides of the cells before it", () => {
    expect([0, 1, 2, 3].map((face) => cellOfFace(face, triangleStarts))).toEqual([0, 0, 0, 0])
    expect([4, 5, 6, 7, 8, 9].map((face) => cellOfFace(face, triangleStarts))).toEqual([1, 1, 1, 1, 1, 1])
    expect([10, 11, 12, 13].map((face) => cellOfFace(face, triangleStarts))).toEqual([2, 2, 2, 2])
  })

  it("names no cell for a hit that says nothing, or for a triangle the mesh does not have", () => {
    for (const face of [undefined, null, -1, 14, 100, 1.5, Number.NaN]) expect(cellOfFace(face, triangleStarts), String(face)).toBe(-1)
  })

  it("names no cell when there is none", () => {
    expect(cellOfFace(0, [0])).toBe(-1)
  })
})

describe("ringMesh", () => {
  it("makes two vertices at each corner and two triangles for each side", () => {
    const { positions, indices } = ringMesh(mixed, 0.009, 0.15)
    expect(positions).toHaveLength((4 + 6 + 4) * 2 * 3)
    expect(indices).toHaveLength((4 + 6 + 4) * 6)
  })

  it("lays a band along the edge of each cell, the inner edge nearer its middle", () => {
    const cell = hexes[0]!
    const { positions } = ringMesh([cell], 0.009, 0.2)
    cell.corners.forEach((_, k) => {
      const [ox, oy, oz] = vertex(positions, 2 * k)
      const [ix, , iz] = vertex(positions, 2 * k + 1)
      expect(oy).toBeCloseTo(0.009, 9)
      expect(Math.hypot(ix - cell.x, iz - cell.z)).toBeCloseTo(0.8 * Math.hypot(ox - cell.x, oz - cell.z), 5)
    })
  })

  it("faces the sky: every triangle runs counterclockwise seen from above", () => {
    for (const cells of [square, hexes, mixed]) {
      const { positions, indices } = ringMesh(cells, 0, 0.15)
      for (let triangle = 0; triangle < indices.length / 3; triangle++) expect(faces(positions, indices, triangle)).toBeGreaterThan(0)
    }
  })

  it("keeps to the vertices it has", () => {
    const { positions, indices } = ringMesh(mixed, 0, 0.15)
    expect(Math.max(...indices)).toBe(positions.length / 3 - 1)
  })
})
