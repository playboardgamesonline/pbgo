import type { CameraSettings } from "@pbgo/table"
import { tableOf } from "./layout"

/** Where the camera looks at the table from. The Camera folder of the debug panel (the shared `Table` makes it) edits this object, the table reads it on every frame. How far it stands depends on the table (`cameraFor`) */
export const CAMERA: CameraSettings = { tilt: 46, yaw: 0, distance: 23, fov: 34, targetX: 0, targetZ: 0.8 }

/** Where the share photo of the game over is taken from. The Share Photo folder edits this object, the photo reads it when it is taken */
export const PHOTO: CameraSettings = { tilt: 40, yaw: 0, distance: 44, fov: 28, targetX: 0, targetZ: 0 }

/** The camera for a table of `n` players: the same view, standing as far from the table as its ring needs, so that every seat is in the picture and no card is smaller than it has to be. */
export const cameraFor = (n: number): CameraSettings => ({ ...CAMERA, distance: tableOf(n).distance })
