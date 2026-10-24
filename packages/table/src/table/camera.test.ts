import { PerspectiveCamera, Vector3 } from "three"
import { describe, expect, it } from "vitest"
import { CAMERA_INTRO, type CameraIntro, type CameraSettings, MIN_HEIGHT, aspectScale, introRest, placeCamera } from "./camera"

const DIGITS = 10
const RAD = Math.PI / 180

const SETTINGS: CameraSettings = { tilt: 42, yaw: 0, distance: 21, fov: 34, targetX: 0, targetZ: 1.2 }

const newCamera = () => new PerspectiveCamera(SETTINGS.fov, 1.6, 0.1, 300)

/** The way the screen's "up" points in the world */
const screenUp = (camera: PerspectiveCamera) => new Vector3(0, 1, 0).applyQuaternion(camera.quaternion)

function expectPoint(point: Vector3, x: number, y: number, z: number) {
  expect(point.x).toBeCloseTo(x, DIGITS)
  expect(point.y).toBeCloseTo(y, DIGITS)
  expect(point.z).toBeCloseTo(z, DIGITS)
}

describe("placeCamera", () => {
  it("stands at the distance and tilt it is given, in front of the target", () => {
    const camera = newCamera()
    placeCamera(camera, SETTINGS)
    expectPoint(camera.position, 0, 21 * Math.cos(42 * RAD), 1.2 + 21 * Math.sin(42 * RAD))
  })

  it("turns around the table with the yaw", () => {
    const camera = newCamera()
    placeCamera(camera, { ...SETTINGS, yaw: 90 })
    expectPoint(camera.position, 21 * Math.sin(42 * RAD), 21 * Math.cos(42 * RAD), 1.2)
    placeCamera(camera, { ...SETTINGS, yaw: 180 })
    expectPoint(camera.position, 0, 21 * Math.cos(42 * RAD), 1.2 - 21 * Math.sin(42 * RAD))
  })

  it("is centred on the target point of the table", () => {
    const camera = newCamera()
    placeCamera(camera, { ...SETTINGS, targetX: 3, targetZ: -2 })
    expectPoint(camera.position, 3, 21 * Math.cos(42 * RAD), -2 + 21 * Math.sin(42 * RAD))
  })

  it("looks at the target point of the table", () => {
    const camera = newCamera()
    const settings = { ...SETTINGS, yaw: 35, targetX: 3, targetZ: -2 }
    placeCamera(camera, settings)
    const expected = new Vector3(settings.targetX, 0, settings.targetZ).sub(camera.position).normalize()
    const looking = camera.getWorldDirection(new Vector3())
    expectPoint(looking, expected.x, expected.y, expected.z)
  })

  it("keeps a flat view above the table", () => {
    const camera = newCamera()
    placeCamera(camera, { ...SETTINGS, tilt: 85, distance: 4 })
    expect(camera.position.y).toBe(MIN_HEIGHT)
    placeCamera(camera, SETTINGS)
    expect(camera.position.y).toBeGreaterThan(MIN_HEIGHT)
  })

  it("keeps the table's far side up on the screen", () => {
    const camera = newCamera()
    placeCamera(camera, SETTINGS)
    expect(screenUp(camera).z).toBeLessThan(0)
    expect(screenUp(camera).y).toBeGreaterThan(0)
  })

  it("takes the table's far side for the screen's up when looking straight down", () => {
    const camera = newCamera()
    placeCamera(camera, { ...SETTINGS, tilt: 0 })
    expectPoint(camera.position, 0, 21, 1.2)
    expectPoint(screenUp(camera), 0, 0, -1)
    placeCamera(camera, { ...SETTINGS, tilt: 0, yaw: 90 })
    expectPoint(screenUp(camera), -1, 0, 0)
  })

  it("gives the vertical back to the screen once the view tilts again", () => {
    const camera = newCamera()
    placeCamera(camera, { ...SETTINGS, tilt: 0, yaw: 90 })
    placeCamera(camera, SETTINGS)
    expectPoint(camera.up, 0, 1, 0)
  })

  it("does not tilt past straight down", () => {
    const camera = newCamera()
    placeCamera(camera, { ...SETTINGS, tilt: -20 })
    expectPoint(camera.position, 0, 21, 1.2)
  })

  it("sets the field of view and refreshes the projection with it", () => {
    const camera = newCamera()
    placeCamera(camera, { ...SETTINGS, fov: 50 })
    expect(camera.fov).toBe(50)
    expect(camera.projectionMatrix.elements[5]).toBeCloseTo(1 / Math.tan(25 * RAD), DIGITS)
  })

  it("leaves the projection alone when the field of view is already right", () => {
    const camera = newCamera()
    camera.projectionMatrix.elements[5] = 123
    placeCamera(camera, SETTINGS)
    expect(camera.projectionMatrix.elements[5]).toBe(123)
  })

  it("backs off by the distance scale", () => {
    const camera = newCamera()
    placeCamera(camera, SETTINGS, { distanceScale: 2 })
    expectPoint(camera.position, 0, 42 * Math.cos(42 * RAD), 1.2 + 42 * Math.sin(42 * RAD))
  })

  describe("with an entrance", () => {
    const intro: CameraIntro = { enabled: true, duration: 1, zoom: 2, rotate: 30, tilt: 10 }

    it("starts farther, more turned and more tilted", () => {
      const camera = newCamera()
      placeCamera(camera, SETTINGS, { intro, rest: 1 })
      const tilt = 52 * RAD
      const yaw = 30 * RAD
      expectPoint(camera.position, 42 * Math.sin(tilt) * Math.sin(yaw), 42 * Math.cos(tilt), 1.2 + 42 * Math.sin(tilt) * Math.cos(yaw))
    })

    it("covers a share of the way as much as is left", () => {
      const camera = newCamera()
      placeCamera(camera, SETTINGS, { intro, rest: 0.5 })
      const tilt = 47 * RAD
      const yaw = 15 * RAD
      expectPoint(camera.position, 31.5 * Math.sin(tilt) * Math.sin(yaw), 31.5 * Math.cos(tilt), 1.2 + 31.5 * Math.sin(tilt) * Math.cos(yaw))
    })

    it("ends on the settings", () => {
      const settled = newCamera()
      placeCamera(settled, SETTINGS)
      const camera = newCamera()
      placeCamera(camera, SETTINGS, { intro, rest: 0 })
      expectPoint(camera.position, settled.position.x, settled.position.y, settled.position.z)
    })

    it("uses the default entrance when none is given", () => {
      const camera = newCamera()
      placeCamera(camera, SETTINGS, { rest: 1 })
      const tilt = (42 + CAMERA_INTRO.tilt) * RAD
      const yaw = CAMERA_INTRO.rotate * RAD
      const distance = 21 * CAMERA_INTRO.zoom
      expectPoint(camera.position, distance * Math.sin(tilt) * Math.sin(yaw), distance * Math.cos(tilt), 1.2 + distance * Math.sin(tilt) * Math.cos(yaw))
    })
  })
})

