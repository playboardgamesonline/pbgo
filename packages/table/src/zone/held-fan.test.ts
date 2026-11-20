import { PerspectiveCamera, Vector3 } from "three"
import { describe, expect, it } from "vitest"
import type { CardSize } from "../card/geometry"
import { inFrame, seats } from "../layout"
import { aspectScale, type CameraSettings, placeCamera } from "../table/camera"
import { HELD_FAN_SETTINGS, heldFan, heldShadow, heldYaw } from "./held-fan"
import { leftEndIsFirst } from "./held-hand-keys"

const CARD: CardSize = { width: 1.3, height: 1.9 }
const CAMERA: CameraSettings = { tilt: 42, yaw: 0, distance: 21, fov: 34, targetX: 0, targetZ: 1.2 }

/** The top and the foot of a card, as the card's own up axis puts them: its middle, half its height above and below it */
function ends(pose: ReturnType<typeof heldFan>[number]) {
  const up = new Vector3(0, 1, 0).applyQuaternion(pose.quaternion).multiplyScalar((CARD.height * pose.scale) / 2)
  return { top: pose.position.clone().add(up), foot: pose.position.clone().sub(up) }
}

const spread = (values: number[]) => Math.max(...values) - Math.min(...values)

describe("a hand another player holds", () => {
  it("has the feet of its cards on the table, close together, and its tops farther apart: the hand opens as it is held", () => {
    const slots = heldFan(6, Math.PI, CARD)
    const all = slots.map(ends)
    for (const { foot } of all) expect(foot.y).toBeCloseTo(0.03, 2)
    expect(spread(all.map((end) => end.top.x))).toBeGreaterThan(spread(all.map((end) => end.foot.x)) * 1.5)
    // and the feet are as far apart as the settings say
    expect(spread(all.map((end) => end.foot.x))).toBeCloseTo(5 * HELD_FAN_SETTINGS.gap, 2)
  })

  it("stands: the middle of a card is about half its height above the table and its top is higher than its foot, not leaning far", () => {
    for (const pose of heldFan(5, Math.PI, CARD)) {
      const { top, foot } = ends(pose)
      expect(top.y).toBeGreaterThan(foot.y + 1)
      expect(Math.hypot(top.x - foot.x, top.z - foot.z)).toBeLessThan((top.y - foot.y) * 0.7)
    }
  })

  it("shows the backs to the viewer: across the table the card's back looks toward the middle and a little up", () => {
    const frame = { x: 0, z: -5, yaw: Math.PI }
    for (const pose of heldFan(5, Math.PI, CARD)) {
      const placed = inFrame(frame, pose)
      const back = new Vector3(0, 0, -1).applyQuaternion(placed.quaternion)
      // the viewer is toward +z and above
      expect(back.z).toBeGreaterThan(0.7)
      expect(back.y).toBeGreaterThan(0)
    }
  })

  it("keeps the cards close: about as wide as a card and a little more, however many there are, so that an edge of each shows", () => {
    for (let n = 1; n <= 8; n++) {
      const slots = heldFan(n, Math.PI, CARD)
      const width = spread(slots.map((slot) => ends(slot).top.x)) + CARD.width * HELD_FAN_SETTINGS.scale
      expect(width, `${n} cards`).toBeLessThan(CARD.width * HELD_FAN_SETTINGS.scale + n * 0.45)
    }
  })

  it("overlaps from the viewer's left, the deepest, to the right, the nearest, and not from the middle: the card in the middle is not in front of the others", () => {
    const camera = new PerspectiveCamera(CAMERA.fov, 1.6, 0.1, 200)
    placeCamera(camera, CAMERA, { distanceScale: aspectScale(1.6) })
    camera.updateMatrixWorld()
    const ring = seats(5, { radiusX: 7.4, radiusZ: 4.4, me: 0 })
    for (const seat of ring.slice(1)) {
      const yaw = heldYaw(seat.yaw)
      const frame = { x: seat.x * 1.2, z: seat.z * 1.2, yaw }
      const cards = heldFan(6, yaw, CARD).map((pose) => inFrame(frame, pose))
      const byScreen = cards.map((pose) => ({ x: pose.position.x, near: -camera.worldToLocal(pose.position.clone()).z })).sort((a, b) => a.x - b.x)
      // from the left of the picture to its right, each card is nearer the camera than the one before
      for (let i = 1; i < byScreen.length; i++) expect(byScreen[i]!.near, `seat at ${seat.x.toFixed(1)}, card ${i}`).toBeLessThan(byScreen[i - 1]!.near)
    }
  })

  it("faces the viewer: the hand is turned half a turn at any seat, and as far as `facing` says", () => {
    for (const yaw of [Math.PI, 2.5, 1.78, -1.78, -2.5, -Math.PI]) expect(Math.cos(heldYaw(yaw)), `${yaw}`).toBeCloseTo(-1, 9)
    expect(heldYaw(1.78, { ...HELD_FAN_SETTINGS, facing: 0 })).toBeCloseTo(1.78, 9)
    expect(heldYaw(-1.78, { ...HELD_FAN_SETTINGS, facing: 0.5 })).toBeCloseTo((-1.78 - Math.PI) / 2, 9)
  })

  it("has a first card on the left of the picture at the seats where the layout puts it there, as the rule of the animation says", () => {
    for (const yaw of [heldYaw(-Math.PI / 2), heldYaw(Math.PI / 2), Math.PI, heldYaw(-Math.PI / 2, { ...HELD_FAN_SETTINGS, facing: 0 }), heldYaw(Math.PI / 2, { ...HELD_FAN_SETTINGS, facing: 0 })]) {
      const frame = { x: 0, z: -5, yaw }
      const cards = heldFan(5, yaw, CARD).map((pose) => inFrame(frame, pose))
      const first = cards[0]!.position.x
      const last = cards[4]!.position.x
      // by the rule, the first card is the left end where `leftEndIsFirst` says so
      expect(first < last).toBe(leftEndIsFirst(frame))
    }
  })
})

describe("the shadow under a hand", () => {
  it("is small and grows with the cards", () => {
    const shadow = heldShadow()
    expect(shadow.radius(1)).toBeLessThan(shadow.radius(8))
    expect(shadow.radius(8)).toBeLessThan(1.3)
    expect(shadow.opacity).toBeGreaterThan(0)
  })
})
