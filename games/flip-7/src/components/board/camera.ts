import { aspectScale, type CameraSettings } from "@pbgo/table"
import { type Place, tableQuads } from "./layout"

/**
 * Where the camera looks at the table from, before the window is looked at: `fitCamera` stands it where the table fits (how far, and a little to the side). The Camera folder of the debug panel edits the object that `fitCamera` gave; it is
 * made again when the window or the number of players changes.
 */
export const CAMERA: CameraSettings = { tilt: 46, yaw: 0, distance: 23, fov: 34, targetX: 0, targetZ: 0.8 }

/** Where the share photo of the game over is taken from. The Share Photo folder edits this object, the photo reads it when it is taken */
export const PHOTO: CameraSettings = { tilt: 40, yaw: 0, distance: 44, fov: 28, targetX: 0, targetZ: 0 }

/** The size of the window the board is drawn in, in pixels */
export type Viewport = { width: number; height: number }

/** A rectangle of the window, in pixels */
export type Rect = { left: number; top: number; right: number; bottom: number }

/**
 * What the platform draws over the board, in pixels from the edges of the window: at the top left the log of the turns, text laid on the table (its box is 512 px wide, but the text fills what the longest line needs: a width of 320 is the room
 * kept for it), and at the top right the menu button and, under it, the list of the players, a row for each. Measured on the HUD of `@pbgo/core`, which this board does not own: when the HUD changes, these numbers change with it. The
 * table is kept clear of them, and of a `gap` of air around them.
 */
export const HUD = {
  ticker: { left: 24, top: 20, width: 320, height: 300 },
  column: { right: 24, width: 240, top: 84, row: 47.5, padding: 0 },
  gap: 12,
}

/** The boxes of the platform over a window for `players` players */
export function overlays({ width }: Viewport, players: number): Rect[] {
  const { ticker, column, gap } = HUD
  return [
    { left: 0, top: 0, right: ticker.left + ticker.width + gap, bottom: ticker.top + ticker.height + gap },
    { left: width - column.right - column.width - gap, top: 0, right: width, bottom: column.top + column.row * players + column.padding + gap },
  ]
}

const RAD = Math.PI / 180

/**
 * Where a point of the table, on the ground at (x, z), falls in the window for a camera that looks at (tx, tz) from `d` away, tilted by `tilt` and straight in front of the table (no yaw). For a point on the ground the projection comes to
 * this: its depth is `d` less how far past the target it lies along the line of sight, and its height on the screen follows how far past the target it lies on the ground.
 */
function screenOf(x: number, z: number, d: number, tx: number, tz: number, { tilt, fov }: CameraSettings, { width, height }: Viewport): [number, number] {
  const t = tilt * RAD
  const half = Math.tan((fov * RAD) / 2)
  const depth = d - (z - tz) * Math.sin(t)
  return [width / 2 + ((x - tx) / (depth * half * (width / height))) * (width / 2), height / 2 + (((z - tz) * Math.cos(t)) / (depth * half)) * (height / 2)]
}

/** The smallest rectangle of the window that holds a four-cornered shape lying on the table: a box of the table, turned as it is */
export function windowRectOf(quad: readonly Place[], d: number, tx: number, tz: number, camera: CameraSettings, viewport: Viewport): Rect {
  const points = quad.map(({ x, z }) => screenOf(x, z, d, tx, tz, camera, viewport))
  const xs = points.map(([x]) => x)
  const ys = points.map(([, y]) => y)
  return { left: Math.min(...xs), top: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys) }
}

const meets = (a: Rect, b: Rect) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
const within = (a: Rect, room: Rect) => a.left >= room.left && a.right <= room.right && a.top >= room.top && a.bottom <= room.bottom
const area = (a: Rect) => (a.right - a.left) * (a.bottom - a.top)
/** The area two rectangles have in common */
const common = (a: Rect, b: Rect) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))

/** The nearest the camera may stand, so that a table in a big window does not fill it with a few huge cards */
const NEAREST = 13
/** The least a unit of the table may be at the point the camera looks at, in pixels: below it the cards of an opponent are too small to read, and the table is left partly under the boxes of the platform instead */
const LEAST_UNIT = 38

/** How much nearer the camera could stand, in distance, that one pixel of the table off the middle of the window costs a thirtieth of: a table a little smaller and in the middle looks better than a bigger one that the platform's boxes push to a side */
const LOPSIDED_COST = 1 / 30
/** The farthest the camera may stand back from the nearest one that fits, to find a table more in the middle */
const SLACK = 3

