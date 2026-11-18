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

/** The middle of a box */
export const centreOf = (box: TableBox) => ({ x: (box.minX + box.maxX) / 2, z: (box.minZ + box.maxZ) / 2 })

/** Whether two boxes cover some of the table together. With `by`, boxes closer than that count too: the clear space a layout keeps between two things (default 0: boxes that only touch do not overlap) */
export function boxesOverlap(a: TableBox, b: TableBox, by = 0): boolean {
  return a.minX < b.maxX + by && b.minX < a.maxX + by && a.minZ < b.maxZ + by && b.minZ < a.maxZ + by
}
