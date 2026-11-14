// Where the playground's things lie on the table, as plain numbers: what the scene draws from and what the controls reason with (which cell a piece stands on, which cells are next to it). This file imports the engine kit and nothing else, so the controls
// do not pull in three.js. The cells here are the ones `squareCells` and `hexCells` of the table make from the same `coords`: a column or a `q` goes to the right, a row or an `r` toward the viewer, the middle of the whole on `at`.

import { hexBoard, squareBoard } from "@pbgo/engine-kit"
import type { BoardShape } from "../defaults"

export type Place = { x: number; z: number }

/** How many cells a ring has */
export const LOOP_CELLS = 16

/** The board lies at the side of the table, or in the middle of it when it is the centre of the game (larger, and the piles and the seats give way) */
export const BOARD_PLACES = { side: { x: -6.6, z: -0.6, size: 1 }, centre: { x: 0, z: -0.6, size: 1.25 } }

/** The board of the engine behind each shape, for the cells that touch: a ring has no engine board, a cell touches the one before and the one after */
const GRID = squareBoard({ columns: 6, rows: 6 })
const HEX = hexBoard({ radius: 2 })

export type BoardPlan = { shape: BoardShape; at: Place; size: number }

export function planOf(board: { shape: BoardShape; centre: boolean }): BoardPlan {
  const { x, z, size } = board.centre ? BOARD_PLACES.centre : BOARD_PLACES.side
  return { shape: board.shape, at: { x, z }, size }
}

/** The coordinates of the cells of a grid or a hex board, the engine's own: what the table makes its cells from */
export const coordsOf = (shape: Exclude<BoardShape, "loop">) => (shape === "grid" ? GRID : HEX).coords

/** The middle of each cell of the plan, in the order of the engine's board; a ring is a circle of equal arcs from the front, clockwise seen from above */
export function cellCentres({ shape, at, size }: BoardPlan): Place[] {
  if (shape === "loop") {
    const radius = ringRadius(size)
    return Array.from({ length: LOOP_CELLS }, (_, k) => {
      const angle = Math.PI / 2 + (k * 2 * Math.PI) / LOOP_CELLS
      return { x: at.x + radius * Math.cos(angle), z: at.z + radius * Math.sin(angle) }
    })
  }
  const middles = coordsOf(shape).map(([a, b]) => (shape === "grid" ? ([a * size, b * size] as const) : ([size * (a + b / 2), size * (Math.sqrt(3) / 2) * b] as const)))
  const xs = middles.map(([x]) => x)
  const zs = middles.map(([, z]) => z)
  const [midX, midZ] = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...zs) + Math.max(...zs)) / 2]
  return middles.map(([x, z]) => ({ x: at.x + x - midX, z: at.z + z - midZ }))
}

/** The radius of the ring of a board of this size */
export const ringRadius = (size: number) => size * 3.2

/** The cells next to a cell */
export function neighboursOf(shape: BoardShape, cell: number): number[] {
  if (shape === "loop") return [(cell + 1) % LOOP_CELLS, (cell + LOOP_CELLS - 1) % LOOP_CELLS]
  return [...(shape === "grid" ? GRID : HEX).neighbours(cell)]
}

/** The cell whose middle is within `reach` of the place, nearest first, or -1 */
export function cellAt(centres: readonly Place[], at: Place, reach: number): number {
  let best = -1
  let least = reach
  centres.forEach((centre, i) => {
    const d = Math.hypot(centre.x - at.x, centre.z - at.z)
    if (d <= least) {
      least = d
      best = i
    }
  })
  return best
}

/** Where the draw and the discard pile lie, and the floor buttons beside them, for each place of the piles */
export const PILE_PLACES_AT = {
  edge: { draw: { x: -6.6, z: 9.4 }, discard: { x: 6.6, z: 9.4 } },
  middle: { draw: { x: -3.8, z: -0.4 }, discard: { x: 5.4, z: -0.4 } },
} as const

/** The pads of the floor buttons: Hit and Stay side by side to the right of the draw pile, as deep as it, and Deal across the two under them (the arrangement of Flip 7, `floorPlan`) */
export const FLOOR_GAP = 0.3
export function floorPads(draw: Place) {
  const depth = 2.4
  const width = 2.5
  const hit = { x: draw.x + 1.1 + FLOOR_GAP + width / 2, z: draw.z, width, depth }
  const stay = { x: hit.x + width + FLOOR_GAP, z: draw.z, width, depth }
  const deal = { x: (hit.x + stay.x) / 2, z: draw.z + depth / 2 + FLOOR_GAP + 0.55, width: width * 2 + FLOOR_GAP, depth: 1.1 }
  return { hit, stay, deal }
}

/** The ring the seats stand on: a little wider the more players sit */
export const ringOf = (players: number) => ({ radiusX: players > 6 ? 12 : 10, radiusZ: 7.2 })

/** A seat's cards held face down lie between its plate and the middle of the table; the zone of the floor lies there too */
export const heldFrame = (spot: Place & { yaw: number }, factor = 0.7): Place & { yaw: number } => ({ x: spot.x * factor, z: spot.z * factor, yaw: spot.yaw })

/** The frame of a hand put in the bottom left of the screen, from two places of the table that the screen shows at its bottom left: where the left edge of the picture meets the row the hand lies on, and where its middle does. The hand is as wide as the room between them, never wider than `most`, and its depth follows */
export function cornerFrame(left: Place, middle: Place, { most, depth }: { most: number; depth: number }): { x: number; z: number; width: number; depth: number; scale: number } {
  const room = Math.max(0.1, Math.abs(middle.x - left.x))
  const width = Math.min(room, most)
  const scale = width / most
  return { x: left.x + width / 2, z: left.z, width, depth: depth * scale, scale }
}
