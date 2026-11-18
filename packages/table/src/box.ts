import { Vector3 } from "three"
import type { CardSize } from "./card/geometry"
import { inFrame, type Spot } from "./layout"
import type { Pose } from "./pose"

/**
 * A rectangle on the table whose sides run along x and z, in world units: x to the right, z toward the viewer, so "above" on the screen is toward the least z. It is what a layout is boxed in, whichever way it is turned: the plate of a seat stands above the
 * box of the player's cards.
 */
export type TableBox = { minX: number; maxX: number; minZ: number; maxZ: number }

/** The box of a rectangle `width` wide along its own x and `depth` deep along its own z, centred at (`x`, `z`) and turned `yaw` about the vertical axis */
export function boxOfRect({ x, z, width, depth, yaw = 0 }: { x: number; z: number; width: number; depth: number; yaw?: number }): TableBox {
  const cos = Math.abs(Math.cos(yaw))
  const sin = Math.abs(Math.sin(yaw))
  const halfX = (cos * width + sin * depth) / 2
  const halfZ = (sin * width + cos * depth) / 2
  return { minX: x - halfX, maxX: x + halfX, minZ: z - halfZ, maxZ: z + halfZ }
}

/** The smallest box that holds all of `boxes`, and `null` when there is none (a player with no cards has no box) */
export function joinBoxes(boxes: readonly (TableBox | null)[]): TableBox | null {
  let joined: TableBox | null = null
  for (const box of boxes) {
    if (!box) continue
    joined = joined ? { minX: Math.min(joined.minX, box.minX), maxX: Math.max(joined.maxX, box.maxX), minZ: Math.min(joined.minZ, box.minZ), maxZ: Math.max(joined.maxZ, box.maxZ) } : box
  }
  return joined
}

const corner = new Vector3()
const CORNERS = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
] as const

/** What `boxOfPoses` reads besides the cards */
export type BoxOptions = {
  /** The frame the poses are drawn in, as a `Zone` takes it: a layout drawn once and put where a player sits. Without it the poses are in the world */
  frame?: Spot
  /**
   * The camera's tilt in degrees from the vertical, as `CameraSettings.tilt`: the box is then what the camera sees of the cards and not only where they lie. A card that stands off the table (a hand that leans toward its player) hides the part of the table behind it as seen from
   * the camera, so its apparent footprint reaches farther from the viewer (toward the least z) by its height times the tangent of the tilt. Leave it out for cards that lie flat. The sideways slant of the view is left out: the camera is far enough for it to be small.
   */
  tilt?: number
}

/**
 * The box of the cards laid in `poses`: the four corners of every card, as its pose scales, turns and places it, so a card that stands up or leans over is boxed by what it covers of the table. With `tilt` it is boxed by what the camera sees of it. `null` for no card.
 */
export function boxOfPoses(poses: readonly Pose[], size: CardSize, { frame, tilt }: BoxOptions = {}): TableBox | null {
  const slant = tilt === undefined ? 0 : Math.tan((tilt * Math.PI) / 180)
  let box: TableBox | null = null
  for (const given of poses) {
    const pose = frame ? inFrame(frame, given) : given
    for (const [sx, sy] of CORNERS) {
      corner
        .set((sx * size.width) / 2, (sy * size.height) / 2, 0)
        .multiplyScalar(pose.scale)
        .applyQuaternion(pose.quaternion)
        .add(pose.position)
      const z = corner.z - corner.y * slant
      box = box
        ? { minX: Math.min(box.minX, corner.x), maxX: Math.max(box.maxX, corner.x), minZ: Math.min(box.minZ, z), maxZ: Math.max(box.maxZ, z) }
        : { minX: corner.x, maxX: corner.x, minZ: z, maxZ: z }
    }
  }
  return box
}

/**
 * The box of the cards laid in `poses`, in the frame of a seat: the poses are the ones a `Zone` takes with that `frame` (drawn in it, x to the right of the seat and the least z toward the middle of the table), and the box is in the frame too, so that the plate of a seat stands on the
 * side of the cards that faces the middle of the table whichever way the seat is turned. With `tilt`, the camera's tilt as `CameraSettings.tilt`, it is the box of what the camera sees, as for `boxOfPoses`: the part a card that stands off the table hides is the way the screen
 * shows it, which the frame turns with the seat. `null` for no card.
 */
export function frameBoxOfPoses(poses: readonly Pose[], size: CardSize, frame: Spot, { tilt }: { tilt?: number } = {}): TableBox | null {
  const slant = tilt === undefined ? 0 : Math.tan((tilt * Math.PI) / 180)
  const yaw = frame.yaw ?? 0
  // The screen's way up, the least world z, in the frame: a card raised by `y` shows `y * slant` farther up the screen
  const sin = Math.sin(yaw)
  const cos = Math.cos(yaw)
  let box: TableBox | null = null
  for (const pose of poses) {
    for (const [sx, sy] of CORNERS) {
      corner
        .set((sx * size.width) / 2, (sy * size.height) / 2, 0)
        .multiplyScalar(pose.scale)
        .applyQuaternion(pose.quaternion)
        .add(pose.position)
      const lift = corner.y * slant
      const x = corner.x + lift * sin
      const z = corner.z - lift * cos
      box = box ? { minX: Math.min(box.minX, x), maxX: Math.max(box.maxX, x), minZ: Math.min(box.minZ, z), maxZ: Math.max(box.maxZ, z) } : { minX: x, maxX: x, minZ: z, maxZ: z }
    }
  }
  return box
}

/** The world place of a point (`x`, `z`) drawn in the frame of a spot: it turns first, then moves, as `inFrame` does for a pose */
export function pointInFrame(frame: Spot, { x, z }: { x: number; z: number }): { x: number; z: number } {
  const yaw = frame.yaw ?? 0
  return { x: frame.x + x * Math.cos(yaw) + z * Math.sin(yaw), z: frame.z - x * Math.sin(yaw) + z * Math.cos(yaw) }
}

/** The four corners of a box drawn in the frame of a spot, in the world, going round: what a plate or an area covers of the table when its seat is turned */
export function cornersOfBox(box: TableBox, frame: Spot): { x: number; z: number }[] {
  return [
    { x: box.minX, z: box.minZ },
    { x: box.maxX, z: box.minZ },
    { x: box.maxX, z: box.maxZ },
    { x: box.minX, z: box.maxZ },
  ].map((point) => pointInFrame(frame, point))
}

/** The middle of a box */
export const centreOf = (box: TableBox) => ({ x: (box.minX + box.maxX) / 2, z: (box.minZ + box.maxZ) / 2 })

/** Whether two boxes cover some of the table together. With `by`, boxes closer than that count too: the clear space a layout keeps between two things (default 0: boxes that only touch do not overlap) */
export function boxesOverlap(a: TableBox, b: TableBox, by = 0): boolean {
  return a.minX < b.maxX + by && b.minX < a.maxX + by && a.minZ < b.maxZ + by && b.minZ < a.maxZ + by
}
