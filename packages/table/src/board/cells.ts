import type { Space } from "../track/path"

/** The two numbers that place a cell on the engine's board: `[col, row]` on a square board, `[q, r]` on a hexagonal one (the `coords` of `squareBoard` and `hexBoard` of the kit) */
export type Coord = readonly [number, number]

/** A corner of a cell relative to its middle: x to the right, z toward the viewer */
export type Corner = readonly [x: number, z: number]

/**
 * A cell of a board, placed on the table: where its middle is, and its shape. It is a `Space` too, so a piece stands on it with `at={cell}` and a `TrackMarker` walks across the cells of a board. The corners go clockwise seen from above, and the shape
 * is convex.
 */
export type BoardCell = Space & {
  /** The corners of the cell relative to its middle, in order round it. Convex */
  corners: readonly Corner[]
}

export type PlaceOptions = {
  /** The distance between the middles of two neighbouring cells, in world units */
  size: number
  /** The room left between two cells, in world units (default 0): each cell is drawn smaller by it, the way the lines of a board are */
  gap?: number
  /** Where the middle of the board lies on the table (default the middle of the table): the board is centred on it */
  at?: { x: number; z: number }
}

function check({ size, gap = 0 }: PlaceOptions): void {
  if (!(size > 0) || !Number.isFinite(size)) throw new RangeError(`Neighbouring cells are a size above zero apart, got ${String(size)}`)
  if (!(gap >= 0) || gap >= size) throw new RangeError(`The gap between two cells is at least zero and less than their size, got ${String(gap)} for ${size}`)
}

/** The cells with these middles and this shape, moved so that the middle of the whole is at `at` */
function placed(middles: readonly (readonly [number, number])[], corners: readonly Corner[], at: { x: number; z: number }): BoardCell[] {
  if (middles.length === 0) return []
  const [xs, zs] = [middles.map(([x]) => x), middles.map(([, z]) => z)]
  const [centreX, centreZ] = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...zs) + Math.max(...zs)) / 2]
  return middles.map(([x, z]) => ({ x: at.x + x - centreX, z: at.z + z - centreZ, yaw: 0, corners }))
}

/**
 * The cells of a square board placed on the table, one for each of `coords` in their order (the `coords` of `squareBoard`): a column goes toward the right and a row toward the viewer, so the first row is the farthest. A cell is a square of the
 * `size` of the board less the `gap`. Only the cells that are in `coords` are made, so a board with holes, or one that grows as tiles are laid (Carcassonne), is a list that changes.
 */
export function squareCells(coords: readonly Coord[], options: PlaceOptions): BoardCell[] {
  check(options)
  const { size, gap = 0, at = { x: 0, z: 0 } } = options
  const half = (size - gap) / 2
  const corners: Corner[] = [
    [-half, -half],
    [half, -half],
    [half, half],
    [-half, half],
  ]
  return placed(
    coords.map(([col, row]) => [col * size, row * size] as const),
    corners,
    at,
  )
}

/**
 * The cells of a hexagonal board placed on the table, one for each of `coords` in their order (the `coords` of `hexBoard`, axial `[q, r]`): hexagons with a point up, `r` going toward the viewer and `q` to the right along a row, each row half a cell
 * from the one before. A cell is a hexagon whose width is the `size` of the board less the `gap`.
 */
export function hexCells(coords: readonly Coord[], options: PlaceOptions): BoardCell[] {
  check(options)
  const { size, gap = 0, at = { x: 0, z: 0 } } = options
  const radius = (size - gap) / Math.sqrt(3)
  // The first corner is the far point, then clockwise seen from above
  const corners: Corner[] = Array.from({ length: 6 }, (_, k) => {
    const angle = -Math.PI / 2 + (k * Math.PI) / 3
    return [radius * Math.cos(angle), radius * Math.sin(angle)] as const
  })
  return placed(
    coords.map(([q, r]) => [size * (q + r / 2), size * (Math.sqrt(3) / 2) * r] as const),
    corners,
    at,
  )
}

/** The radius of the largest circle that fits in a cell, round its middle: how big what is written on it may be */
export function inradius(cell: BoardCell): number {
  let least = Number.POSITIVE_INFINITY
  cell.corners.forEach(([x0, z0], i) => {
    const [x1, z1] = cell.corners[(i + 1) % cell.corners.length]!
    const edge = Math.hypot(x1 - x0, z1 - z0)
    if (edge > 0) least = Math.min(least, Math.abs(x0 * z1 - x1 * z0) / edge)
  })
  return Number.isFinite(least) ? least : 0
}
