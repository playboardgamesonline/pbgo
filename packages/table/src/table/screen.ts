import { type Camera, Vector3 } from "three"

/** A place on the table, in world units */
export type Place = { x: number; z: number }

const ray = new Vector3()
const eye = new Vector3()

/**
 * The place of the table that a point of the screen shows, read from the camera: `x` and `y` run from -1 to 1 across and up the picture. The table is seen through a camera, so where a corner of the screen falls on it depends on the window and on the view, and a thing that is
 * laid at a corner of the screen asks the camera where that is. Call `camera.updateMatrixWorld()` first when the camera has just moved.
 *
 * `height` is how high above the table the thing stands: the place it must be at, on the table, for something at that height to show at the point of the screen. A thing that stands up is nearer the camera than the table under it, so it shows larger and farther out, and a
 * hand that is laid by the table's own point reaches out of the picture (default 0: what lies on the table).
 */
export function onTableAt(camera: Camera, x: number, y: number, height = 0): Place {
  ray.set(x, y, 0.5).unproject(camera)
  eye.copy(camera.position)
  ray.sub(eye).normalize()
  const t = ray.y < -1e-4 ? (height - eye.y) / ray.y : 0
  return { x: eye.x + ray.x * t, z: eye.z + ray.z * t }
}

/**
 * Where the hand of the viewer lies on the screen, as the points of the picture (-1 to 1 across and up) the hand is laid between: `left` is just inside the left edge, `middle` the right end of the room it may take, `row` the height of its row. The bottom left of the screen,
 * the hand of the viewer in front of them, as in Courtisans
 */
export const CORNER_SCREEN = { left: -0.96, middle: -0.2, row: -0.6 }

/** The frame of a hand put at a corner of the screen: its middle on the table, how wide it may be, how deep that makes it, and how much smaller than the layout it was drawn at it has to be to fit */
export type CornerFrame = { x: number; z: number; width: number; depth: number; scale: number }

/**
 * The frame of a hand put in the bottom left of the screen, from two places of the table that the screen shows at its bottom left: where the left edge of the picture meets the row the hand lies on, and where the right end of its room does. The hand is as wide as the room
 * between them, never wider than `most` (the width the hand is drawn at), and its depth follows: `scale` is the share of the layout that fits, 1 when the room is wide enough.
 */
export function cornerFrame(left: Place, middle: Place, { most, depth }: { most: number; depth: number }): CornerFrame {
  const room = Math.max(0.1, Math.abs(middle.x - left.x))
  const width = Math.min(room, most)
  const scale = width / most
  return { x: left.x + width / 2, z: left.z, width, depth: depth * scale, scale }
}
