import { type Camera, Plane, Raycaster, Vector2, Vector3 } from "three"
import type { Pose } from "../pose"
import type { Point } from "./shapes"

/** The box of the canvas on the page, in CSS pixels: what `getBoundingClientRect()` of its element gives */
export type Box = { left: number; top: number; width: number; height: number }

const raycaster = new Raycaster()
const ndc = new Vector2()
const plane = new Plane(new Vector3(0, 1, 0), 0)
const hit = new Vector3()

/**
 * Where the pointer is on the table: the point of the horizontal plane `height` above the table that the ray from the camera through the pointer meets, as `[x, z]`. `clientX` and `clientY` are where the pointer is on the page. Null when the ray never
 * meets that plane ahead of the camera (the pointer is above the horizon) or when the canvas has no size. The camera is read as the last frame left it, which is what the player sees.
 */
export function pointOnTable(camera: Camera, box: Box, clientX: number, clientY: number, height: number): Point | null {
  if (!(box.width > 0) || !(box.height > 0)) return null
  ndc.set(((clientX - box.left) / box.width) * 2 - 1, -(((clientY - box.top) / box.height) * 2 - 1))
  raycaster.setFromCamera(ndc, camera)
  // The plane is the points with y + constant = 0
  plane.constant = -height
  return raycaster.ray.intersectPlane(plane, hit) ? [hit.x, hit.z] : null
}

/** The point, or the point of the circle of radius `reach` round the middle of the table that is nearest to it when it is farther out: a pointer just under the horizon meets the table very far away */
export function withinReach(point: Point, reach: number): Point {
  const distance = Math.hypot(point[0], point[1])
  return distance <= reach ? point : [(point[0] * reach) / distance, (point[1] * reach) / distance]
}

/**
 * The pose a dragged thing is drawn at, written into `out` and returned: at (`x`, `z`), `lift` above the height of its place, `grow` times as big as it is at rest and turned the way it is at rest. `home` is the pose its place gives it. Nothing is
 * allocated, so a frame can call it for every dragged thing.
 */
export function dragGoal(out: Pose, home: Pose, x: number, z: number, lift: number, grow: number): Pose {
  out.position.set(x, home.position.y + lift, z)
  out.quaternion.copy(home.quaternion)
  out.scale = home.scale * grow
  return out
}
