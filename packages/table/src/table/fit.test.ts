import { PerspectiveCamera, Vector3 } from "three"
import { describe, expect, it } from "vitest"
import { type CameraSettings } from "./camera"
import { placeCamera } from "./camera"
import { fitCamera, hudBoxes, PLATFORM_HUD, type Quad, type Rect, standingDistance, type Viewport, windowRectOf } from "./fit"

const BASE: CameraSettings = { tilt: 46, yaw: 0, distance: 23, fov: 34, targetX: 0, targetZ: 0.8 }
const WINDOWS: Viewport[] = [
  { width: 1280, height: 720 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
  { width: 2560, height: 1080 },
  { width: 900, height: 1200 },
  { width: 1024, height: 1366 },
]

const box = (x: number, z: number, halfWidth: number, halfDepth: number): Quad => [
  { x: x - halfWidth, z: z - halfDepth },
  { x: x + halfWidth, z: z - halfDepth },
  { x: x + halfWidth, z: z + halfDepth },
  { x: x - halfWidth, z: z + halfDepth },
]

/** A table of five seats the way a game lays one out: the viewer's line at the near side, two opponents on each far side, and the piles and the strip between them. Made the same on both sides */
const SEEN: Quad[] = [
  box(0, 4.6, 2.2, 1.1), // the viewer's line
  box(-3.9, -1.6, 1.8, 1.2), // opponents at the left
  box(3.9, -1.6, 1.8, 1.2),
  box(-6.2, 1.8, 1.4, 1.2),
  box(6.2, 1.8, 1.4, 1.2),
  box(0, 0.4, 3.6, 1.2), // the piles and the strip
]
/** What is pressed and reaches past what is drawn: a little more than the lines */
const REACH: Quad[] = SEEN.map((quad) => {
  const xs = quad.map((p) => p.x)
  const zs = quad.map((p) => p.z)
  const [x, z] = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...zs) + Math.max(...zs)) / 2]
  return box(x, z, (Math.max(...xs) - Math.min(...xs)) / 2 + 0.6, (Math.max(...zs) - Math.min(...zs)) / 2 + 0.9)
})

/** The projection of a point of the ground by a real camera, the one the table places: the shortcut of `windowRectOf` is checked against it */
function projectedBy(camera: CameraSettings, { width, height }: Viewport, x: number, z: number): [number, number] {
  const real = new PerspectiveCamera(camera.fov, width / height, 0.1, 300)
  placeCamera(real, camera)
  real.updateMatrixWorld()
  const ndc = new Vector3(x, 0, z).project(real)
  return [((ndc.x + 1) / 2) * width, ((1 - ndc.y) / 2) * height]
}

const middleOf = (rects: Rect[]) => {
  const left = Math.min(...rects.map((r) => r.left))
  const right = Math.max(...rects.map((r) => r.right))
  const top = Math.min(...rects.map((r) => r.top))
  const bottom = Math.max(...rects.map((r) => r.bottom))
  return { x: (left + right) / 2, y: (top + bottom) / 2, left, right, top, bottom }
}

const seenIn = (camera: CameraSettings, viewport: Viewport, quads: Quad[] = SEEN) =>
  quads.map((quad) => windowRectOf(quad, standingDistance(camera, viewport), camera.targetX, camera.targetZ, camera, viewport))

describe("the shortcut for the ground", () => {
  it("lands where a real camera puts the corners of a shape of the table, for any camera and window", () => {
    const cameras: CameraSettings[] = [BASE, { ...BASE, distance: 17.5, targetX: 1.5, targetZ: -0.4 }, { ...BASE, tilt: 60, distance: 30, targetZ: 2, fov: 28 }]
    for (const camera of cameras) {
      for (const viewport of [{ width: 1280, height: 800 }, { width: 2560, height: 1080 }, { width: 900, height: 1200 }]) {
        const quad = SEEN[1]!
        const rect = windowRectOf(quad, camera.distance, camera.targetX, camera.targetZ, camera, viewport)
        const corners = quad.map(({ x, z }) => projectedBy(camera, viewport, x, z))
        expect(rect.left).toBeCloseTo(Math.min(...corners.map(([x]) => x)), 4)
        expect(rect.right).toBeCloseTo(Math.max(...corners.map(([x]) => x)), 4)
        expect(rect.top).toBeCloseTo(Math.min(...corners.map(([, y]) => y)), 4)
        expect(rect.bottom).toBeCloseTo(Math.max(...corners.map(([, y]) => y)), 4)
      }
    }
  })
})

