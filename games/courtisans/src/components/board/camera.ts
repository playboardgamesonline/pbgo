import type { CameraIntro, CameraSettings } from "@pbgo/table"

/**
 * Where the camera looks at the table from. Plain objects the table reads on every frame: the Camera folder of the debug panel edits them. The table is a long strip of a mat with a domain at each side of it, so the camera stands far and high.
 */
export const CAMERA: CameraSettings = { tilt: 40, yaw: 0, distance: 37.6, fov: 26.5, targetX: 0, targetZ: 0.6 }

/** The entrance of the camera, when the opening begins: it starts farther, turned and tilted, and settles on `CAMERA`. */
export const INTRO: CameraIntro = { enabled: true, duration: 2.6, zoom: 1.45, rotate: 22, tilt: 12 }

/** The camera of the share photo of the finished table: farther, so that the whole table is in the picture. */
export const PHOTO: CameraSettings = { tilt: 34, yaw: 0, distance: 50, fov: 28, targetX: 0, targetZ: -0.8 }
