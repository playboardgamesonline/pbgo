import { PerspectiveCamera, Vector3 } from "three"
import { describe, expect, it } from "vitest"
import { aspectScale, type CameraSettings, placeCamera } from "./camera"
import { CORNER_SCREEN, cornerFrame, onTableAt } from "./screen"

const SETTINGS: CameraSettings = { tilt: 42, yaw: 0, distance: 21, fov: 34, targetX: 0, targetZ: 1.2 }

/** A camera as the table puts it for a window of this aspect ratio */
function cameraFor(aspect: number, settings: CameraSettings = SETTINGS) {
  const camera = new PerspectiveCamera(settings.fov, aspect, 0.1, 200)
  placeCamera(camera, settings, { distanceScale: aspectScale(aspect) })
  camera.updateProjectionMatrix()
  camera.updateMatrixWorld()
  return camera
}

describe("onTableAt", () => {
  it("shows the target of the camera in the middle of the picture", () => {
    const at = onTableAt(cameraFor(1.6), 0, 0)
    expect(at.x).toBeCloseTo(SETTINGS.targetX, 6)
    expect(at.z).toBeCloseTo(SETTINGS.targetZ, 6)
  })

  it("shows the bottom of the picture nearer the viewer than its top, and the left of it at the viewer's left", () => {
    const camera = cameraFor(1.6)
    expect(onTableAt(camera, 0, -0.6).z).toBeGreaterThan(onTableAt(camera, 0, 0.6).z)
    expect(onTableAt(camera, -0.5, 0).x).toBeLessThan(onTableAt(camera, 0.5, 0).x)
    expect(onTableAt(camera, -0.5, 0).x).toBeLessThan(0)
  })

  it("reaches farther along the table for a wider window, and the same table row for the same row of the picture", () => {
    const narrow = onTableAt(cameraFor(1.33), -0.96, -0.6)
    const wide = onTableAt(cameraFor(2.4), -0.96, -0.6)
    expect(wide.x).toBeLessThan(narrow.x)
  })

  it("puts a thing that stands up at the place where it shows at the point of the screen, nearer the middle and the viewer than the table's own point", () => {
    for (const aspect of [1.33, 1.78, 2.4]) {
      const camera = cameraFor(aspect)
      const height = 1.8
      const flat = onTableAt(camera, -0.96, -0.6)
      const up = onTableAt(camera, -0.96, -0.6, height)
      expect(up.x).toBeGreaterThan(flat.x)
      expect(up.z).toBeGreaterThan(flat.z)
      // seen through the camera, the point that stands at that place and that height is the point of the screen
      const shown = new Vector3(up.x, height, up.z).project(camera)
      expect(shown.x).toBeCloseTo(-0.96, 6)
      expect(shown.y).toBeCloseTo(-0.6, 6)
    }
  })

  it("reads the table itself at a height of zero", () => {
    const camera = cameraFor(1.6)
    expect(onTableAt(camera, -0.4, -0.3, 0)).toEqual(onTableAt(camera, -0.4, -0.3))
  })
})

describe("the corner of the screen", () => {
  it("is at the bottom left whatever the window: the hand lies left of the middle and in the lower half of the table", () => {
    for (const aspect of [1.33, 1.6, 1.78, 2.4]) {
      const camera = cameraFor(aspect)
      const left = onTableAt(camera, CORNER_SCREEN.left, CORNER_SCREEN.row)
      const middle = onTableAt(camera, CORNER_SCREEN.middle, CORNER_SCREEN.row)
      expect(left.x).toBeLessThan(middle.x)
      expect(middle.x).toBeLessThan(0)
      expect(left.z).toBeGreaterThan(SETTINGS.targetZ)
    }
  })
})

describe("cornerFrame", () => {
  it("is as wide as the room at the bottom left, never wider than the most, and scales with it", () => {
    const wide = cornerFrame({ x: -12, z: 8 }, { x: 0, z: 8 }, { most: 9, depth: 3.4 })
    expect(wide.width).toBe(9)
    expect(wide.scale).toBe(1)
    expect(wide.x).toBe(-12 + 4.5)
    const narrow = cornerFrame({ x: -6, z: 8 }, { x: 0, z: 8 }, { most: 9, depth: 3.4 })
    expect(narrow.width).toBe(6)
    expect(narrow.scale).toBeCloseTo(6 / 9)
    expect(narrow.depth).toBeCloseTo(3.4 * (6 / 9))
  })
})