describe("the camera fitted to a window", () => {
  it("puts the middle of what is seen in the middle of the window, whatever the window", () => {
    for (const viewport of WINDOWS) {
      const { camera, fits } = fitCamera(viewport, BASE, { seen: SEEN, reach: REACH })
      const label = `${viewport.width}x${viewport.height}`
      expect(fits, label).toBe(true)
      const middle = middleOf(seenIn(camera, viewport))
      expect(Math.abs(middle.x - viewport.width / 2), label).toBeLessThan(0.5)
      expect(Math.abs(middle.y - viewport.height / 2), label).toBeLessThan(0.5)
    }
  })

  it("keeps a table that is the same on both sides exactly across the middle: no target a hair off it", () => {
    for (const viewport of WINDOWS) expect(fitCamera(viewport, BASE, { seen: SEEN, reach: REACH }).camera.targetX, `${viewport.width}x${viewport.height}`).toBe(BASE.targetX)
  })

  it("centres a table that is not the same on both sides too, by standing to the side of it", () => {
    const lopsided = [...SEEN, box(7.5, 5, 1.2, 1)]
    const viewport = { width: 1440, height: 900 }
    const { camera } = fitCamera(viewport, BASE, { seen: lopsided })
    expect(camera.targetX).toBeGreaterThan(0.1)
    const middle = middleOf(seenIn(camera, viewport, lopsided))
    expect(Math.abs(middle.x - viewport.width / 2)).toBeLessThan(0.5)
    expect(Math.abs(middle.y - viewport.height / 2)).toBeLessThan(0.5)
  })

  it("brings everything seen and everything reached into the window, with the gap of air round it", () => {
    for (const viewport of WINDOWS) {
      const { camera } = fitCamera(viewport, BASE, { seen: SEEN, reach: REACH })
      for (const rect of [...seenIn(camera, viewport), ...seenIn(camera, viewport, REACH)]) {
        expect(rect.left).toBeGreaterThanOrEqual(PLATFORM_HUD.gap - 1e-6)
        expect(rect.top).toBeGreaterThanOrEqual(PLATFORM_HUD.gap - 1e-6)
        expect(rect.right).toBeLessThanOrEqual(viewport.width - PLATFORM_HUD.gap + 1e-6)
        expect(rect.bottom).toBeLessThanOrEqual(viewport.height - PLATFORM_HUD.gap + 1e-6)
      }
    }
  })

  it("lets what is reached stand off the middle of the window, as it only has to be inside it", () => {
    // a zone that reaches far down on one side only: the scene is not pulled up for it
    const far = [...REACH, box(0, 7.5, 2, 1)]
    const viewport = { width: 1440, height: 900 }
    const plain = fitCamera(viewport, BASE, { seen: SEEN, reach: REACH })
    const reaching = fitCamera(viewport, BASE, { seen: SEEN, reach: far })
    // it stands back to have the zone in the window, and what is seen is still in the middle of it
    expect(reaching.camera.distance).toBeGreaterThanOrEqual(plain.camera.distance - 1e-9)
    const middle = middleOf(seenIn(reaching.camera, viewport))
    expect(Math.abs(middle.y - viewport.height / 2)).toBeLessThan(0.5)
  })

  it("stands as near as it can: a nearer camera would have part of the table outside the window", () => {
    for (const viewport of WINDOWS) {
      const { camera } = fitCamera(viewport, BASE, { seen: SEEN, reach: REACH })
      const d = standingDistance(camera, viewport)
      if (d <= 13 + 1e-6) continue
      const nearer = fitCamera(viewport, { ...BASE }, { seen: SEEN, reach: REACH, nearest: d - 0.3 })
      // asking for a camera 0.3 nearer than the answer gives the answer: it was the nearest that fits
      expect(standingDistance(nearer.camera, viewport), `${viewport.width}x${viewport.height}`).toBeCloseTo(d, 1)
      const tight = Math.min(...seenIn(camera, viewport, [...SEEN, ...REACH]).flatMap((r) => [r.left - PLATFORM_HUD.gap, viewport.width - PLATFORM_HUD.gap - r.right, r.top - PLATFORM_HUD.gap, viewport.height - PLATFORM_HUD.gap - r.bottom]))
      expect(tight, `${viewport.width}x${viewport.height}`).toBeLessThan(3)
    }
  })

  it("stands nearer in a bigger window, so that the cards are bigger there", () => {
    const small = standingDistance(fitCamera({ width: 1280, height: 720 }, BASE, { seen: SEEN, reach: REACH }).camera, { width: 1280, height: 720 })
    const big = standingDistance(fitCamera({ width: 1920, height: 1080 }, BASE, { seen: SEEN, reach: REACH }).camera, { width: 1920, height: 1080 })
    expect(big).toBeLessThanOrEqual(small + 1e-9)
  })

  it("lists the message box at the foot of the window with the log and the players: the table is kept clear of it as of them", () => {
    const viewport = { width: 1280, height: 800 }
    const boxes = hudBoxes(viewport, 4)
    expect(boxes).toHaveLength(3)
    const chat = boxes.at(-1)!
    expect(chat).toMatchObject({ right: viewport.width, bottom: viewport.height })
    // 352 by 42 pixels, at 20 from the right and the bottom, with the air kept round the boxes
    expect(viewport.width - chat.left).toBe(PLATFORM_HUD.chat.right + PLATFORM_HUD.chat.width + PLATFORM_HUD.gap)
    expect(viewport.height - chat.top).toBe(PLATFORM_HUD.chat.bottom + PLATFORM_HUD.chat.height + PLATFORM_HUD.gap)
  })

  it("stands farther, and never off to a side, when the platform's boxes would cover more of the table than a corner of it", () => {
    const viewport = { width: 1440, height: 900 }
    const over: Rect[] = hudBoxes(viewport, 8)
    const free = fitCamera(viewport, BASE, { seen: SEEN, reach: REACH })
    const clear = fitCamera(viewport, BASE, { seen: SEEN, reach: REACH, avoid: over, dodgeUnit: 30 })
    expect(clear.clear).toBe(true)
    expect(clear.covered).toBeLessThanOrEqual(0.04 + 1e-9)
    expect(standingDistance(clear.camera, viewport)).toBeGreaterThanOrEqual(standingDistance(free.camera, viewport) - 1e-9)
    const middle = middleOf(seenIn(clear.camera, viewport))
    expect(Math.abs(middle.x - viewport.width / 2)).toBeLessThan(0.5)
    expect(Math.abs(middle.y - viewport.height / 2)).toBeLessThan(0.5)
  })

  it("keeps a big table in the middle, under a corner of the platform's boxes, rather than a small one clear of them", () => {
    const viewport = { width: 1280, height: 720 }
    const over: Rect[] = hudBoxes(viewport, 8)
    const dodgeUnit = 70
    const fit = fitCamera(viewport, BASE, { seen: SEEN, reach: REACH, avoid: over, dodgeUnit })
    const half = Math.tan((BASE.fov * Math.PI) / 360)
    // a unit of the table at the point the camera looks at is about as wide as `dodgeUnit` asks, and no smaller: it did not stand farther for the boxes than that
    expect(viewport.height / 2 / (standingDistance(fit.camera, viewport) * half)).toBeGreaterThanOrEqual(dodgeUnit - 0.5)
    expect(fit.fits).toBe(true)
    expect(fit.clear).toBe(false)
    expect(fit.covered).toBeGreaterThan(0.04)
    const middle = middleOf(seenIn(fit.camera, viewport))
    expect(Math.abs(middle.x - viewport.width / 2)).toBeLessThan(0.5)
    expect(Math.abs(middle.y - viewport.height / 2)).toBeLessThan(0.5)
  })

  it("says how much of the worst-covered thing that is seen the platform's boxes cover", () => {
    const viewport = { width: 1280, height: 720 }
    const over: Rect[] = hudBoxes(viewport, 8)
    const fit = fitCamera(viewport, BASE, { seen: SEEN, reach: REACH, avoid: over, dodgeUnit: 70 })
    const rects = seenIn(fit.camera, viewport)
    const area = (r: Rect) => (r.right - r.left) * (r.bottom - r.top)
    const common = (a: Rect, b: Rect) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))
    const worst = Math.max(...rects.map((r) => over.reduce((s, box) => s + common(r, box), 0) / area(r)))
    expect(fit.covered).toBeCloseTo(worst, 9)
  })

  it("keeps the table in the window, in the middle, and says it is not clear when the platform's boxes cannot be avoided", () => {
    const viewport = { width: 1280, height: 720 }
    // a box over the middle of the window, which no distance gets the table out from under
    const everywhere: Rect[] = [{ left: 400, top: 200, right: 880, bottom: 520 }]
    const { camera, fits, clear } = fitCamera(viewport, BASE, { seen: SEEN, reach: REACH, avoid: everywhere })
    expect(fits).toBe(true)
    expect(clear).toBe(false)
    const middle = middleOf(seenIn(camera, viewport))
    expect(Math.abs(middle.x - viewport.width / 2)).toBeLessThan(0.5)
    expect(Math.abs(middle.y - viewport.height / 2)).toBeLessThan(0.5)
  })

  it("gives a table that cannot fit the farthest camera that still reads, centred, and says it does not fit", () => {
    const wide = [...SEEN, box(-19, 0, 4, 3), box(19, 0, 4, 3)]
    const viewport = { width: 900, height: 600 }
    const { camera, fits } = fitCamera(viewport, BASE, { seen: wide })
    expect(fits).toBe(false)
    expect(Number.isFinite(camera.distance) && camera.distance > 0).toBe(true)
    const middle = middleOf(seenIn(camera, viewport, wide))
    expect(Math.abs(middle.x - viewport.width / 2)).toBeLessThan(0.5)
    expect(Math.abs(middle.y - viewport.height / 2)).toBeLessThan(0.5)
  })

  it("keeps the tilt, the turn and the field of view of the camera it starts from, and gives the distance the rig will back off from", () => {
    const viewport = { width: 900, height: 1200 }
    const { camera } = fitCamera(viewport, BASE, { seen: SEEN, reach: REACH })
    expect([camera.tilt, camera.yaw, camera.fov]).toEqual([BASE.tilt, BASE.yaw, BASE.fov])
    // a narrow window: the rig stands farther than the distance of the settings
    expect(standingDistance(camera, viewport)).toBeGreaterThan(camera.distance)
  })

  it("does the same for the same window every time", () => {
    const options = { seen: SEEN, reach: REACH, avoid: hudBoxes({ width: 1366, height: 768 }, 5) }
    expect(fitCamera({ width: 1366, height: 768 }, BASE, options)).toEqual(fitCamera({ width: 1366, height: 768 }, BASE, options))
  })
})

describe("the boxes of the platform", () => {
  it("are the log of the turns at the top left and the menu with the list of the players, a row each, at the top right", () => {
    const [ticker, column] = hudBoxes({ width: 1280, height: 800 }, 4)
    expect(ticker).toMatchObject({ left: 0, top: 0 })
    expect(column!.right).toBe(1280)
    expect(column!.left).toBe(1280 - PLATFORM_HUD.column.right - PLATFORM_HUD.column.width - PLATFORM_HUD.gap)
    // a row more for each player
    expect(hudBoxes({ width: 1280, height: 800 }, 8)[1]!.bottom - column!.bottom).toBeCloseTo(4 * PLATFORM_HUD.column.row, 9)
  })
})
