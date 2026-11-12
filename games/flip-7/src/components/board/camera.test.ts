import type { CameraSettings } from "@pbgo/table"
import { describe, expect, it } from "vitest"
import { CAMERA, fitCamera, HUD, overlays, type Rect, standingDistance, type Viewport, windowRectOf } from "./camera"
import { tableFootprints } from "./layout"

const PLAYERS = [3, 4, 5, 6, 7, 8]
/** Windows a laptop or a desktop has, the width and the height of the browser's own content */
const DESKTOP: Viewport[] = [
  { width: 1280, height: 720 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
  { width: 2560, height: 1080 },
]
/** A tablet held upright: wider than the wall of the platform's phone screen, taller than it is wide */
const UPRIGHT: Viewport[] = [
  { width: 900, height: 1200 },
  { width: 1024, height: 1366 },
]

/** The projection of a point of the world by a camera, written the long way (a camera looking at its target from a distance, a field of view, a window), to check the shortcut for points on the ground against it */
function projected([x, y, z]: [number, number, number], { tilt, distance, fov, targetX, targetZ }: CameraSettings, { width, height }: Viewport): [number, number] {
  const t = (tilt * Math.PI) / 180
  const eye = [targetX, distance * Math.cos(t), targetZ + distance * Math.sin(t)]
  const forward = [0, -Math.cos(t), -Math.sin(t)]
  const right = [1, 0, 0]
  const up = [right[1]! * forward[2]! - right[2]! * forward[1]!, right[2]! * forward[0]! - right[0]! * forward[2]!, right[0]! * forward[1]! - right[1]! * forward[0]!]
  const v = [x - eye[0]!, y - eye[1]!, z - eye[2]!]
  const dot = (a: number[], b: number[]) => a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!
  const depth = dot(v, forward)
  const half = Math.tan(((fov * Math.PI) / 180) / 2)
  return [width / 2 + (dot(v, right) / (depth * half * (width / height))) * (width / 2), height / 2 - (dot(v, up) / (depth * half)) * (height / 2)]
}

const meets = (a: Rect, b: Rect) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top

describe("the shortcut for the ground", () => {
  it("lands where the long projection puts the corners of a footprint, for any camera and window", () => {
    const cameras: CameraSettings[] = [CAMERA, { ...CAMERA, distance: 17.5, targetX: 1.5, targetZ: -0.4 }, { ...CAMERA, tilt: 60, distance: 30, targetZ: 2 }]
    const windows: Viewport[] = [{ width: 1280, height: 800 }, { width: 900, height: 1200 }, { width: 2560, height: 1080 }]
    const [box] = tableFootprints(5)
    for (const camera of cameras) {
      for (const viewport of windows) {
        const rect = windowRectOf(box!, camera.distance, camera.targetX, camera.targetZ, camera, viewport)
        const corners = [
          projected([box!.x0, 0, box!.z0], camera, viewport),
          projected([box!.x1, 0, box!.z0], camera, viewport),
          projected([box!.x0, 0, box!.z1], camera, viewport),
          projected([box!.x1, 0, box!.z1], camera, viewport),
        ]
        expect(rect.left).toBeCloseTo(Math.min(...corners.map(([x]) => x)), 6)
        expect(rect.right).toBeCloseTo(Math.max(...corners.map(([x]) => x)), 6)
        expect(rect.top).toBeCloseTo(Math.min(...corners.map(([, y]) => y)), 6)
        expect(rect.bottom).toBeCloseTo(Math.max(...corners.map(([, y]) => y)), 6)
      }
    }
  })
})

describe("the camera fitted to a window", () => {
  it("brings the whole table into the window and keeps it clear of what the platform draws over it, for every table on a laptop or a desktop", () => {
    for (const viewport of DESKTOP) {
      for (const players of PLAYERS) {
        const { camera, fits } = fitCamera(players, viewport)
        const label = `${players} players in ${viewport.width}x${viewport.height}`
        expect(fits, label).toBe(true)
        for (const box of tableFootprints(players)) {
          const rect = windowRectOf(box, standingDistance(camera, viewport), camera.targetX, camera.targetZ, camera, viewport)
          expect(rect.left, label).toBeGreaterThanOrEqual(HUD.gap - 1e-6)
          expect(rect.top, label).toBeGreaterThanOrEqual(HUD.gap - 1e-6)
          expect(rect.right, label).toBeLessThanOrEqual(viewport.width - HUD.gap + 1e-6)
          expect(rect.bottom, label).toBeLessThanOrEqual(viewport.height - HUD.gap + 1e-6)
          for (const over of overlays(viewport, players)) expect(meets(rect, over), label).toBe(false)
        }
      }
    }
  })

  it("fits a tablet held upright too, where the table has the width of the window and the platform's boxes only take the top", () => {
    for (const viewport of UPRIGHT) for (const players of PLAYERS) expect(fitCamera(players, viewport).fits, `${players} players in ${viewport.width}x${viewport.height}`).toBe(true)
  })

  it("stands nearer in a bigger window, so that the cards are bigger there", () => {
    for (const players of PLAYERS) {
      const small = standingDistance(fitCamera(players, { width: 1280, height: 720 }).camera, { width: 1280, height: 720 })
      const big = standingDistance(fitCamera(players, { width: 1920, height: 1080 }).camera, { width: 1920, height: 1080 })
      expect(big, `${players} players`).toBeLessThanOrEqual(small + 1e-9)
    }
  })

  it("keeps the tilt, the turn and the field of view of the camera it starts from", () => {
    const { camera } = fitCamera(6, { width: 1440, height: 900 })
    expect([camera.tilt, camera.yaw, camera.fov]).toEqual([CAMERA.tilt, CAMERA.yaw, CAMERA.fov])
  })

  it("gives a full table in a window that is too small the farthest camera that still reads, and says it does not fit", () => {
    const { camera, fits } = fitCamera(8, { width: 900, height: 600 })
    expect(fits).toBe(false)
    expect(Number.isFinite(camera.distance)).toBe(true)
    expect(camera.distance).toBeGreaterThan(0)
  })

  it("leaves less of a table that does not fit under the platform's boxes or out of the window than the middle of the table would", () => {
    const hidden = (players: number, viewport: Viewport, camera: CameraSettings) => {
      const room: Rect = { left: HUD.gap, top: HUD.gap, right: viewport.width - HUD.gap, bottom: viewport.height - HUD.gap }
      const area = (r: Rect) => (r.right - r.left) * (r.bottom - r.top)
      const common = (a: Rect, b: Rect) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))
      return tableFootprints(players).reduce((sum, box) => {
        const rect = windowRectOf(box, standingDistance(camera, viewport), camera.targetX, camera.targetZ, camera, viewport)
        return sum + (area(rect) - common(rect, room)) + overlays(viewport, players).reduce((s, over) => s + common(rect, over), 0)
      }, 0)
    }
    // the windows that are too small for some of the tables: each table that does not fit there is looked at, and there are some
    const cases = ([900, 1024] as const).flatMap((width) => ([600, 768] as const).flatMap((height) => PLAYERS.map((players) => [players, { width, height }] as const)))
    const unfit = cases.filter(([players, viewport]) => !fitCamera(players, viewport).fits)
    expect(unfit.length).toBeGreaterThanOrEqual(3)
    for (const [players, viewport] of unfit) {
      const { camera } = fitCamera(players, viewport)
      expect(hidden(players, viewport, camera), `${players} players in ${viewport.width}x${viewport.height}`).toBeLessThanOrEqual(hidden(players, viewport, { ...camera, targetX: CAMERA.targetX, targetZ: CAMERA.targetZ }) + 1e-6)
    }
  })

  it("does the same for the same window every time", () => {
    expect(fitCamera(5, { width: 1366, height: 768 })).toEqual(fitCamera(5, { width: 1366, height: 768 }))
  })
})
