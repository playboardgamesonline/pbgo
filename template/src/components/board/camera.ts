import type { CameraSettings } from "@pbgo/table"

/** Where the camera looks at the table from. The Camera folder of the debug panel (the shared `Table` makes it) edits this object, the table reads it on every frame */
export const CAMERA: CameraSettings = { tilt: 42, yaw: 0, distance: 21, fov: 34, targetX: 0, targetZ: 1.2 }

/** Where the share photo of the game over is taken from. The Share Photo folder edits this object, the photo reads it when it is taken */
export const PHOTO: CameraSettings = { tilt: 34, yaw: 0, distance: 50, fov: 28, targetX: 0, targetZ: -0.8 }
