import type { PerspectiveCamera } from "three"

const RAD = Math.PI / 180

/** Where the camera looks at the table from: `tilt` is measured from the vertical (0 looks straight down), `yaw` turns around the table, both in degrees; `distance` is in world units; `fov` is the vertical field of view in degrees; `targetX` / `targetZ` is the point of the table in the middle of the picture */
export type CameraSettings = {
  tilt: number
  yaw: number
  distance: number
  fov: number
  targetX: number
  targetZ: number
}

/** The camera's entrance: it starts `zoom` times farther, `rotate` degrees around and `tilt` degrees more tilted, then settles into `CameraSettings` over `duration` seconds */
export type CameraIntro = { enabled: boolean; duration: number; zoom: number; rotate: number; tilt: number }

/** The defaults of the entrance. Copy it for a game's own knobs: the camera reads the object it is given on every frame */
export const CAMERA_INTRO: CameraIntro = { enabled: true, duration: 2.6, zoom: 1.45, rotate: 22, tilt: 12 }

/** The camera never sinks below this height, so a flat view still clears the table */
export const MIN_HEIGHT = 0.5

/** A table framed for a 1.6 aspect ratio keeps its distance on wider screens and backs the camera off on narrower ones, so it always fits */
export const aspectScale = (aspect: number) => (aspect > 0 ? Math.max(1, 1.6 / aspect) : 1)

/** How much of the entrance is left `now` (milliseconds) when it began at `startedAt`: 1 at its start, 0 once settled, and 0 when it is off or has not begun */
export function introRest(intro: CameraIntro, startedAt: number | null, now: number) {
  if (!intro.enabled || startedAt === null || !(intro.duration > 0)) return 0
  const progress = Math.min(1, Math.max(0, (now - startedAt) / (intro.duration * 1000)))
  return (1 - progress) ** 3
}

export type Placement = {
  /** Multiplies the distance: the live camera backs off on narrow screens (see `aspectScale`) */
  distanceScale?: number
  /** How much of the entrance is left (see `introRest`) */
  rest?: number
  /** The entrance that `rest` is a share of */
  intro?: CameraIntro
}

/** Puts a camera where `settings` say, looking at the target, with the entrance `rest` still has to cover. The same maths places the live camera and the camera of the share photo */
export function placeCamera(camera: PerspectiveCamera, settings: CameraSettings, { distanceScale = 1, rest = 0, intro = CAMERA_INTRO }: Placement = {}) {
  const distance = settings.distance * distanceScale * (1 + (intro.zoom - 1) * rest)
  const tilt = Math.max(0, settings.tilt + intro.tilt * rest) * RAD
  const yaw = (settings.yaw + intro.rotate * rest) * RAD
  camera.up.set(0, 1, 0)
  camera.position.set(
    settings.targetX + distance * Math.sin(tilt) * Math.sin(yaw),
    Math.max(MIN_HEIGHT, distance * Math.cos(tilt)),
    settings.targetZ + distance * Math.sin(tilt) * Math.cos(yaw),
  )
  // Straight above the target "up" has no direction left on the screen: take the table's far side
  if (tilt < 0.001) camera.up.set(-Math.sin(yaw), 0, -Math.cos(yaw))
  camera.lookAt(settings.targetX, 0, settings.targetZ)
  if (camera.fov !== settings.fov) {
    camera.fov = settings.fov
    camera.updateProjectionMatrix()
  }
}