/**
 * The camera for a table of `players` players in a window: the nearest that has the whole table in the window and clear of what the platform draws over it, give or take a little size for a table that stands more in the middle of the window.
 * A window too small for that, a full table in a small window, gets the farthest camera that still reads, stood where the table is the least under the platform's boxes (`fits` is false).
 * The rig of the table backs the camera off on a window narrower than 16:10 (`aspectScale`): the distances worked out here are where the camera really stands, and the `distance` of the camera given back is that divided by it.
 */
export function fitCamera(players: number, viewport: Viewport, base: CameraSettings = CAMERA, seated = true): { camera: CameraSettings; fits: boolean } {
  const boxes = tableQuads(players, seated)
  const avoid = overlays(viewport, players)
  const { gap } = HUD
  const room: Rect = { left: gap, top: gap, right: viewport.width - gap, bottom: viewport.height - gap }
  const half = Math.tan((base.fov * RAD) / 2)
  const scale = aspectScale(viewport.width / viewport.height)
  const farthest = Math.max(NEAREST, viewport.height / 2 / (LEAST_UNIT * half))
  // The ways to stand off the middle of the table, the nearest to the middle first
  const offsets: [number, number][] = []
  for (let x = -8; x <= 8; x += 0.5) for (let z = -8; z <= 8; z += 0.5) offsets.push([x, base.targetZ + z])
  const off = ([x, z]: [number, number]) => Math.abs(x) + Math.abs(z - base.targetZ)
  offsets.sort((a, b) => off(a) - off(b))
  /** The rectangle of the window that holds the whole table for a camera, or null when part of it is outside the window or under a box of the platform */
  const holdAll = (d: number, tx: number, tz: number): Rect | null => {
    let left = Infinity
    let top = Infinity
    let right = -Infinity
    let bottom = -Infinity
    for (const box of boxes) {
      const rect = windowRectOf(box, d, tx, tz, base, viewport)
      if (!within(rect, room) || avoid.some((over) => meets(rect, over))) return null
      left = Math.min(left, rect.left)
      top = Math.min(top, rect.top)
      right = Math.max(right, rect.right)
      bottom = Math.max(bottom, rect.bottom)
    }
    return { left, top, right, bottom }
  }
  const fitsAt = (d: number) => offsets.some(([tx, tz]) => holdAll(d, tx, tz) !== null)
  // From the farthest down: the first distance with no way to stand is where the table stops fitting
  let nearest: number | null = null
  for (let d = farthest; d >= NEAREST; d -= 0.5) {
    if (!fitsAt(d)) break
    nearest = d
  }
  if (nearest !== null) {
    for (let d = nearest - 0.1; d > nearest - 0.5 && d >= NEAREST; d -= 0.1) {
      if (!fitsAt(d)) break
      nearest = d
    }
    // From there a little farther back: the way to stand with the table the most in the middle of the window, a pixel off the middle costing as much as a thirtieth of a unit of distance
    let chosen: { d: number; at: [number, number]; cost: number } | null = null
    for (let d = nearest; d <= Math.min(farthest, nearest + SLACK) + 1e-9; d += 0.25) {
      for (const [tx, tz] of offsets) {
        const held = holdAll(d, tx, tz)
        if (!held) continue
        const lopsided = Math.abs((held.top + held.bottom) / 2 - viewport.height / 2) + Math.abs((held.left + held.right) / 2 - viewport.width / 2) / 2
        const cost = d - nearest + lopsided * LOPSIDED_COST
        if (!chosen || cost < chosen.cost - 1e-9) chosen = { d, at: [tx, tz], cost }
      }
    }
    const { d, at } = chosen!
    return { camera: { ...base, distance: d / scale, targetX: at[0], targetZ: at[1] }, fits: true }
  }
  // No room for the whole table: the farthest camera that reads, where the least of the table lies outside the window or under the platform's boxes, and then the nearest to the middle
  const hidden = ([tx, tz]: [number, number]) =>
    boxes.reduce((sum, box) => {
      const rect = windowRectOf(box, farthest, tx, tz, base, viewport)
      return sum + (area(rect) - common(rect, room)) + avoid.reduce((s, over) => s + common(rect, over), 0)
    }, 0)
  let least = offsets[0]!
  let leastHidden = hidden(least)
  for (const offset of offsets) {
    const covered = hidden(offset)
    if (covered < leastHidden - 1e-6) {
      least = offset
      leastHidden = covered
    }
  }
  return { camera: { ...base, distance: farthest / scale, targetX: least[0], targetZ: least[1] }, fits: false }
}

/** How far the camera really stands for a window: the `distance` of its settings, backed off by the rig on a narrow window */
export const standingDistance = (camera: CameraSettings, { width, height }: Viewport) => camera.distance * aspectScale(width / height)

/** The camera for a table of `n` players in a window (`fitCamera`); a spectator has no seat in front */
export const cameraFor = (n: number, viewport: Viewport, seated = true): CameraSettings => fitCamera(n, viewport, CAMERA, seated).camera
