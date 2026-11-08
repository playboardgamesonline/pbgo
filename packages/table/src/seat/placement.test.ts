import { describe, expect, it } from "vitest"
import { seats } from "../layout"
import { auraForce, plateOf, SEAT_SETTINGS } from "./placement"

// The places the template's scene wrote inline before the plate moved here (`scene.tsx` and its `AVATAR` constant): the plate of a seat has not moved since.
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
  }
}

const RING = { radiusX: 7.4, radiusZ: 4.4 }

describe("plateOf", () => {
  it("keeps every piece where the template put it, for every seat of every table of two to eight", () => {
    for (let count = 2; count <= 8; count++) {
      for (let me = -1; me < count; me++) {
        seats(count, { ...RING, me: me < 0 ? null : me }).forEach((spot, i) => {
          expect(plateOf(spot, i === me)).toMatchObject(legacy(spot, i === me))
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

  it("puts the avatar on the side of the name it stands on", () => {
    expect(plateOf({ x: -5, z: -3 }, false).avatarX).toBeLessThan(0)
    expect(plateOf({ x: 5, z: -3 }, false).avatarX).toBeGreaterThan(0)
  })

  it("puts the crown on the upper-right corner of the avatar, in the avatar's frame, whichever side of the name the avatar stands", () => {
    for (const spot of [{ x: -5, z: -3 }, { x: 5, z: -3 }]) {
      const plate = plateOf(spot, false)
      expect(plate.crownX - plate.avatarX).toBeCloseTo(SEAT_SETTINGS.crownRight)
      expect(plate.crownZ).toBeCloseTo(-SEAT_SETTINGS.crownBack)
    }
  })

  it("stands the status under the line, which stands under the name", () => {
    const plate = plateOf({ x: 3, z: -3 }, false)
    expect(plate.nameZ).toBeLessThan(plate.lineZ)
    expect(plate.lineZ).toBeLessThan(plate.statusZ)
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
  it("lights nothing at rest, and not the turn either: the crown says whose turn it is", () => {
    expect(auraForce({})).toBe(0)
    expect(auraForce({ active: true })).toBe(SEAT_SETTINGS.turnForce)
    expect(SEAT_SETTINGS.turnForce).toBe(0)
  })

  it("lights a player the game expects with others, a seat under the pointer and a winner, each in its own force", () => {
    expect(auraForce({ waiting: true })).toBe(SEAT_SETTINGS.waitingForce)
    expect(auraForce({ hovered: true })).toBe(SEAT_SETTINGS.hoverForce)
    expect(auraForce({ winner: true })).toBe(SEAT_SETTINGS.winnerForce)
  })

  it("gives the brightest of the lights that apply", () => {
    expect(auraForce({ waiting: true, winner: true })).toBe(SEAT_SETTINGS.winnerForce)
    expect(auraForce({ waiting: true, hovered: true })).toBe(Math.max(SEAT_SETTINGS.waitingForce, SEAT_SETTINGS.hoverForce))
  })

  it("lights the turn when the setting is raised", () => {
    expect(auraForce({ active: true }, { ...SEAT_SETTINGS, turnForce: 0.9 })).toBe(0.9)
    expect(auraForce({ active: true, winner: true }, { ...SEAT_SETTINGS, turnForce: 0.9 })).toBe(SEAT_SETTINGS.winnerForce)
  })
})
