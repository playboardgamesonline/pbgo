import { hudBoxes, PLATFORM_HUD, type Quad, type Rect, standingDistance, type Viewport, windowRectOf } from "@pbgo/table"
import { describe, expect, it } from "vitest"
import { CAMERA, fitFor } from "./camera"
import { reachQuads, seenQuads } from "./layout"

const PLAYERS = [3, 4, 5, 6, 7, 8]
/** Windows a laptop or a desktop has, the width and the height of the browser's own content */
const DESKTOP: Viewport[] = [
  { width: 1280, height: 720 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
  { width: 1512, height: 860 },
  { width: 1920, height: 1080 },
  { width: 2560, height: 1080 },
]
/** A tablet held upright: wider than the wall of the platform's phone screen, taller than it is wide */
const UPRIGHT: Viewport[] = [
  { width: 900, height: 1200 },
  { width: 1024, height: 1366 },
]

const rectsOf = (players: number, viewport: Viewport, seated: boolean, quads: Quad[]) => {
  const { camera } = fitFor(players, viewport, CAMERA, seated)
  return quads.map((quad) => windowRectOf(quad, standingDistance(camera, viewport), camera.targetX, camera.targetZ, camera, viewport))
}
const middleOf = (rects: Rect[]) => ({
  x: (Math.min(...rects.map((r) => r.left)) + Math.max(...rects.map((r) => r.right))) / 2,
  y: (Math.min(...rects.map((r) => r.top)) + Math.max(...rects.map((r) => r.bottom))) / 2,
})

describe("the camera fitted to a window", () => {
  it("puts the middle of the table in the middle of the window, for every table on a laptop or a desktop", () => {
    for (const viewport of DESKTOP) {
      for (const players of PLAYERS) {
        const label = `${players} players in ${viewport.width}x${viewport.height}`
        const middle = middleOf(rectsOf(players, viewport, true, seenQuads(players)))
        expect(Math.abs(middle.x - viewport.width / 2), label).toBeLessThan(0.5)
        expect(Math.abs(middle.y - viewport.height / 2), label).toBeLessThan(0.5)
      }
    }
  })

  it("does as much for a spectator, whose seats are spread round the table with none in front", () => {
    for (const viewport of DESKTOP) {
      for (const players of PLAYERS) {
        const label = `${players} players in ${viewport.width}x${viewport.height}, spectator`
        const middle = middleOf(rectsOf(players, viewport, false, seenQuads(players, false)))
        expect(Math.abs(middle.x - viewport.width / 2), label).toBeLessThan(0.5)
        expect(Math.abs(middle.y - viewport.height / 2), label).toBeLessThan(0.5)
      }
    }
  })

  it("keeps the camera across the table: it never stands to a side of it to get out from under the platform's boxes", () => {
    for (const viewport of [...DESKTOP, ...UPRIGHT]) for (const players of PLAYERS) expect(fitFor(players, viewport).camera.targetX, `${players} players in ${viewport.width}x${viewport.height}`).toBe(CAMERA.targetX)
  })

  it("brings the whole table into the window, the zones that are pressed included, with the gap of air round it", () => {
    for (const viewport of [...DESKTOP, ...UPRIGHT]) {
      for (const players of PLAYERS) {
        const label = `${players} players in ${viewport.width}x${viewport.height}`
        expect(fitFor(players, viewport).fits, label).toBe(true)
        for (const rect of [...rectsOf(players, viewport, true, seenQuads(players)), ...rectsOf(players, viewport, true, reachQuads(players))]) {
          expect(rect.left, label).toBeGreaterThanOrEqual(PLATFORM_HUD.gap - 1e-6)
          expect(rect.top, label).toBeGreaterThanOrEqual(PLATFORM_HUD.gap - 1e-6)
          expect(rect.right, label).toBeLessThanOrEqual(viewport.width - PLATFORM_HUD.gap + 1e-6)
          expect(rect.bottom, label).toBeLessThanOrEqual(viewport.height - PLATFORM_HUD.gap + 1e-6)
        }
      }
    }
  })

  it("keeps the cards big enough to read in every window of a laptop or a desktop: a unit of the table is at least 38 pixels at the point the camera looks at", () => {
    const half = Math.tan((CAMERA.fov * Math.PI) / 360)
    for (const viewport of DESKTOP) {
      for (const players of PLAYERS) {
        const { camera } = fitFor(players, viewport)
        expect(viewport.height / 2 / (standingDistance(camera, viewport) * half), `${players} players in ${viewport.width}x${viewport.height}`).toBeGreaterThanOrEqual(38 - 1e-6)
      }
    }
  })

  it("keeps the platform's boxes off the table in a window a desktop has, and lets them cover the edge of a plate in a window a laptop has, rather than making the table small", () => {
    for (const viewport of DESKTOP) {
      for (const players of PLAYERS) {
        const { covered } = fitFor(players, viewport)
        // the share of the worst-covered thing that is seen: the log of the turns and the list of the players lie over the far corners of a table in a small window
        const most = viewport.height >= 1000 ? 0.04 : viewport.height >= 860 ? 0.1 : 0.45
        expect(covered, `${players} players in ${viewport.width}x${viewport.height}`).toBeLessThanOrEqual(most + 1e-9)
      }
    }
  })

  it("stands nearer in a bigger window, so that the cards are bigger there", () => {
    for (const players of PLAYERS) {
      const small = standingDistance(fitFor(players, { width: 1280, height: 720 }).camera, { width: 1280, height: 720 })
      const big = standingDistance(fitFor(players, { width: 1920, height: 1080 }).camera, { width: 1920, height: 1080 })
      expect(big, `${players} players`).toBeLessThanOrEqual(small + 1e-9)
    }
  })

  it("keeps the tilt, the turn and the field of view of the camera it starts from", () => {
    const { camera } = fitFor(6, { width: 1440, height: 900 })
    expect([camera.tilt, camera.yaw, camera.fov]).toEqual([CAMERA.tilt, CAMERA.yaw, CAMERA.fov])
  })

  it("gives a full table in a window that is too narrow the farthest camera that still reads, in the middle, and says it does not fit", () => {
    const viewport = { width: 420, height: 900 }
    const { camera, fits } = fitFor(8, viewport)
    expect(fits).toBe(false)
    expect(Number.isFinite(camera.distance)).toBe(true)
    expect(camera.distance).toBeGreaterThan(0)
    const middle = middleOf(rectsOf(8, viewport, true, seenQuads(8)))
    expect(Math.abs(middle.x - viewport.width / 2)).toBeLessThan(0.5)
    expect(Math.abs(middle.y - viewport.height / 2)).toBeLessThan(0.5)
  })

  it("knows the boxes of the platform: the log, the players and the message box, the same ones for every game", () => {
    expect(hudBoxes({ width: 1280, height: 800 }, 5)).toHaveLength(3)
  })

  it("does the same for the same window every time", () => {
    expect(fitFor(5, { width: 1366, height: 768 })).toEqual(fitFor(5, { width: 1366, height: 768 }))
  })
})
