import { Vector3 } from "three"
import { describe, expect, it } from "vitest"
import { FACE_DOWN, FACE_UP, type Pose, RESTING_HEIGHT, hashRandom, lean, onTable, shifted } from "./pose"

/** Where the card's front looks, and where its top edge points */
const frontOf = (pose: Pose) => new Vector3(0, 0, 1).applyQuaternion(pose.quaternion)
const topOf = (pose: Pose) => new Vector3(0, 1, 0).applyQuaternion(pose.quaternion)

describe("hashRandom", () => {
  it("is pinned: every pile of every table leans by these numbers", () => {
    expect(hashRandom("")).toBeCloseTo(0.008685800016086098, 12)
    expect(hashRandom("a")).toBeCloseTo(0.7816211194222842, 12)
    expect(hashRandom("card-1")).toBeCloseTo(-0.9323814189835409, 12)
    expect(hashRandom("hand:3")).toBeCloseTo(0.15636001880195916, 12)
  })

  it("stays between -1 and 1", () => {
    for (let i = 0; i < 500; i++) expect(Math.abs(hashRandom(`card-${i}`))).toBeLessThanOrEqual(1)
  })

  it("tells keys apart", () => {
    const keys = Array.from({ length: 200 }, (_, i) => `card-${i}`)
    expect(new Set(keys.map(hashRandom)).size).toBe(keys.length)
  })
})

describe("lean", () => {
  it("turns about the vertical axis only, by the key's number times the amplitude", () => {
    const q = lean("card-1", 0.1)
    expect(q.x).toBeCloseTo(0, 12)
    expect(q.z).toBeCloseTo(0, 12)
    expect(2 * Math.atan2(q.y, q.w)).toBeCloseTo(hashRandom("card-1") * 0.1, 12)
  })

  it("is always the same for a key, and never more than the amplitude", () => {
    for (let i = 0; i < 100; i++) {
      const q = lean(`card-${i}`, 0.05)
      expect(q.equals(lean(`card-${i}`, 0.05))).toBe(true)
      expect(Math.abs(2 * Math.atan2(q.y, q.w))).toBeLessThanOrEqual(0.05)
    }
  })

  it("is about one degree at most when no amplitude is given", () => {
    for (let i = 0; i < 100; i++) expect(Math.abs(2 * Math.atan2(lean(`card-${i}`).y, lean(`card-${i}`).w))).toBeLessThanOrEqual(0.017)
  })
})

describe("onTable", () => {
  it("lays a card face up at the resting height: the front looks at the sky, the top edge points away from the player", () => {
    const pose = onTable(1.5, -2)
    expect(pose.position.toArray()).toEqual([1.5, RESTING_HEIGHT, -2])
    expect(pose.scale).toBe(1)
    expect(frontOf(pose).y).toBeCloseTo(1, 12)
    expect(topOf(pose).z).toBeCloseTo(-1, 12)
    expect(pose.quaternion.angleTo(FACE_UP)).toBeCloseTo(0, 12)
  })

  it("lays a card face down: the back looks at the sky", () => {
    const pose = onTable(0, 0, { face: "down" })
    expect(frontOf(pose).y).toBeCloseTo(-1, 12)
    expect(topOf(pose).z).toBeCloseTo(1, 12)
    expect(pose.quaternion.angleTo(FACE_DOWN)).toBeCloseTo(0, 12)
  })

  it("turns the card about the vertical axis by the yaw", () => {
    const pose = onTable(0, 0, { yaw: Math.PI / 2 })
    expect(frontOf(pose).y).toBeCloseTo(1, 12)
    expect(topOf(pose).x).toBeCloseTo(-1, 12)
  })

  it("tilts a hair by the key, the same way every time, without leaving the table", () => {
    const pose = onTable(0, 0, { lean: "pile-3", leanAmplitude: 0.1 })
    const again = onTable(0, 0, { lean: "pile-3", leanAmplitude: 0.1 })
    expect(pose.quaternion.equals(again.quaternion)).toBe(true)
    expect(pose.quaternion.angleTo(FACE_UP)).toBeCloseTo(Math.abs(hashRandom("pile-3") * 0.1), 12)
    expect(frontOf(pose).y).toBeCloseTo(1, 12)
  })

  it("takes the height, the scale and the delay it is given, and carries a delay only if given", () => {
    const pose = onTable(0, 0, { y: 0.2, scale: 0.8, delay: 0.3 })
    expect(pose.position.y).toBe(0.2)
    expect(pose.scale).toBe(0.8)
    expect(pose.delay).toBe(0.3)
    expect("delay" in onTable(0, 0)).toBe(false)
  })

  it("never hands out FACE_UP or FACE_DOWN: turning a pose leaves them alone", () => {
    const pose = onTable(0, 0)
    pose.quaternion.set(0, 1, 0, 0)
    expect(onTable(0, 0).quaternion.angleTo(FACE_UP)).toBeCloseTo(0, 12)
    expect(FACE_UP.y).toBe(0)
  })
})

describe("shifted", () => {
  it("moves the position by the offset and keeps the orientation, the scale and the delay", () => {
    const pose = onTable(1, 2, { y: 0.5, yaw: 0.3, scale: 0.8, delay: 0.2 })
    const next = shifted(pose, { x: 0.1, y: 0.45, z: -0.25 })
    expect(next.position.x).toBeCloseTo(1.1, 12)
    expect(next.position.y).toBeCloseTo(0.95, 12)
    expect(next.position.z).toBeCloseTo(1.75, 12)
    expect(next.quaternion.equals(pose.quaternion)).toBe(true)
    expect(next.scale).toBe(0.8)
    expect(next.delay).toBe(0.2)
  })

  it("leaves the original pose alone and shares nothing with it", () => {
    const pose = onTable(1, 2)
    const next = shifted(pose, { y: 1 })
    next.position.x = 99
    next.quaternion.set(0, 1, 0, 0)
    expect(pose.position.toArray()).toEqual([1, RESTING_HEIGHT, 2])
    expect(pose.quaternion.angleTo(FACE_UP)).toBeCloseTo(0, 12)
  })

  it("moves nothing along an axis it is not given, and carries a delay only if the pose has one", () => {
    const next = shifted(onTable(1, 2), { z: 1 })
    expect(next.position.toArray()).toEqual([1, RESTING_HEIGHT, 3])
    expect("delay" in next).toBe(false)
  })
})
