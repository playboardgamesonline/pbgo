import { type CameraSettings, type Fit, fitCamera, hudBoxes, type Viewport } from "@pbgo/table"
import { tableQuads } from "./layout"

/**
 * Where the camera looks at the table from, before the window is looked at: `fitFor` stands it where the table fits (how far, and the place it looks at, which puts the table in the middle of the window). The Camera folder of the debug panel edits the object that `fitFor`
 * gave; it is made again when the window or the number of players changes.
 */
export const CAMERA: CameraSettings = { tilt: 46, yaw: 0, distance: 23, fov: 34, targetX: 0, targetZ: 0.8 }

/** Where the share photo of the game over is taken from. The Share Photo folder edits this object, the photo reads it when it is taken */
export const PHOTO: CameraSettings = { tilt: 40, yaw: 0, distance: 44, fov: 28, targetX: 0, targetZ: 0 }

/**
 * The least a unit of the table may be at the point the camera looks at, in pixels (the kit's is 38): twelve cards a seat and eight seats must fit a tablet held across (1024 by 768), so the cards of the seats at the far side are small there (about 15 to 20 px wide at eight
 * seats). Below it the table is kept in the middle and `fits` is false. It is also how small the table may be made to get out from under the platform's boxes (`dodgeUnit`, which the kit holds at 6.5 % of the window's height unless told): a grid of twelve cards under the log of the turns
 * is worse than smaller cards.
 */
const LEAST_UNIT = 30

/**
 * The camera for a table of `players` players in a window, from `fitCamera` of the table kit: the middle of what is seen (the plates, the grids, the piles and the strip of the middle) is the middle of the window, and the camera is as near as it can be with the whole table in it
 * and, while it can, clear of what the platform draws over it. A spectator has no seat in front.
 */
export const fitFor = (players: number, viewport: Viewport, base: CameraSettings = CAMERA, seated = true): Fit =>
  fitCamera(viewport, base, { seen: tableQuads(players, seated), avoid: hudBoxes(viewport, players), leastUnit: LEAST_UNIT, dodgeUnit: LEAST_UNIT })

/** The camera of `fitFor`, for the board */
export const cameraFor = (n: number, viewport: Viewport, seated = true): CameraSettings => fitFor(n, viewport, CAMERA, seated).camera
