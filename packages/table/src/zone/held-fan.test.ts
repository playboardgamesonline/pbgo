import { PerspectiveCamera, Vector3 } from "three"
import { describe, expect, it } from "vitest"
import type { CardSize } from "../card/geometry"
import { inFrame, seats } from "../layout"
import { aspectScale, type CameraSettings, placeCamera } from "../table/camera"
import { HELD_FAN_SETTINGS, heldFan, heldShadow } from "./held-fan"
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

  it("stands: the middle of a card is about half its height above the table and its top is higher than its foot", () => {
    for (const pose of heldFan(5, Math.PI, CARD)) {
      const { top, foot } = ends(pose)
      expect(top.y).toBeGreaterThan(foot.y + 1)
      expect(Math.hypot(top.x - foot.x, top.z - foot.z)).toBeLessThan((top.y - foot.y) * 0.7)
    }
  })

  it("stands straight up at every seat: the plane of every card is vertical, so that its back looks along the table and not up", () => {
    for (const yaw of [0, 0.5, Math.PI / 2, 2, Math.PI, -Math.PI / 2]) {
      for (const pose of heldFan(6, yaw, CARD)) {
        // The fan turns a card in its own plane (its top opens sideways) and the arc turns it about the vertical: the plane of the card stays vertical
        const back = new Vector3(0, 0, -1).applyQuaternion(pose.quaternion)
        expect(back.y, `yaw ${yaw.toFixed(2)}`).toBeCloseTo(0, 9)
      }
    }
  })

  it("shows the backs to the middle of the table at every seat: the cards face the way the seat does", () => {
    const ring = seats(5, { radiusX: 7.4, radiusZ: 4.4, me: 0 })
    for (const seat of ring.slice(1)) {
      const frame = { x: seat.x * 1.2, z: seat.z * 1.2, yaw: seat.yaw }
      const toMiddle = { x: -frame.x / Math.hypot(frame.x, frame.z), z: -frame.z / Math.hypot(frame.x, frame.z) }
      for (const pose of heldFan(5, frame.yaw, CARD)) {
        const back = new Vector3(0, 0, -1).applyQuaternion(inFrame(frame, pose).quaternion)
        // within the bend of the arc: the outer cards of five are turned by twice its angle
        expect(back.x * toMiddle.x + back.z * toMiddle.z, `seat at ${seat.x.toFixed(1)}`).toBeGreaterThan(Math.cos(2 * HELD_FAN_SETTINGS.arc + 0.01))
      }
    }
  })

  it("leans back by the settings when a game gives a lean, more at a seat at the side, which the viewer sees edge on, than across the table", () => {
    const leaning = { ...HELD_FAN_SETTINGS, lean: 0.27, sideLean: 0.6 }
    const lean = (yaw: number) => {
      const pose = heldFan(3, yaw, CARD, leaning)[1]!
      return Math.abs(new Vector3(0, 1, 0).applyQuaternion(pose.quaternion).z)
    }
    expect(lean(Math.PI)).toBeCloseTo(Math.sin(0.27), 6)
    expect(lean(Math.PI / 2)).toBeCloseTo(Math.sin(0.6), 6)
    // and the backs look up a little then
    expect(new Vector3(0, 0, -1).applyQuaternion(heldFan(3, Math.PI, CARD, leaning)[1]!.quaternion).y).toBeGreaterThan(0)
  })

  it("stands on a slight arc that bulges toward the middle of the table: the feet of the middle cards are the nearest to it, the ends lie nearer the owner, and the cards turn to face away from the centre of the arc", () => {
    const flat = { ...HELD_FAN_SETTINGS, stack: 0 }
    const slots = heldFan(7, Math.PI, CARD, flat)
    const feet = slots.map((slot) => ends(slot).foot)
    // The frame's -z is toward the middle of the table: the middle card's foot has the least z, the same either side of it
    for (const [i, foot] of feet.entries()) if (i !== 3) expect(foot.z, `card ${i}`).toBeGreaterThan(feet[3]!.z)
    expect(feet[0]!.z).toBeCloseTo(feet[6]!.z, 9)
    // The back of a card on the owner's right looks to the right of the middle of the table, and the one on the left to the left: they face away from the centre of the arc
    const back = (i: number) => new Vector3(0, 0, -1).applyQuaternion(slots[i]!.quaternion)
    expect(back(6).x).toBeGreaterThan(0.05)
    expect(back(0).x).toBeLessThan(-0.05)
    expect(back(3).x).toBeCloseTo(0, 9)
    // and the bend is slight: no card is turned more than a quarter of a radian, and the cards are still vertical
    for (const [i] of slots.entries()) {
      expect(Math.abs(back(i).x), `card ${i}`).toBeLessThan(0.25)
      expect(back(i).y, `card ${i}`).toBeCloseTo(0, 9)
    }
  })

  it("keeps the distance between two neighbouring feet along the arc at the gap, and is a straight row when the arc is 0", () => {
    const flat = { ...HELD_FAN_SETTINGS, stack: 0 }
    const feet = heldFan(6, Math.PI, CARD, flat).map((slot) => ends(slot).foot)
    for (let i = 1; i < feet.length; i++) expect(feet[i]!.distanceTo(feet[i - 1]!), `feet ${i - 1} and ${i}`).toBeCloseTo(HELD_FAN_SETTINGS.gap, 2)
    const straight = heldFan(6, Math.PI, CARD, { ...flat, arc: 0 }).map((slot) => ends(slot).foot)
    for (const foot of straight) expect(foot.z).toBeCloseTo(0, 9)
  })

  it("never lets two neighbouring cards cross, however many there are and whichever way the seat is turned: the arc turns them from one another, and they are kept apart over their whole width", () => {
    type Point = { x: number; z: number }
    // What a card covers of the table: the segment its plane cuts at the height of its middle, along the horizontal direction of the plane
    const footprint = (pose: ReturnType<typeof heldFan>[number]): [Point, Point] => {
      const normal = new Vector3(0, 0, -1).applyQuaternion(pose.quaternion)
      const along = new Vector3(normal.z, 0, -normal.x).normalize()
      if (along.x < 0) along.negate()
      const half = (CARD.width * pose.scale) / 2
      return [
        { x: pose.position.x - along.x * half, z: pose.position.z - along.z * half },
        { x: pose.position.x + along.x * half, z: pose.position.z + along.z * half },
      ]
    }
    const side = (a: Point, b: Point, c: Point) => (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x)
    const cross = ([a, b]: [Point, Point], [c, d]: [Point, Point]) => side(c, d, a) * side(c, d, b) < 0 && side(a, b, c) * side(a, b, d) < 0
    for (const yaw of [0, 1, Math.PI / 2, 2.5, Math.PI, -Math.PI / 2, -2.5]) {
      for (let n = 2; n <= 8; n++) {
        const cards = heldFan(n, yaw, CARD).map(footprint)
        for (let i = 1; i < n; i++) expect(cross(cards[i - 1]!, cards[i]!), `yaw ${yaw.toFixed(2)}, ${n} cards, cards ${i - 1} and ${i}`).toBe(false)
      }
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
    // The seat the viewer faces, or nearly: across the table, and a little to the side of it. At a seat that is turned more the fan runs along the depth of the picture and the depth is the table's own: the card nearest the camera is in front
    // for a hand of every size and wherever the seat stands across the table: the arc brings the middle of the row nearest the middle of the table, and `stack` must beat it
    for (const yaw of [Math.PI, Math.PI - 0.1, -Math.PI + 0.1]) {
      for (const x of [-4, 0, 1.5, 4]) {
        for (let n = 2; n <= 8; n++) {
          const frame = { x, z: -5.3, yaw }
          const cards = heldFan(n, yaw, CARD).map((pose) => inFrame(frame, pose))
          const byScreen = cards.map((pose) => ({ x: pose.position.x, near: -camera.worldToLocal(pose.position.clone()).z })).sort((a, b) => a.x - b.x)
          // from the left of the picture to its right, each card is nearer the camera than the one before
          for (let i = 1; i < byScreen.length; i++) expect(byScreen[i]!.near, `yaw ${yaw.toFixed(2)}, x ${x}, ${n} cards, card ${i}`).toBeLessThan(byScreen[i - 1]!.near)
        }
      }
    }
  })

  it("has a first card on the left of the picture at the seats where the layout puts it there, as the rule of the animation says", () => {
    for (const yaw of [-Math.PI / 2, Math.PI / 2, Math.PI, -Math.PI, 2.4, -2.4]) {
      const frame = { x: 0, z: -5, yaw }
      const cards = heldFan(5, yaw, CARD).map((pose) => inFrame(frame, pose))
      const first = cards[0]!.position.x
      const last = cards[4]!.position.x
      // by the rule, the first card is the left end where `leftEndIsFirst` says so, with the layout that puts the cards there
      expect(first < last).toBe(leftEndIsFirst(frame, (count) => heldFan(count, yaw, CARD)))
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
