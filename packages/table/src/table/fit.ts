import { aspectScale, type CameraSettings } from "./camera"

const RAD = Math.PI / 180

/** The size of a window, in pixels */
export type Viewport = { width: number; height: number }

/** A rectangle of the window, in pixels from its top left corner */
export type Rect = { left: number; top: number; right: number; bottom: number }

/** A point of the table, on the ground: `x` across, `z` toward the viewer */
export type Ground = { x: number; z: number }

/** A shape lying on the table, by its corners: a box of the table, turned as it is */
export type Quad = readonly Ground[]

/**
 * What the platform draws over a board, in pixels from the edges of the window: at the top left the log of the turns (its box is 512 px wide but the text fills what the longest line needs, so 320 px is the room kept for it), and at the top right the menu
 * button and, under it, the list of the players: a title with its hairline (the `padding`) and a row for each (the `row`). Measured on the HUD of `@pbgo/core`, which a board does not own: when the HUD changes, these numbers change with it, for every game at once.
 */
export const PLATFORM_HUD = {
  ticker: { left: 24, top: 20, width: 320, height: 300 },
  column: { right: 24, width: 240, top: 108, row: 40, padding: 27 },
  /** The air kept round those boxes, and round the window */
  gap: 12,
}

/** The boxes of the platform over a window, for a table of `players` players: what `FitOptions.avoid` is for */
export function hudBoxes({ width }: Viewport, players: number): Rect[] {
  const { ticker, column, gap } = PLATFORM_HUD
  return [
    { left: 0, top: 0, right: ticker.left + ticker.width + gap, bottom: ticker.top + ticker.height + gap },
    { left: width - column.right - column.width - gap, top: 0, right: width, bottom: column.top + column.row * players + column.padding + gap },
  ]
}

/**
 * Where a point of the table, on the ground at (x, z), falls in the window for a camera that looks at (tx, tz) from `d` away, tilted by `tilt` and straight in front of the table (no turn). For a point on the ground the projection comes to this: its depth is
 * `d` less how far past the target it lies along the line of sight, and its height on the screen follows how far past the target it lies on the ground. The camera has no turn here: a table is seen from its own side.
 */
function screenOf({ x, z }: Ground, d: number, tx: number, tz: number, { tilt, fov }: CameraSettings, { width, height }: Viewport): [number, number] {
  const t = tilt * RAD
  const half = Math.tan((fov * RAD) / 2)
  const depth = d - (z - tz) * Math.sin(t)
  return [width / 2 + ((x - tx) / (depth * half * (width / height))) * (width / 2), height / 2 + (((z - tz) * Math.cos(t)) / (depth * half)) * (height / 2)]
}

/** The smallest rectangle of the window that holds a shape lying on the table, for a camera that stands `d` away looking at (tx, tz) */
export function windowRectOf(quad: Quad, d: number, tx: number, tz: number, camera: CameraSettings, viewport: Viewport): Rect {
  const points = quad.map((corner) => screenOf(corner, d, tx, tz, camera, viewport))
  const xs = points.map(([x]) => x)
  const ys = points.map(([, y]) => y)
  return { left: Math.min(...xs), top: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys) }
}

const area = (a: Rect) => (a.right - a.left) * (a.bottom - a.top)
/** The area two rectangles have in common */
const common = (a: Rect, b: Rect) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))
const within = (a: Rect, room: Rect) => a.left >= room.left - 1e-9 && a.right <= room.right + 1e-9 && a.top >= room.top - 1e-9 && a.bottom <= room.bottom + 1e-9
const unionOf = (rects: readonly Rect[]): Rect => ({
  left: Math.min(...rects.map((r) => r.left)),
  top: Math.min(...rects.map((r) => r.top)),
  right: Math.max(...rects.map((r) => r.right)),
  bottom: Math.max(...rects.map((r) => r.bottom)),
})

export type FitOptions = {
  /** What the player has to see, as shapes on the table. The scene is centred on them: the middle of the smallest rectangle that holds them is the middle of the window */
  seen: readonly Quad[]
  /** What has to be in the window too, without weighing on the centre: what is pressed but not drawn, or reaches a little past what is seen */
  reach?: readonly Quad[]
  /** What the platform draws over the window (`hudBoxes`): the camera stands back until they cover little of what is seen (`coverage`), but not so far that the cards get small (`dodgeUnit`) */
  avoid?: readonly Rect[]
  /** The most of any one thing that is seen that the boxes of `avoid` may cover, as a share of its area (default 0.04): a corner of a card under a box is not worth a smaller table, a name under it is */
  coverage?: number
  /** The smallest the table may be made, in pixels for a unit of the table at the point the camera looks at, only to get out from under the boxes of `avoid` (default 6.5 % of the height of the window). Past it the table stays in the middle and big, and the boxes cover what they cover */
  dodgeUnit?: number
  /** The air kept between the table and the edge of the window, in pixels (default `PLATFORM_HUD.gap`) */
  gap?: number
  /** The nearest the camera may stand, so that a table in a big window does not fill it with a few huge cards (default 13) */
  nearest?: number
  /** The least a unit of the table may be at the point the camera looks at, in pixels: below it the cards of an opponent are too small to read (default 38) */
  leastUnit?: number
}

export type Fit = {
  /** The camera that was asked for, with the `distance` and the target worked out */
  camera: CameraSettings
  /** All of the table (what is seen and what is reached) is in the window */
  fits: boolean
  /** Nothing that is seen is covered by the boxes of `avoid` more than `coverage` allows */
  clear: boolean
  /** The largest share of any one thing that is seen that the boxes of `avoid` cover, from 0 to 1 */
  covered: number
}

/** How far the target may lie off the middle of the table, in world units, in either direction */
const REACH = 8

