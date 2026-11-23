import { describe, expect, it } from "vitest"
import { boxesOverlap, boxOfPoses, boxOfRect, centreOf } from "../box"
import { row, seats } from "../layout"
import { PLATE_LETTERS, plateAbove, plateBoxOf, plateOf, plateWidth, SEAT_SETTINGS, scaledSeat } from "./placement"

// The places the template's scene wrote inline before the plate moved here (`scene.tsx` and its `AVATAR` constant): the plate of a seat placed from its spot has not moved since, but for the info line, which stands a little lower, and the avatar, which is always to the left.
const AVATAR = { size: 0.56, gap: 0.18 }
function legacy(spot: { x: number; z: number }, viewer: boolean) {
  const pos: [number, number, number] = [spot.x * (viewer ? 1 : 1.32), 0.02, spot.z * (viewer ? 1.18 : 1.32)]
  return { x: pos[0], z: pos[2], nameZ: pos[2] - 0.25, avatarX: -(AVATAR.gap + AVATAR.size / 2) }
}

const RING = { radiusX: 7.4, radiusZ: 4.4 }
const CARD = { width: 1.2, height: 1.8 }

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

  it("puts the avatar to the left of the name at every seat, left, middle or right of the table: the plate is read left to right", () => {
    for (const x of [-6, -1, 0, 1, 6]) expect(plateOf({ x, z: -3 }, false).avatarX).toBeLessThan(0)
    for (const count of [3, 5, 8]) for (const spot of seats(count, { ...RING, me: 0 })) expect(plateOf(spot, false).avatarX).toBeLessThan(0)
  })

  it("puts the crown on the upper-right corner of the avatar, in the avatar's frame, as the avatar is always to the left of the name", () => {
    for (const spot of [{ x: -5, z: -3 }, { x: 5, z: -3 }]) {
      const plate = plateOf(spot, false)
      expect(plate.crownX - plate.avatarX).toBeCloseTo(SEAT_SETTINGS.crownRight)
      expect(plate.crownZ).toBeCloseTo(-SEAT_SETTINGS.crownBack)
    }
  })

  it("stands the info line under the name", () => {
    const plate = plateOf({ x: 3, z: -3 }, false)
    expect(plate.nameZ).toBeLessThan(plate.lineZ)
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

describe("plateAbove", () => {
  it("stands the foot of the plate `plateGap` above the top edge of the cards, centred on them", () => {
    const cards = { minX: -2, maxX: 4, minZ: -1, maxZ: 1 }
    const plate = plateAbove(cards)
    expect(plate.x).toBe(1)
    expect(plateBoxOf(plate).maxZ).toBeCloseTo(cards.minZ - SEAT_SETTINGS.plateGap)
  })

  it("is above the cards, centred on them and clear of them by the gap, whichever way the cards are turned", () => {
    for (let k = 0; k < 24; k++) {
      const yaw = (k / 24) * 2 * Math.PI
      const cards = boxOfRect({ x: 3, z: -2, width: 6, depth: 1.8, yaw })
      const plate = plateAbove(cards)
      const box = plateBoxOf(plate)
      expect(plate.x).toBeCloseTo(centreOf(cards).x)
      expect(box.maxZ).toBeCloseTo(cards.minZ - SEAT_SETTINGS.plateGap)
      expect(boxesOverlap(box, cards)).toBe(false)
    }
  })

  it("is above the cards of every seat of every table of two to eight, the viewer's seat and a spectator's table included", () => {
    for (let count = 2; count <= 8; count++) {
      for (let me = -1; me < count; me++) {
        for (const spot of seats(count, { ...RING, me: me < 0 ? null : me })) {
          const cards = boxOfPoses(row(5, { gap: 1.4 }), CARD, { frame: spot })!
          const plate = plateAbove(cards)
          const box = plateBoxOf(plate)
          expect(box.maxZ).toBeLessThanOrEqual(cards.minZ - SEAT_SETTINGS.plateGap + 1e-9)
          expect(plate.x).toBeCloseTo(centreOf(cards).x)
        }
      }
    }
  })

  it("is the same plate for the viewer and for an opponent whose cards cover the same part of the table", () => {
    const cards = { minX: -3, maxX: 3, minZ: 2, maxZ: 4 }
    expect(plateAbove(cards)).toEqual(plateAbove({ ...cards }))
  })

  it("keeps the pieces of a plate where the plate has always had them: the avatar to the left, the info line under the name", () => {
    const plate = plateAbove({ minX: 0, maxX: 4, minZ: 0, maxZ: 2 })
    expect(plate.avatarX).toBeLessThan(0)
    expect(plate.nameZ).toBeLessThan(plate.lineZ)
    expect(plate.crownX - plate.avatarX).toBeCloseTo(SEAT_SETTINGS.crownRight)
  })

  it("follows the settings it is given", () => {
    const far = plateAbove({ minX: 0, maxX: 4, minZ: 0, maxZ: 2 }, { ...SEAT_SETTINGS, plateGap: 1 })
    expect(plateBoxOf(far, { ...SEAT_SETTINGS, plateGap: 1 }).maxZ).toBeCloseTo(-1)
  })
})

describe("plateBoxOf", () => {
  it("covers a plate from the top of its name to the foot of its info line, as wide as a plate of a few letters", () => {
    const plate = plateOf({ x: 2, z: 3 }, false)
    const box = plateBoxOf(plate)
    expect(box.maxX - box.minX).toBeCloseTo(plateWidth())
    expect(centreOf(box).x).toBeCloseTo(plate.x)
    expect(box.minZ).toBeCloseTo(plate.nameZ - Math.max(SEAT_SETTINGS.nameHeight, SEAT_SETTINGS.avatarSize) / 2)
    expect(box.maxZ).toBeCloseTo(plate.lineZ + SEAT_SETTINGS.lineHeight / 2)
  })

  it("is as wide as the avatar and `PLATE_LETTERS` letters, or as wide as it is told", () => {
    expect(plateWidth()).toBeCloseTo(SEAT_SETTINGS.avatarGap + SEAT_SETTINGS.avatarSize + PLATE_LETTERS * 0.5 * SEAT_SETTINGS.nameHeight)
    const plate = plateOf({ x: 0, z: 0 }, false)
    const box = plateBoxOf(plate, SEAT_SETTINGS, 5)
    expect(box.maxX - box.minX).toBe(5)
  })
})

describe("the room of a name", () => {
  it("holds more than the six letters a layout leaves for a plate, so that a name that is not wide is never shrunk", () => {
    expect(SEAT_SETTINGS.nameRoom).toBeGreaterThan(PLATE_LETTERS * 0.5 * SEAT_SETTINGS.nameHeight)
  })
})

describe("scaledSeat", () => {
  const SIZES = ["nameHeight", "nameLift", "lineHeight", "lineDrop", "nameRoom", "avatarSize", "avatarGap", "crownSize", "crownRight", "crownBack", "plateGap"] as const

  it("multiplies every size and every gap, and leaves the reach factors and the opacity", () => {
    const small = scaledSeat(0.5)
    for (const key of SIZES) expect(small[key], key).toBeCloseTo(SEAT_SETTINGS[key] / 2, 10)
    for (const key of ["reachX", "reachZ", "viewerReachX", "viewerReachZ", "awayOpacity"] as const) expect(small[key], key).toBe(SEAT_SETTINGS[key])
  })

  it("names every setting there is: a setting added later that is a size has to be scaled here", () => {
    const sizes = new Set<string>(SIZES)
    const factors = new Set(["reachX", "reachZ", "viewerReachX", "viewerReachZ", "awayOpacity"])
    expect(Object.keys(SEAT_SETTINGS).filter((key) => !sizes.has(key) && !factors.has(key))).toEqual([])
  })

  it("makes a copy: the settings the debug panel edits are not touched", () => {
    const before = { ...SEAT_SETTINGS }
    scaledSeat(2)
    expect(SEAT_SETTINGS).toEqual(before)
  })

  it("makes a plate that is as wide as its size says, and the layout works its boxes out with the same settings", () => {
    const half = scaledSeat(0.5)
    expect(plateWidth(half)).toBeCloseTo(plateWidth() / 2, 10)
    const cards = { minX: -2, maxX: 2, minZ: 1, maxZ: 3 }
    const full = plateBoxOf(plateAbove(cards))
    const small = plateBoxOf(plateAbove(cards, half), half)
    expect(small.maxX - small.minX).toBeCloseTo((full.maxX - full.minX) / 2, 10)
    expect(small.maxZ - small.minZ).toBeCloseTo((full.maxZ - full.minZ) / 2, 10)
    // its foot stands nearer the cards by the gap it scaled
    expect(cards.minZ - small.minZ).toBeLessThan(cards.minZ - full.minZ)
  })
})
