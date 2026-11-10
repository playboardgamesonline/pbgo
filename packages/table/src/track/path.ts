import type { Spot } from "../layout"

/**
 * A space of a track: where it is on the table and the way a marker that stands on it faces, which is the way the track goes there. `yaw` turns about the vertical axis, counterclockwise from above, as everywhere on the table: a space
 * whose yaw is 0 has the track going to the right, and a quarter turn (π / 2) has it going away from the viewer.
 */
export type Space = Required<Spot>

/** A track has a whole number of spaces, none at the least */
function checkCount(count: number): void {
  if (!Number.isInteger(count) || count < 0) throw new RangeError(`A track has a whole number of spaces, got ${String(count)}`)
}

/** The yaw that turns the x axis toward the direction (dx, dz), which is the way a space faces when the track goes that way. A direction that is no direction (a zero length) gives `fallback` */
function yawToward(dx: number, dz: number, fallback = 0): number {
  return dx === 0 && dz === 0 ? fallback : Math.atan2(-dz, dx)
}

/** `count` spaces in a straight line along x, centred on x = 0, the first on the left and the track going to the right. Turn and move it where the board has it with `spacesIn` */
export function lineSpaces(count: number, { gap }: { gap: number }): Space[] {
  checkCount(count)
  return Array.from({ length: count }, (_, i) => ({ x: (i - (count - 1) / 2) * gap, z: 0, yaw: 0 }))
}

/** The samples a sweep of an ellipse is measured with: more than the eye can tell from the curve */
const SAMPLES = 1440

/** The angles, from `from` to `to`, that cut a sweep of the ellipse into `parts` pieces that are as long as one another along the curve, `parts + 1` of them, the first being `from` and the last `to` */
function equalAngles(radiusX: number, radiusZ: number, from: number, to: number, parts: number): number[] {
  if (!(radiusX > 0) || !(radiusZ > 0)) throw new RangeError(`An ellipse has radii above zero, got ${String(radiusX)} and ${String(radiusZ)}`)
  // The length of the curve up to each sample
  const lengths = [0]
  let [px, pz] = [radiusX * Math.cos(from), radiusZ * Math.sin(from)]
  for (let k = 1; k <= SAMPLES; k++) {
    const a = from + ((to - from) * k) / SAMPLES
    const [x, z] = [radiusX * Math.cos(a), radiusZ * Math.sin(a)]
    lengths.push(lengths[k - 1]! + Math.hypot(x - px, z - pz))
    ;[px, pz] = [x, z]
  }
  const total = lengths[SAMPLES]!
  return Array.from({ length: parts + 1 }, (_, j) => {
    const wanted = (total * j) / parts
    // The last sample that is not past where the wanted length is, then a straight line to the next one
    let low = 0
    let high = SAMPLES
    while (high - low > 1) {
      const middle = (low + high) >> 1
      if (lengths[middle]! <= wanted) low = middle
      else high = middle
    }
    const span = lengths[low + 1]! - lengths[low]!
    const inside = span > 0 ? (wanted - lengths[low]!) / span : 0
    return from + ((to - from) * (low + inside)) / SAMPLES
  })
}

/** The space at angle `a` of an ellipse, the track going the way the angle goes (`sweep` is +1 or -1: the way the angle runs) */
function spaceOnEllipse(radiusX: number, radiusZ: number, a: number, sweep: number): Space {
  return { x: radiusX * Math.cos(a), z: radiusZ * Math.sin(a), yaw: yawToward(-radiusX * Math.sin(a) * sweep, radiusZ * Math.cos(a) * sweep) }
}

export type ArcOptions = {
  /** Half the width of the ellipse the spaces stand on */
  radiusX: number
  /** Half its depth (default `radiusX`: a circle) */
  radiusZ?: number
  /** The angle of the first space, in radians. 0 is the right of the ellipse and the angles grow toward the viewer, so a quarter turn is the front (nearest the viewer), minus a quarter turn is the back, and the track goes clockwise seen from above while `to` is above `from` */
  from: number
  /** The angle of the last space. Below `from` the track goes the other way round */
  to: number
}

