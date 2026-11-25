import { describe, expect, it } from "vitest"
import { boxesOverlap, boxOfPoses, boxOfRect, centreOf } from "../box"
import { row, seats } from "../layout"
import { PLATE_LETTERS, plateAbove, plateBoxOf, plateOf, plateRow, plateWidth, SEAT_SETTINGS, scaledSeat } from "./placement"

// Where the plate of a seat placed from its spot stands, worked out again from the settings: the spot of the ring stretched by the reach factors (the viewer's level with it), the name lifted and the info line dropped from its middle. The numbers the template's scene wrote
// inline before the plate moved here are not pinned: the sizes were changed on purpose since, the way the pieces stand from the settings was not.
function expected(spot: { x: number; z: number }, viewer: boolean) {
  const S = SEAT_SETTINGS
  const pos: [number, number] = [spot.x * (viewer ? S.viewerReachX : S.reachX), spot.z * (viewer ? S.viewerReachZ : S.reachZ)]
  return { x: pos[0], z: pos[1], nameZ: pos[1] - S.nameLift, lineZ: pos[1] + S.lineDrop }
}

const RING = { radiusX: 7.4, radiusZ: 4.4 }
const CARD = { width: 1.2, height: 1.8 }

describe("plateOf", () => {
  it("puts every piece where the settings say, for every seat of every table of two to eight", () => {
    for (let count = 2; count <= 8; count++) {
      for (let me = -1; me < count; me++) {
        seats(count, { ...RING, me: me < 0 ? null : me }).forEach((spot, i) => {
          expect(plateOf(spot, i === me)).toMatchObject(expected(spot, i === me))
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

  it("keeps the info line under the name, with the middle of the plate between them: the avatar stands level with it", () => {
    const plate = plateAbove({ minX: 0, maxX: 4, minZ: 0, maxZ: 2 })
    expect(plate.nameZ).toBeLessThan(plate.z)
    expect(plate.z).toBeLessThan(plate.lineZ)
    expect(plate.lineZ - plate.nameZ).toBeCloseTo(SEAT_SETTINGS.nameLift + SEAT_SETTINGS.lineDrop)
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
    expect(box.minZ).toBeCloseTo(plate.nameZ - SEAT_SETTINGS.nameHeight / 2)
    expect(box.maxZ).toBeCloseTo(plate.lineZ + SEAT_SETTINGS.lineHeight / 2)
  })

  it("holds the avatar and both lines of lettering, whatever the settings are", () => {
    for (const settings of [SEAT_SETTINGS, scaledSeat(0.6), { ...SEAT_SETTINGS, avatarSize: 1.4 }, { ...SEAT_SETTINGS, nameLift: 0.05, lineDrop: 0.05 }]) {
      const plate = plateOf({ x: 1, z: 2 }, false, settings)
      const box = plateBoxOf(plate, settings)
      expect(box.minZ).toBeLessThanOrEqual(plate.nameZ - settings.nameHeight / 2 + 1e-9)
      expect(box.minZ).toBeLessThanOrEqual(plate.z - settings.avatarSize / 2 + 1e-9)
      expect(box.maxZ).toBeGreaterThanOrEqual(plate.lineZ + settings.lineHeight / 2 - 1e-9)
      expect(box.maxZ).toBeGreaterThanOrEqual(plate.z + settings.avatarSize / 2 - 1e-9)
    }
  })

  it("leaves the foot `plateGap` from the cards when the avatar is taller than the lettering too", () => {
    const settings = { ...SEAT_SETTINGS, avatarSize: 1.4 }
    const cards = { minX: -2, maxX: 2, minZ: 1, maxZ: 3 }
    expect(plateBoxOf(plateAbove(cards, settings), settings).maxZ).toBeCloseTo(cards.minZ - settings.plateGap)
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
  const SIZES = ["nameHeight", "nameLift", "lineHeight", "lineDrop", "nameRoom", "avatarSize", "avatarGap", "crownSize", "crownGap", "plateGap"] as const

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

describe("plateRow", () => {
  const plate = plateOf({ x: 3, z: -2 }, false)

  it("puts the avatar to the left of the lettering, whatever the widths", () => {
    for (const [name, info] of [[0.4, 2.4], [2.4, 0.4], [3.1, null], [1, 1]] as const) {
      const row = plateRow(plate, { name, info })
      expect(row.avatarX + SEAT_SETTINGS.avatarSize / 2 + SEAT_SETTINGS.avatarGap).toBeCloseTo(row.textX, 10)
      expect(row.avatarX).toBeLessThan(row.textX)
    }
  })

  it("centres the block, from the avatar's left edge to the column's right edge, on the plate", () => {
    for (const [name, info] of [[0.4, 2.4], [2.4, 0.4], [3.1, null], [1, 1], [3.8, 3.8]] as const) {
      const row = plateRow(plate, { name, info })
      expect((row.minX + row.maxX) / 2, `a name ${name} wide, an info line ${info}`).toBeCloseTo(plate.x, 10)
      expect(row.minX + SEAT_SETTINGS.avatarSize / 2).toBeCloseTo(row.avatarX, 10)
      expect(row.maxX).toBeCloseTo(row.endX, 10)
    }
  })

  it("is as wide as the wider of the two lines, and the name alone when there is no info line", () => {
    const column = (name: number, info: number | null) => {
      const row = plateRow(plate, { name, info })
      return row.endX - row.textX
    }
    expect(column(1.2, 2.5)).toBeCloseTo(2.5, 10)
    expect(column(2.5, 1.2)).toBeCloseTo(2.5, 10)
    expect(column(2.5, null)).toBeCloseTo(2.5, 10)
    expect(column(0, 0)).toBe(0)
  })

  it("keeps the avatar between the two lines, and the name over the info line", () => {
    const row = plateRow(plate, { name: 1, info: 1 })
    expect(row.nameZ).toBe(plate.nameZ)
    expect(plate.nameZ).toBeLessThan(plate.z)
    expect(plate.z).toBeLessThan(plate.lineZ)
  })

  it("puts a name that stands alone level with the avatar's centre, so that it is aligned with it", () => {
    expect(plateRow(plate, { name: 1.5, info: null }).nameZ).toBe(plate.z)
  })

  it("does it for a plate of another size", () => {
    for (const settings of [scaledSeat(0.7), scaledSeat(1.3)]) {
      const scaled = plateOf({ x: 3, z: -2 }, false, settings)
      const row = plateRow(scaled, { name: 2.2, info: 1.4 }, settings)
      expect((row.minX + row.maxX) / 2).toBeCloseTo(scaled.x, 10)
      expect(row.textX - row.avatarX).toBeCloseTo(settings.avatarSize / 2 + settings.avatarGap, 10)
    }
  })

  it("leaves the block, with a name of the width a layout expects, within the box a layout leaves for a plate", () => {
    const box = plateBoxOf(plate)
    const row = plateRow(plate, { name: PLATE_LETTERS * 0.5 * SEAT_SETTINGS.nameHeight, info: null })
    expect(row.minX).toBeCloseTo(box.minX, 10)
    expect(row.maxX).toBeCloseTo(box.maxX, 10)
  })
})
