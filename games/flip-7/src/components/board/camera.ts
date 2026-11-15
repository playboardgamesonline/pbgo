import { type CameraSettings, type Fit, fitCamera, hudBoxes, type Viewport } from "@pbgo/table"
import { reachQuads, seenQuads } from "./layout"

/**
 * Where the camera looks at the table from, before the window is looked at: `fitFor` stands it where the table fits (how far, and the place it looks at, which puts the table in the middle of the window). The Camera folder of the debug panel edits the object
 * that `fitFor` gave; it is made again when the window or the number of players changes.
 */
export const CAMERA: CameraSettings = { tilt: 46, yaw: 0, distance: 23, fov: 34, targetX: 0, targetZ: 0.8 }

/** Where the share photo of the game over is taken from. The Share Photo folder edits this object, the photo reads it when it is taken */
export const PHOTO: CameraSettings = { tilt: 40, yaw: 0, distance: 44, fov: 28, targetX: 0, targetZ: 0 }

/**
 * The camera for a table of `players` players in a window, from `fitCamera` of the table kit: the middle of what is seen (the plates, the lines, the piles and the buttons) is the middle of the window, and the camera is as near as it can be with the zones that
 * are pressed in the window too and, while it can, clear of what the platform draws over the board. A spectator has no seat in front.
 */
export const fitFor = (players: number, viewport: Viewport, base: CameraSettings = CAMERA, seated = true): Fit =>
  fitCamera(viewport, base, { seen: seenQuads(players, seated), reach: reachQuads(players, seated), avoid: hudBoxes(viewport, players) })

/** The camera of `fitFor`, for the board */
export const cameraFor = (n: number, viewport: Viewport, seated = true): CameraSettings => fitFor(n, viewport, CAMERA, seated).camera