/** `count` spaces along an arc of an ellipse, as far from one another along the curve, the first at angle `from` and the last at angle `to`; the track goes from the first to the last. One space is at `from` */
export function arcSpaces(count: number, { radiusX, radiusZ = radiusX, from, to }: ArcOptions): Space[] {
  checkCount(count)
  if (count === 0) return []
  const sweep = to < from ? -1 : 1
  const angles = count === 1 ? [from] : equalAngles(radiusX, radiusZ, from, to, count - 1)
  return angles.map((a) => spaceOnEllipse(radiusX, radiusZ, a, sweep))
}

export type LoopOptions = {
  /** Half the width of the ellipse the spaces stand on */
  radiusX: number
  /** Half its depth (default `radiusX`: a circle) */
  radiusZ?: number
  /** The angle of the first space, in radians, 0 being the right of the ellipse and a quarter turn the front, nearest the viewer (default: the front) */
  start?: number
  /** The track goes clockwise seen from above (default true) */
  clockwise?: boolean
}

/** `count` spaces round an ellipse, as far from one another along the curve, the first at `start` and the track going round to come back to it: the space after the last is the first */
export function loopSpaces(count: number, { radiusX, radiusZ = radiusX, start = Math.PI / 2, clockwise = true }: LoopOptions): Space[] {
  checkCount(count)
  if (count === 0) return []
  const sweep = clockwise ? 1 : -1
  const angles = equalAngles(radiusX, radiusZ, start, start + sweep * Math.PI * 2, count)
  return angles.slice(0, count).map((a) => spaceOnEllipse(radiusX, radiusZ, a, sweep))
}

export type SnakeOptions = {
  /** Spaces in a line */
  columns: number
  /** Distance along x between two neighbouring spaces of a line */
  gapX: number
  /** Distance along z between two lines */
  gapZ: number
  /** Where the first line is: the one nearest the viewer (default), so the track climbs away from them, or the farthest */
  start?: "near" | "far"
}

/**
 * `count` spaces in lines that the track goes along one after the other, the first from left to right, the second from right to left and so on, as the squares of a board of snakes and ladders. A last line that is not full stops
 * short: the spaces of a line that goes the other way start at its right.
 */
export function snakeSpaces(count: number, { columns, gapX, gapZ, start = "near" }: SnakeOptions): Space[] {
  checkCount(count)
  if (!Number.isInteger(columns) || columns < 1) throw new RangeError(`A snake has a whole number of columns, one at the least, got ${String(columns)}`)
  const lines = Math.ceil(count / columns)
  return Array.from({ length: count }, (_, i) => {
    const line = Math.floor(i / columns)
    const rightward = line % 2 === 0
    const column = rightward ? i % columns : columns - 1 - (i % columns)
    const depth = start === "near" ? (lines - 1) / 2 - line : line - (lines - 1) / 2
    return { x: (column - (columns - 1) / 2) * gapX, z: depth * gapZ, yaw: rightward ? 0 : Math.PI }
  })
}

/** Spaces at the points the game gives, in order, each facing the next one: a track that follows a path the game drew. The last space faces the way the one before it does */
export function pathSpaces(points: readonly { x: number; z: number }[]): Space[] {
  const spaces: Space[] = []
  points.forEach((point, i) => {
    const next = points[i + 1]
    const before = spaces[i - 1]?.yaw ?? 0
    spaces.push({ x: point.x, z: point.z, yaw: next ? yawToward(next.x - point.x, next.z - point.z, before) : before })
  })
  return spaces
}

/** Spaces laid out round their own middle, moved and turned into the frame of `frame`: a track described once and put where the board has it, which turns the way it goes with it */
export function spacesIn(frame: Spot, spaces: readonly Space[]): Space[] {
  const turn = frame.yaw ?? 0
  const [cos, sin] = [Math.cos(turn), Math.sin(turn)]
  return spaces.map((space) => ({ x: frame.x + space.x * cos + space.z * sin, z: frame.z - space.x * sin + space.z * cos, yaw: space.yaw + turn }))
}
