import { describe, expect, it } from "vitest"
import { seats } from "../layout"
import { auraForce, plateOf, SEAT_SETTINGS } from "./placement"

// The numbers the template's scene wrote inline before the plate moved here (`scene.tsx` and its `AVATAR` constant): the move must not change where any piece stands.
const AVATAR = { size: 0.56, gap: 0.18 }
function legacy(spot: { x: number; z: number }, viewer: boolean) {
  const pos: [number, number, number] = [spot.x * (viewer ? 1 : 1.32), 0.02, spot.z * (viewer ? 1.18 : 1.32)]
  const after = spot.x > 1
  return {
    x: pos[0],
    z: pos[2],
    nameZ: pos[2] - 0.25,
    lineZ: pos[2] + 0.35,
    after,
    avatarX: (after ? 1 : -1) * (AVATAR.gap + AVATAR.size / 2),
    crownX: -((after ? 0 : AVATAR.gap + AVATAR.size) + 0.6),
  }
}

const RING = { radiusX: 7.4, radiusZ: 4.4 }

describe("plateOf", () => {
  it("puts every piece where the template put it, for every seat of every table of two to eight", () => {
    for (let count = 2; count <= 8; count++) {
      for (let me = -1; me < count; me++) {
        seats(count, { ...RING, me: me < 0 ? null : me }).forEach((spot, i) => {
          expect(plateOf(spot, i === me)).toEqual(legacy(spot, i === me))
        })
      }
    }
  })

  it("keeps the viewer's plate level with the spot and a little in front of it", () => {
    const [viewer] = seats(3, { ...RING, me: 0 })
    const plate = plateOf(viewer!, true)
    expect(plate.x).toBe(0)
    expect(plate.z).toBeCloseTo(RING.radiusZ * SEAT_SETTINGS.viewerReachZ)
  })

  it("puts the avatar after the name for a seat on the right of the table only", () => {
    const ring = seats(5, { ...RING, me: 0 })
    expect(ring.map((spot, i) => plateOf(spot, i === 0).after)).toEqual([false, false, false, true, true])
  })

  it("puts the avatar on the side of the name it stands on, and the crown clear of the avatar when the avatar is before the name", () => {
    const before = plateOf({ x: -5, z: -3 }, false)
    const after = plateOf({ x: 5, z: -3 }, false)
    expect(before.avatarX).toBeLessThan(0)
    expect(after.avatarX).toBeGreaterThan(0)
    expect(before.crownX).toBeLessThan(before.avatarX)
    expect(after.crownX).toBe(-SEAT_SETTINGS.crownGap)
  })

  it("follows the settings it is given", () => {
    const wide = plateOf({ x: 4, z: 2 }, false, { ...SEAT_SETTINGS, reachX: 2, reachZ: 2, nameLift: 0.5 })
    expect(wide.x).toBe(8)
    expect(wide.z).toBe(4)
    expect(wide.nameZ).toBe(3.5)
  })

  it("lets a spot with no yaw stand, as the type allows", () => {
    expect(() => plateOf({ x: 0, z: 0 }, false)).not.toThrow()
  })
})

describe("auraForce", () => {
  it("lights the player of the turn, then a winner, else nobody", () => {
    expect(auraForce({ active: true, winner: false })).toBe(SEAT_SETTINGS.turnForce)
    expect(auraForce({ active: false, winner: true })).toBe(SEAT_SETTINGS.winnerForce)
    expect(auraForce({ active: false, winner: false })).toBe(0)
  })

  it("gives the turn the aura when a player is both", () => {
    expect(auraForce({ active: true, winner: true })).toBe(SEAT_SETTINGS.turnForce)
  })
})
