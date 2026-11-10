import type { BoardCell } from "./cells"

/** The plates of a board as one mesh: for each cell a vertex at its middle and one at each corner, and a triangle for each side, lying flat and facing the sky */
export type Plates = {
  positions: Float32Array
  indices: Uint32Array
  /** The first vertex of each cell, and the number of vertices at the end: one more entry than there are cells */
  vertexStarts: number[]
  /** The first triangle of each cell, and the number of triangles at the end: one more entry than there are cells */
  triangleStarts: number[]
}

/** The mesh of the cells at the height `height` above the table: a fan of triangles from the middle of each cell to its corners */
export function plateMesh(cells: readonly BoardCell[], height: number): Plates {
  const vertexStarts = [0]
  const triangleStarts = [0]
  for (const { corners } of cells) {
    vertexStarts.push(vertexStarts[vertexStarts.length - 1]! + corners.length + 1)
    triangleStarts.push(triangleStarts[triangleStarts.length - 1]! + corners.length)
  }
  const positions = new Float32Array(vertexStarts[cells.length]! * 3)
  const indices = new Uint32Array(triangleStarts[cells.length]! * 3)
  cells.forEach(({ x, z, corners }, i) => {
    const first = vertexStarts[i]!
    positions.set([x, height, z], first * 3)
    corners.forEach(([cx, cz], k) => positions.set([x + cx, height, z + cz], (first + 1 + k) * 3))
    corners.forEach((_, k) => indices.set([first, first + 1 + ((k + 1) % corners.length), first + 1 + k], (triangleStarts[i]! + k) * 3))
  })
  return { positions, indices, vertexStarts, triangleStarts }
}

/** The colour of each vertex, from one colour for each cell (red, green and blue from 0 to 1): a cell is one colour from its middle to its edge */
export function cellColors(vertexStarts: readonly number[], colours: readonly (readonly [number, number, number])[]): Float32Array {
  const out = new Float32Array(vertexStarts[vertexStarts.length - 1]! * 3)
  colours.forEach((colour, i) => {
    for (let vertex = vertexStarts[i]!; vertex < vertexStarts[i + 1]!; vertex++) out.set(colour, vertex * 3)
  })
  return out
}

/** The cell a triangle of the mesh belongs to, from the `faceIndex` of a ray that hit it. -1 for a hit that says nothing */
export function cellOfFace(faceIndex: number | null | undefined, triangleStarts: readonly number[]): number {
  const total = triangleStarts[triangleStarts.length - 1] ?? 0
  if (faceIndex === undefined || faceIndex === null || !Number.isInteger(faceIndex) || faceIndex < 0 || faceIndex >= total) return -1
  let [low, high] = [0, triangleStarts.length - 1]
  // The last cell that starts at or before the triangle
  while (high - low > 1) {
    const middle = (low + high) >> 1
    if (triangleStarts[middle]! <= faceIndex) low = middle
    else high = middle
  }
  return low
}

/**
 * The outlines of the cells as one mesh, each a band along the edge of its cell: `thickness` is how far in from the edge the band goes, as a part of the way from the edge to the middle. Two vertices at each corner, the outer and the inner, and
 * two triangles for each side, facing the sky.
 */
export function ringMesh(cells: readonly BoardCell[], height: number, thickness: number): { positions: Float32Array; indices: Uint32Array } {
  const corners = cells.reduce((sum, cell) => sum + cell.corners.length, 0)
  const positions = new Float32Array(corners * 2 * 3)
  const indices = new Uint32Array(corners * 6)
  let [vertex, triangle] = [0, 0]
  for (const { x, z, corners: shape } of cells) {
    const first = vertex
    shape.forEach(([cx, cz], k) => {
      positions.set([x + cx, height, z + cz], (first + 2 * k) * 3)
      positions.set([x + cx * (1 - thickness), height, z + cz * (1 - thickness)], (first + 2 * k + 1) * 3)
    })
    shape.forEach((_, k) => {
      const [a, b, c, d] = [first + 2 * k, first + 2 * ((k + 1) % shape.length), first + 2 * ((k + 1) % shape.length) + 1, first + 2 * k + 1]
      indices.set([a, c, b, a, d, c], triangle * 3)
      triangle += 2
    })
    vertex += shape.length * 2
  }
  return { positions, indices }
}
