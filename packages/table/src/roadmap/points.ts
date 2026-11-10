import type { PlaceOptions } from "../board/cells"
import type { Space } from "../track/path"

/**
 * Where the corners of a board are on the table. The engine's `cornerGraph` of the kit numbers the points where the cells of a board meet; these give the place of each, in the same order, for a board of the table that was made with the
 * same `size` and `at` as its cells (`squareCells`, `hexCells`), so that a point lies at the corner of the cells round it. A piece stands on one with `at={points[i]}`.
 */

// The corners of a cell from its middle, in units of the distance between the middles of two cells that are next to one another, clockwise seen from above, the first being the far point of a hexagon and the top left of a square: the same
// as the kit's `cornerGraph`, which a test holds these to
const HEX = Array.from({ length: 6 }, (_, k) => {
  const angle = -Math.PI / 2 + (k * Math.PI) / 3
  return [Math.cos(angle) / Math.sqrt(3), Math.sin(angle) / Math.sqrt(3)] as const
})
const SQUARE = [
  [-0.5, -0.5],
  [0.5, -0.5],
  [0.5, 0.5],
  [-0.5, 0.5],
] as const

type Where = Pick<PlaceOptions, "size" | "at">

function pointsOf(middles: readonly (readonly [number, number])[], offsets: readonly (readonly [number, number])[], { size, at = { x: 0, z: 0 } }: Where): Space[] {
  if (!(size > 0) || !Number.isFinite(size)) throw new RangeError(`Neighbouring cells are a size above zero apart, got ${String(size)}`)
  if (middles.length === 0) return []
  // The cells are centred on `at` by the middle of the box round their middles: so are the points
  const xs = middles.map(([x]) => x)
  const zs = middles.map(([, z]) => z)
  const centreX = (Math.min(...xs) + Math.max(...xs)) / 2
  const centreZ = (Math.min(...zs) + Math.max(...zs)) / 2
  const seen = new Set<string>()
  const points: Space[] = []
  for (const [mx, mz] of middles) {
    for (const [dx, dz] of offsets) {
      const [x, z] = [mx + dx, mz + dz]
      // The same corner reached from two cells differs by a rounding error at the most
      const key = `${Math.round(x * 1e6)},${Math.round(z * 1e6)}`
      if (seen.has(key)) continue
      seen.add(key)
      points.push({ x: at.x + (x - centreX) * size, z: at.z + (z - centreZ) * size, yaw: 0 })
    }
  }
  return points
}

/** The two numbers that place a cell on the engine's board: `[col, row]` on a square board, `[q, r]` on a hexagonal one */
type Coords = readonly (readonly [number, number])[]

/**
 * The points of a board of hexagons placed on the table, one for each point of the kit's `cornerGraph` of the same board, in its order: the corners of the hexagons of `coords` (the `coords` of `hexBoard`) where they meet, at the same `size` and
 * `at` as the cells that `hexCells` makes from them. Throws a `RangeError` for a size that is not above zero.
 */
export function hexPoints(coords: Coords, options: Where): Space[] {
  return pointsOf(
    coords.map(([q, r]) => [q + r / 2, (Math.sqrt(3) / 2) * r] as const),
    HEX,
    options,
  )
}

/** The points of a board of squares placed on the table, in the order of the kit's `cornerGraph` of the same board: the corners of the squares of `coords` (the `coords` of `squareBoard`) where they meet. A stone of Go stands on one */
export function squarePoints(coords: Coords, options: Where): Space[] {
  return pointsOf(
    coords.map(([col, row]) => [col, row] as const),
    SQUARE,
    options,
  )
}

/** Where a road between two points lies: the middle of it, the way it runs (`yaw`, so that a piece that is long along its own x lies along the road) and how long it is */
export function edgePlace(from: { x: number; z: number }, to: { x: number; z: number }): { x: number; z: number; yaw: number; length: number } {
  const [dx, dz] = [to.x - from.x, to.z - from.z]
  // Adding 0 turns a -0 into 0
  return { x: (from.x + to.x) / 2, z: (from.z + to.z) / 2, yaw: Math.atan2(-dz, dx) + 0, length: Math.hypot(dx, dz) }
}
