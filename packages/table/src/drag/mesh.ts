import { centreOf, insetOf, type Point, polygonShape } from "./shapes"

/** A flat mesh: the positions of its vertices as x, y, z and the triangles as three indices each */
export type Flat = { positions: Float32Array; indices: Uint32Array }

/**
 * The band along the edge of a zone, `width` wide and `height` above the table: two vertices at each corner of the outline, the outer one and the inner one, and two triangles for each side, facing the sky. The outline goes clockwise seen from above
 * (`outlineOf`) and is convex.
 */
export function bandMesh(outline: readonly Point[], width: number, height: number): Flat {
  const inner = insetOf(outline, width)
  const positions = new Float32Array(outline.length * 2 * 3)
  const indices = new Uint32Array(outline.length * 6)
  outline.forEach(([x, z], k) => {
    positions.set([x, height, z], 2 * k * 3)
    positions.set([inner[k]![0], height, inner[k]![1]], (2 * k + 1) * 3)
  })
  outline.forEach((_, k) => {
    const next = (k + 1) % outline.length
    const [a, b, c, d] = [2 * k, 2 * next, 2 * next + 1, 2 * k + 1]
    indices.set([a, c, b, a, d, c], k * 6)
  })
  return { positions, indices }
}

/** The whole inside of a zone, `height` above the table, as a fan of triangles from its middle to the points of its outline, facing the sky. The outline goes clockwise seen from above and is convex */
export function fillMesh(outline: readonly Point[], height: number): Flat {
  const [cx, cz] = centreOf(polygonShape(outline))
  const positions = new Float32Array((outline.length + 1) * 3)
  const indices = new Uint32Array(outline.length * 3)
  positions.set([cx, height, cz], 0)
  outline.forEach(([x, z], k) => positions.set([x, height, z], (1 + k) * 3))
  outline.forEach((_, k) => indices.set([0, 1 + ((k + 1) % outline.length), 1 + k], k * 3))
  return { positions, indices }
}
