/**
 * The arithmetic of a sheet that is drawn on: where a point of the table is on the sheet, and how the points the pen recorded become the stroke a board sends. The data is the engine kit's (`Stroke`, `DRAWING_GRID` of
 * `packages/engine-kit/src/drawing.ts`): the table does not import the kit, and a test holds the two together.
 */

/** One stroke, as the engine keeps it: the colour (an index of the game's palette), the width (an index of its brushes) and the points as a flat list, `x` then `y` for each, on the grid */
export type Stroke = { color: number; width: number; points: number[] }

/** The grid the points lie on, on each side of the sheet: the kit's `DRAWING_GRID` */
export const SKETCH_GRID = 1000

/** Where a sheet lies on the table and how big it is */
export type SheetPlace = { x: number; z: number; yaw?: number; width: number; height: number }

const clamp = (value: number, least: number, most: number) => Math.min(most, Math.max(least, value))

/**
 * Where a point of the table is on a sheet: how far across it from its left edge and how far down from its top edge, each from 0 to 1 (outside that when the point is off the sheet). The sheet lies flat with its top away from the viewer, turned
 * by `yaw` (radians about the vertical axis, counterclockwise from above), like everything on the table.
 */
export function toSheet(point: { x: number; z: number }, sheet: SheetPlace): [number, number] {
  const yaw = sheet.yaw ?? 0
  const dx = point.x - sheet.x
  const dz = point.z - sheet.z
  return [(dx * Math.cos(yaw) - dz * Math.sin(yaw)) / sheet.width + 0.5, (dx * Math.sin(yaw) + dz * Math.cos(yaw)) / sheet.height + 0.5]
}

/** A place on the sheet, from 0 to 1 on each side, as a point of the grid, kept on the sheet */
export const toGrid = ([x, y]: readonly [number, number]): [number, number] => [clamp(x, 0, 1) * SKETCH_GRID, clamp(y, 0, 1) * SKETCH_GRID]

/**
 * The points that are left of a line when the ones that lie within `tolerance` of it are taken out (Douglas and Peucker): the first and the last are always kept, and so is the point that is farthest from the line between them when it is farther than
 * the tolerance, then the same for each half. A line with nothing to take out comes back as it is.
 */
export function simplify(points: readonly (readonly [number, number])[], tolerance: number): [number, number][] {
  if (points.length <= 2) return points.map(([x, y]) => [x, y])
  const keep = new Array<boolean>(points.length).fill(false)
  keep[0] = true
  keep[points.length - 1] = true
  const stack: [number, number][] = [[0, points.length - 1]]
  while (stack.length) {
    const [from, to] = stack.pop()!
    const [ax, ay] = points[from]!
    const [bx, by] = points[to]!
    const run = Math.hypot(bx - ax, by - ay)
    let farthest = -1
    let distance = tolerance
    for (let i = from + 1; i < to; i++) {
      const [px, py] = points[i]!
      // The distance from the line when it has a length, from the point when it has none (a stroke that goes out and comes back)
      const away = run === 0 ? Math.hypot(px - ax, py - ay) : Math.abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / run
      if (away > distance) {
        distance = away
        farthest = i
      }
    }
    if (farthest >= 0) {
      keep[farthest] = true
      stack.push([from, farthest], [farthest, to])
    }
  }
  return points.flatMap((point, i) => (keep[i] ? [[point[0], point[1]] as [number, number]] : []))
}

/** How the pen is thinned: `spacing` is the least distance between two recorded points, `tolerance` how far the line may stray from what the player drew, both in grid units, and `maxPoints` the most points a stroke may keep */
export type Thinning = { tolerance: number; spacing: number; maxPoints: number }

/**
 * The stroke a board sends for what the pen recorded: places on the sheet, from 0 to 1 on each side, in the order the pen went over them. They are put on the grid, the ones that are too close to the one before are left out (the last one is
 * always kept, so a stroke ends where the pen was lifted), the line is thinned, and when it still has more points than a stroke may have it is thinned more, until it fits. One place, or places that are all the same, is a dot.
 */
export function buildStroke(recorded: readonly (readonly [number, number])[], pen: { color: number; width: number }, { tolerance, spacing, maxPoints }: Thinning): Stroke {
  const placed = recorded.map(toGrid)
  const kept: [number, number][] = []
  placed.forEach((point, i) => {
    const last = kept[kept.length - 1]
    if (!last || Math.hypot(point[0] - last[0], point[1] - last[1]) >= spacing) kept.push(point)
    else if (i === placed.length - 1) kept[kept.length - 1] = point
  })
  const room = Math.max(1, Math.floor(maxPoints))
  let line = simplify(kept, tolerance)
  // A line that has too many points anyway, a scribble, is thinned more each time until it fits
  for (let more = Math.max(tolerance, 1) * 1.5; line.length > room && more < SKETCH_GRID * 2; more *= 1.5) line = simplify(kept, more)
  if (line.length > room) line = line.slice(0, room)
  const points: number[] = []
  for (const [x, y] of line) {
    // Adding 0 turns a -0 into 0: the state never holds a negative zero
    const gx = Math.round(x) + 0
    const gy = Math.round(y) + 0
    if (points.length >= 2 && points[points.length - 2] === gx && points[points.length - 1] === gy) continue
    points.push(gx, gy)
  }
  // Nothing recorded cannot be a stroke; a dot is one point
  return { color: pen.color, width: pen.width, points: points.length ? points : [0, 0] }
}
