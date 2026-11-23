import { type Fit, PLATFORM_HUD, type Rect, standingDistance, type Viewport, windowRectOf } from "@pbgo/table"
import { describe, expect, it } from "vitest"
import { CAMERA, cameraFor, fitFor, overlays } from "./camera"
import { tableQuads } from "./layout"

const PLAYERS = [2, 3, 4, 5, 6, 7, 8]
/** Windows a laptop or a desktop has, the width and the height of the browser's own content */
const DESKTOP: Viewport[] = [
  { width: 1280, height: 720 },
  { width: 1280, height: 800 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
  { width: 2560, height: 1080 },
]
/** A tablet held upright: wider than the wall of the platform's phone screen, taller than it is wide */
const UPRIGHT: Viewport[] = [
  { width: 900, height: 1200 },
  { width: 1024, height: 1366 },
]

/** The fit of a table in a window, worked out once: the same window and table always give the same camera, and the fit is the slow part of these tests */
const fits = new Map<string, Fit>()
function fitOf(players: number, viewport: Viewport, seated = true): Fit {
  const key = `${players}|${viewport.width}x${viewport.height}|${seated}`
  if (!fits.has(key)) fits.set(key, fitFor(players, viewport, CAMERA, seated))
  return fits.get(key)!
}

/** Where every box of the table falls in the window for the camera that `fitFor` gave */
function rectsOf(players: number, viewport: Viewport, seated = true): Rect[] {
  const { camera } = fitOf(players, viewport, seated)
  return tableQuads(players, seated).map((box) => windowRectOf(box, standingDistance(camera, viewport), camera.targetX, camera.targetZ, camera, viewport))
}

const union = (rects: Rect[]): Rect => ({
  left: Math.min(...rects.map((r) => r.left)),
  top: Math.min(...rects.map((r) => r.top)),
  right: Math.max(...rects.map((r) => r.right)),
  bottom: Math.max(...rects.map((r) => r.bottom)),
})

describe("the camera fitted to a window", () => {
  it("brings the whole table into the window, for every table on a laptop or a desktop", () => {
    for (const viewport of DESKTOP) {
      for (const players of PLAYERS) {
        const label = `${players} players in ${viewport.width}x${viewport.height}`
        expect(fitOf(players, viewport).fits, label).toBe(true)
        for (const rect of rectsOf(players, viewport)) {
          expect(rect.left, label).toBeGreaterThanOrEqual(PLATFORM_HUD.gap - 1e-6)
          expect(rect.top, label).toBeGreaterThanOrEqual(PLATFORM_HUD.gap - 1e-6)
          expect(rect.right, label).toBeLessThanOrEqual(viewport.width - PLATFORM_HUD.gap + 1e-6)
          expect(rect.bottom, label).toBeLessThanOrEqual(viewport.height - PLATFORM_HUD.gap + 1e-6)
        }
      }
    }
  })

  it("puts the middle of what is seen in the middle of the window, whatever the window and the number of seats", () => {
    for (const viewport of DESKTOP) {
      for (const players of PLAYERS) {
        const seen = union(rectsOf(players, viewport))
        const label = `${players} players in ${viewport.width}x${viewport.height}`
        expect((seen.left + seen.right) / 2, label).toBeCloseTo(viewport.width / 2, 0)
        expect((seen.top + seen.bottom) / 2, label).toBeCloseTo(viewport.height / 2, 0)
      }
    }
  })

  it("keeps the table clear of what the platform draws over it on a laptop or a desktop from 1280 by 720 up, by making it a little smaller where it must (never under 30 px a unit)", () => {
    for (const viewport of DESKTOP.filter((window) => window.width >= 1280)) {
      for (const players of PLAYERS) {
        const label = `${players} players in ${viewport.width}x${viewport.height}`
        expect(fitOf(players, viewport).clear, label).toBe(true)
        const { camera } = fitOf(players, viewport)
        const unit = viewport.height / 2 / (standingDistance(camera, viewport) * Math.tan((camera.fov * Math.PI) / 360))
        expect(unit, label).toBeGreaterThanOrEqual(30 - 1e-6)
      }
    }
  })

  it("lists the message box at the foot of the window with the boxes of the kit, which leave it out", () => {
    const viewport = { width: 1280, height: 800 }
    const boxes = overlays(viewport, 4)
    expect(boxes).toHaveLength(3)
    const chat = boxes.at(-1)!
    expect(chat).toMatchObject({ right: viewport.width, bottom: viewport.height })
    // 352 by 44 pixels, with the air kept round the boxes
    expect(viewport.width - chat.left).toBeGreaterThan(352)
    expect(viewport.height - chat.top).toBeGreaterThan(44)
  })

  it("does as much for a spectator, whose seats are spread round the table with none in front (there is no spectator of a table on a platform that seats everybody, so a full table on a tablet held across, the one corner that does not fit, is left out)", () => {
    for (const viewport of DESKTOP) {
      for (const players of PLAYERS) {
        if (players === 8 && viewport.width < 1280) continue
        const label = `${players} players in ${viewport.width}x${viewport.height}, spectator`
        expect(fitOf(players, viewport, false).fits, label).toBe(true)
        for (const rect of rectsOf(players, viewport, false)) {
          expect(rect.left, label).toBeGreaterThanOrEqual(PLATFORM_HUD.gap - 1e-6)
          expect(rect.right, label).toBeLessThanOrEqual(viewport.width - PLATFORM_HUD.gap + 1e-6)
          expect(rect.top, label).toBeGreaterThanOrEqual(PLATFORM_HUD.gap - 1e-6)
          expect(rect.bottom, label).toBeLessThanOrEqual(viewport.height - PLATFORM_HUD.gap + 1e-6)
        }
      }
    }
  })

  it("fits a tablet held upright too, where the table has the width of the window and the platform's boxes only take the top", () => {
    for (const viewport of UPRIGHT) for (const players of PLAYERS) expect(fitOf(players, viewport).fits, `${players} players in ${viewport.width}x${viewport.height}`).toBe(true)
  })

  it("stands nearer in a bigger window, so that the cards are bigger there", () => {
    for (const players of PLAYERS) {
      const small = standingDistance(cameraFor(players, { width: 1280, height: 720 }), { width: 1280, height: 720 })
      const big = standingDistance(cameraFor(players, { width: 1920, height: 1080 }), { width: 1920, height: 1080 })
      expect(big, `${players} players`).toBeLessThanOrEqual(small + 1e-9)
    }
  })

  it("keeps the tilt, the turn and the field of view of the camera it starts from", () => {
    const camera = cameraFor(6, { width: 1440, height: 900 })
    expect([camera.tilt, camera.yaw, camera.fov]).toEqual([CAMERA.tilt, CAMERA.yaw, CAMERA.fov])
  })

  it("does the same for the same window every time", () => {
    expect(fitFor(5, { width: 1366, height: 768 })).toEqual(fitFor(5, { width: 1366, height: 768 }))
  })
})
