import { describe, expect, it } from "vitest"
import { BUTTON_WIDTH, buttonPlace, CARD, heldPlace, heldPoses, LAYOUT_SETTINGS, lineGap, linePoses, lines, pilePlaces, seatSpots, tableFootprints } from "./layout"

const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i}`)
const SIZES = [3, 4, 5, 6, 7, 8]

describe("the seats", () => {
  it("put the viewer in front and everybody else on the far half, at every size of table", () => {
    for (const n of SIZES) {
      const spots = seatSpots(ids(n), "p1")
      expect(spots.size, `${n} players`).toBe(n)
      expect(spots.get("p1")!.z, `${n} players: the viewer`).toBeGreaterThan(0)
      for (const [id, spot] of spots) if (id !== "p1") expect(spot.z, `${n} players: ${id}`).toBeLessThan(0)
    }
  })

  it("seat a spectator, who has no seat, with nobody in front", () => {
    for (const n of SIZES) for (const spot of seatSpots(ids(n), null).values()) expect(spot.z).toBeLessThanOrEqual(0)
  })
})

describe("the lines of the players", () => {
  it("give every player one, the viewer's in front of them and as wide as the table", () => {
    for (const n of SIZES) {
      const all = lines(seatSpots(ids(n), "p0"), "p0")
      expect([...all.keys()].sort()).toEqual(ids(n).sort())
      expect(all.get("p0")!.at.z).toBe(LAYOUT_SETTINGS.viewerZ)
      expect(all.get("p0")!.width).toBe(LAYOUT_SETTINGS.viewerWidth)
    }
  })

  it("keep an opponent's between their seat and the middle of the table", () => {
    const spots = seatSpots(ids(6), "p0")
    for (const [id, line] of lines(spots, "p0")) {
      if (id === "p0") continue
      const spot = spots.get(id)!
      expect(Math.abs(line.at.x), id).toBeLessThan(Math.abs(spot.x) + 1e-9)
      expect(Math.abs(line.at.z), id).toBeLessThan(Math.abs(spot.z))
      expect(Math.sign(line.at.z), id).toBe(Math.sign(spot.z))
    }
  })

  it("never run into each other: no two opponents' lines overlap, whatever the size of the table", () => {
    for (const n of SIZES) {
      const opponents = [...lines(seatSpots(ids(n), "p0"), "p0")].filter(([id]) => id !== "p0").map(([, line]) => line)
      opponents.sort((a, b) => a.at.x - b.at.x)
      for (let i = 1; i < opponents.length; i++) {
        const gap = opponents[i]!.at.x - opponents[i - 1]!.at.x
        expect(opponents[i]!.width / 2 + opponents[i - 1]!.width / 2, `${n} players, lines ${i - 1} and ${i}`).toBeLessThanOrEqual(gap + 1e-9)
      }
    }
  })

  it("give a lone opponent all the room of the table", () => {
    const only = lines(seatSpots(ids(2), "p0"), "p0").get("p1")!
    expect(only.width).toBe(LAYOUT_SETTINGS.viewerWidth)
  })
})

describe("a line of cards", () => {
  const line = { scale: 1, width: 10 }
  const widest = CARD.width * LAYOUT_SETTINGS.gap

  it("spreads at the widest gap while it fits", () => {
    expect(lineGap(1, line)).toBe(widest)
    expect(lineGap(4, line)).toBeCloseTo(widest)
  })

  it("draws its cards closer, over one another, when it does not fit", () => {
    const gap = lineGap(12, line)
    expect(gap).toBeLessThan(widest)
    // the whole line, the last card included, is no wider than the room it has
    expect(gap * 11 + CARD.width).toBeLessThanOrEqual(line.width + 1e-9)
  })

  it("never goes closer than the closest gap, so that the figure of each card can be read", () => {
    expect(lineGap(14, { scale: 0.62, width: 1.2 })).toBeCloseTo(CARD.width * 0.62 * LAYOUT_SETTINGS.closest)
  })

  it("is a row centred on its place, the first card on the left and each one a hair above the one before", () => {
    const poses = linePoses(5, line)
    expect(poses).toHaveLength(5)
    expect(poses.map((pose) => pose.position.x).reduce((sum, x) => sum + x, 0)).toBeCloseTo(0)
    for (let i = 1; i < poses.length; i++) {
      expect(poses[i]!.position.x).toBeGreaterThan(poses[i - 1]!.position.x)
      expect(poses[i]!.position.y).toBeGreaterThan(poses[i - 1]!.position.y)
    }
    expect(poses.every((pose) => pose.scale === 1)).toBe(true)
  })

  it("is nothing for no card", () => {
    expect(linePoses(0, line)).toEqual([])
  })
})

describe("the cards set aside during a Flip Three", () => {
  it("lie toward the viewer, beyond their own line, and toward the middle for an opponent", () => {
    const mine = { at: { x: 0, z: 3.1 }, scale: 1, width: 13 }
    expect(heldPlace(mine, true).z).toBeGreaterThan(mine.at.z)
    const theirs = { at: { x: 2, z: -2.6 }, scale: 0.62, width: 2 }
    const place = heldPlace(theirs, false)
    expect(Math.hypot(place.x, place.z)).toBeLessThan(Math.hypot(theirs.at.x, theirs.at.z))
  })

  it("are smaller than the line, in a row of their own", () => {
    const poses = heldPoses(3, { scale: 1 })
    expect(poses).toHaveLength(3)
    expect(poses[0]!.scale).toBeLessThan(1)
  })
})

describe("the piles", () => {
  it("lie either side of the middle of the table", () => {
    const { deck, discard } = pilePlaces()
    expect(deck.x).toBeLessThan(0)
    expect(discard.x).toBeGreaterThan(0)
    expect(deck.z).toBe(discard.z)
  })
})

describe("the button", () => {
  it("lies beside the discard, clear of the two piles and of the viewer's line, the same for Stay and for Deal", () => {
    const { discard } = pilePlaces()
    const button = buttonPlace()
    // right of the discard's right edge, in the middle band, level with the piles
    expect(button.x - BUTTON_WIDTH / 2).toBeGreaterThan(discard.x + (CARD.width * LAYOUT_SETTINGS.pileScale) / 2)
    expect(button.z).toBe(discard.z)
    expect(button.z + 0.5).toBeLessThan(LAYOUT_SETTINGS.viewerZ - CARD.height / 2)
  })
})

describe("the footprints of a table", () => {
  it("are the plate and the line of each seat, the piles and the button, whatever the number of players", () => {
    for (const n of SIZES) expect(tableFootprints(n), `${n} players`).toHaveLength(2 * n + 2)
  })

  it("are rectangles with some size", () => {
    for (const n of SIZES) for (const box of tableFootprints(n)) {
      expect(box.x1).toBeGreaterThan(box.x0)
      expect(box.z1).toBeGreaterThan(box.z0)
    }
  })

  it("put the viewer's plate nearest to the viewer and the opponents' beyond the middle", () => {
    for (const n of SIZES) {
      const boxes = tableFootprints(n)
      // the plate is the first footprint of a seat, in the order of the seats, the viewer's first
      const plates = boxes.slice(0, 2 * n).filter((_, i) => i % 2 === 0)
      expect(plates[0]!.z0, `${n} players`).toBeGreaterThan(0)
      for (const plate of plates.slice(1)) expect(plate.z1, `${n} players`).toBeLessThan(LAYOUT_SETTINGS.viewerZ)
    }
  })
})