/**
 * The target that puts the middle of `seen` in the middle of the window for a camera that stands `d` away: the height of the middle only follows how far the target is along the ground (the table moves up as the target goes toward the far side), and its
 * place across only follows the target across, so each is a search for the zero of a number that always goes the same way.
 */
function centreOn(seen: readonly Quad[], d: number, base: CameraSettings, viewport: Viewport): [number, number] {
  const middle = (tx: number, tz: number): [number, number] => {
    const rect = unionOf(seen.map((quad) => windowRectOf(quad, d, tx, tz, base, viewport)))
    return [(rect.left + rect.right) / 2, (rect.top + rect.bottom) / 2]
  }
  const zero = (lo: number, hi: number, error: (value: number) => number) => {
    if (error(lo) <= 0) return lo
    if (error(hi) >= 0) return hi
    let [a, b] = [lo, hi]
    for (let i = 0; i < 42; i++) {
      const m = (a + b) / 2
      if (error(m) > 0) a = m
      else b = m
    }
    return (a + b) / 2
  }
  const tz = zero(base.targetZ - REACH, base.targetZ + REACH, (value) => middle(base.targetX, value)[1] - viewport.height / 2)
  const tx = zero(base.targetX - REACH, base.targetX + REACH, (value) => middle(value, tz)[0] - viewport.width / 2)
  // A table made the same on both sides is centred across by its own symmetry: no target a hair off it
  return [Math.abs(tx - base.targetX) < 1e-7 ? base.targetX : tx, tz]
}

/**
 * The camera for a window: the nearest that has the whole table in it, with the scene always in the middle. The middle of what is seen is the middle of the window, whatever the window, the number of seats or what the platform draws over it: the camera
 * only stands farther when the table does not fit, never off to a side. It also stands farther to get out from under the platform's boxes (`avoid`), while they cover more than `coverage` of any one thing that is seen, but never so far that a unit of the table is
 * smaller than `dodgeUnit` for that alone: in a small window the boxes cover a corner of a table in the middle rather than a table made small to be clear of them. If the table does not fit even at the farthest distance that still reads (`leastUnit`), it is
 * kept there, in the middle (`fits` is false). Keeps the tilt, the turn and the field of view of `base`.
 *
 * The rig of the table backs the camera off on a window narrower than 16:10 (`aspectScale`): the distances worked out here are where the camera really stands, and the `distance` of the camera given back is that divided by it. Pure: the same window gives
 * the same camera.
 */
export function fitCamera(
  viewport: Viewport,
  base: CameraSettings,
  { seen, reach = [], avoid = [], coverage = 0.04, dodgeUnit = viewport.height * 0.065, gap = PLATFORM_HUD.gap, nearest = 13, leastUnit = 38 }: FitOptions,
): Fit {
  const room: Rect = { left: gap, top: gap, right: viewport.width - gap, bottom: viewport.height - gap }
  const half = Math.tan((base.fov * RAD) / 2)
  const scale = aspectScale(viewport.width / viewport.height)
  const farthest = Math.max(nearest, viewport.height / 2 / (leastUnit * half))
  // The distance at which a unit of the table is `dodgeUnit` wide: no farther than this to get out from under the platform's boxes
  const dodgeLimit = Math.min(farthest, Math.max(nearest, viewport.height / 2 / (dodgeUnit * half)))
  const quads = [...seen, ...reach]
  const placeAt = (d: number) => {
    const [tx, tz] = centreOn(seen, d, base, viewport)
    return { d, tx, tz }
  }
  /** The table at a distance, centred: whether all of it is in the window, and the share of what is seen that the platform's boxes cover */
  const look = (d: number) => {
    const { tx, tz } = placeAt(d)
    const inside = quads.every((quad) => within(windowRectOf(quad, d, tx, tz, base, viewport), room))
    const rects = seen.map((quad) => windowRectOf(quad, d, tx, tz, base, viewport))
    // the worst of the things that are seen, not their sum: a plate half under a box is a name lost, whatever the size of the rest
    const covered = rects.reduce((worst, rect) => Math.max(worst, area(rect) > 0 ? Math.min(1, avoid.reduce((over, box) => over + common(rect, box), 0) / area(rect)) : 0), 0)
    return { inside, covered }
  }
  /** The nearest distance for which `ok` holds, a table only ever getting smaller, and further from the corners, as the camera backs off. Null when it holds at none up to `limit` */
  const nearestThat = (ok: (seen: ReturnType<typeof look>) => boolean, limit: number): number | null => {
    if (!ok(look(limit))) return null
    if (ok(look(nearest))) return nearest
    let [near, far] = [nearest, limit]
    for (let i = 0; i < 30; i++) {
      const mid = (near + far) / 2
      if (ok(look(mid))) far = mid
      else near = mid
    }
    return far
  }
  const insideAt = nearestThat((it) => it.inside, farthest)
  const result = (d: number): Fit => {
    const { tx, tz } = placeAt(d)
    const { inside, covered } = look(d)
    return { camera: { ...base, distance: d / scale, targetX: tx, targetZ: tz }, fits: inside, clear: covered <= coverage + 1e-9, covered }
  }
  // Not in the window at any distance that reads: the farthest, in the middle
  if (insideAt === null) return result(farthest)
  const clearAt = nearestThat((it) => it.inside && it.covered <= coverage + 1e-9, dodgeLimit)
  // Out from under the boxes when that costs no more than `dodgeUnit`; otherwise as near as the window allows, and no farther than `dodgeUnit` for the boxes' sake
  return result(clearAt ?? Math.max(insideAt, dodgeLimit))
}

/** How far the camera really stands for a window: the `distance` of its settings, backed off by the rig on a narrow window */
export const standingDistance = (camera: CameraSettings, { width, height }: Viewport) => camera.distance * aspectScale(width / height)