describe("CAMERA_INTRO", () => {
  it("is the entrance Courtisans plays", () => {
    expect(CAMERA_INTRO).toEqual({ enabled: true, duration: 2.6, zoom: 1.45, rotate: 22, tilt: 12 })
  })
})

describe("aspectScale", () => {
  it("keeps the distance on a screen as wide as the table is framed for, or wider", () => {
    expect(aspectScale(1.6)).toBe(1)
    expect(aspectScale(2.4)).toBe(1)
  })

  it("backs the camera off on a narrower screen, so the table still fits", () => {
    expect(aspectScale(0.8)).toBeCloseTo(2, DIGITS)
    expect(aspectScale(1)).toBeCloseTo(1.6, DIGITS)
  })

  it("ignores a screen with no size yet", () => {
    expect(aspectScale(0)).toBe(1)
    expect(aspectScale(Number.NaN)).toBe(1)
  })
})

describe("introRest", () => {
  const intro: CameraIntro = { enabled: true, duration: 2, zoom: 1.5, rotate: 20, tilt: 10 }

  it("is all of it when the entrance begins", () => {
    expect(introRest(intro, 1000, 1000)).toBe(1)
  })

  it("is none of it once the duration has passed", () => {
    expect(introRest(intro, 1000, 3000)).toBe(0)
    expect(introRest(intro, 1000, 9000)).toBe(0)
  })

  it("eases out: a cubic in the time that is left", () => {
    expect(introRest(intro, 1000, 2000)).toBeCloseTo(0.125, DIGITS)
    expect(introRest(intro, 1000, 1500)).toBeCloseTo(0.421875, DIGITS)
  })

  it("never grows", () => {
    const rests = [1000, 1200, 1400, 1800, 2400, 2900, 3000].map((now) => introRest(intro, 1000, now))
    rests.slice(1).forEach((rest, i) => expect(rest).toBeLessThanOrEqual(rests[i]))
  })

  it("waits at the start for a clock that is behind", () => {
    expect(introRest(intro, 1000, 500)).toBe(1)
  })

  it("is nothing when it is off", () => {
    expect(introRest({ ...intro, enabled: false }, 1000, 1000)).toBe(0)
  })

  it("is nothing before it has begun", () => {
    expect(introRest(intro, null, 1000)).toBe(0)
  })

  it("is nothing for a duration that is not positive", () => {
    expect(introRest({ ...intro, duration: 0 }, 1000, 1000)).toBe(0)
    expect(introRest({ ...intro, duration: -1 }, 1000, 1000)).toBe(0)
    expect(introRest({ ...intro, duration: Number.NaN }, 1000, 1000)).toBe(0)
  })
})
