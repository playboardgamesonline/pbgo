import { describe, expect, it } from "vitest"
import {
  type Box,
  boxesOverlap,
  CARD,
  cardSize,
  cellPlace,
  cellPose,
  cellSpot,
  cellZone,
  FLOOR,
  fitPrompt,
  floorPlan,
  gridBox,
  grids,
  gridSize,
  LAYOUT_SETTINGS,
  pilePlaces,
  pitchOf,
  plateBox,
  seatAngle,
  seatAt,
  seatSpots,
  tableBoxes,
  tableOf,
  uprightYaw,
  wrapWords,
} from "./layout"

const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i}`)
const SIZES = [2, 3, 4, 5, 6, 7, 8]

describe("the angle of a seat", () => {
  const angles = (n: number, seated = true) => Array.from({ length: n }, (_, i) => seatAngle(i, n, seated))

  it("puts the viewer in front and the others around the table, clockwise from them, at every size of table from two to eight", () => {
    for (const n of SIZES) {
      const all = angles(n)
      expect(all[0], `${n} players`).toBe(0)
      for (let i = 1; i < n; i++) expect(all[i]!, `${n} players, seat ${i}`).toBeGreaterThan(all[i - 1]!)
      expect(all[n - 1]!, `${n} players`).toBeLessThan(360)
    }
  })

  it("is the same on both sides of the viewer: the opponents mirror each other", () => {
    for (const n of SIZES) {
      const all = angles(n)
      for (let i = 1; i < n; i++) expect(all[i]! + all[n - i]!, `${n} players, seats ${i} and ${n - i}`).toBeCloseTo(360)
    }
  })

  it("is the table of the arrangement: who sits where, 2 to 8", () => {
    expect(angles(2)).toEqual([0, 180])
    expect(angles(3)).toEqual([0, 145, 215])
    expect(angles(4)).toEqual([0, 90, 180, 270])
    expect(angles(5)).toEqual([0, 90, 150, 210, 270])
    expect(angles(6).map(Math.round)).toEqual([0, 66, 123, 180, 237, 294])
    expect(angles(7).map(Math.round)).toEqual([0, 62, 109, 156, 204, 251, 298])
    expect(angles(8).map(Math.round)).toEqual([0, 60, 100, 140, 180, 220, 260, 300])
  })

  it("seats a spectator at the places a table with one more player has, the empty chair in front being nobody's", () => {
    for (const n of SIZES) {
      expect(angles(n, false), `${n} players`).toEqual(angles(n + 1).slice(1))
    }
  })
})

describe("the seats", () => {
  it("put the viewer in front, upright, and give every other seat the yaw that turns it to face the middle", () => {
    for (const n of SIZES) {
      const spots = seatSpots(ids(n), "p1")
      expect(spots.size, `${n} players`).toBe(n)
      expect(spots.get("p1")).toMatchObject({ x: 0, yaw: 0 })
      expect(spots.get("p1")!.z).toBeGreaterThan(0)
      for (const [id, spot] of spots) {
        if (id === "p1") continue
        // facing the middle: the seat's own "toward the middle" (its -z axis turned by the yaw) points at the origin
        const toward = { x: -Math.sin(spot.yaw), z: -Math.cos(spot.yaw) }
        const middle = { x: -spot.x, z: -spot.z }
        const length = Math.hypot(middle.x, middle.z)
        expect(toward.x * (middle.x / length) + toward.z * (middle.z / length), `${n} players, ${id}`).toBeCloseTo(1)
      }
    }
  })

  it("turn the order of play to the viewer's left: the player after the viewer sits on the viewer's left", () => {
    const spots = seatSpots(ids(4), "p0")
    expect(spots.get("p1")!.x).toBeLessThan(0)
    expect(spots.get("p3")!.x).toBeGreaterThan(0)
    expect(spots.get("p2")!.z).toBeLessThan(0)
  })

  it("do not depend on who sits first: the viewer is always in front", () => {
    for (const me of ["p0", "p2", "p4"]) expect(seatSpots(ids(5), me).get(me)).toMatchObject({ x: 0, yaw: 0 })
  })

  it("seat a spectator on a ring with an empty chair in front: nobody sits in front", () => {
    for (const n of SIZES) {
      const spots = seatSpots(ids(n), null)
      for (const spot of spots.values()) expect(spot.z, `${n} players`).toBeLessThanOrEqual(0.001 + LAYOUT_SETTINGS.radiusZ8 * 1.01)
      expect(spots.size).toBe(n)
    }
  })

  it("is a pure function: the same table gives the same seats", () => {
    expect(seatSpots(ids(6), "p2")).toEqual(seatSpots(ids(6), "p2"))
    expect(seatAt(90, 4, 3).x).toBeCloseTo(-4)
  })

  it("grows from a table of two to a table of eight: smaller cards for opponents", () => {
    expect(tableOf(2).opponentScale).toBe(LAYOUT_SETTINGS.opponentScale2)
    expect(tableOf(8).opponentScale).toBe(LAYOUT_SETTINGS.opponentScale8)
    let before = Infinity
    for (const n of SIZES) {
      expect(tableOf(n).opponentScale).toBeLessThanOrEqual(before + 1e-9)
      before = tableOf(n).opponentScale
    }
  })
})

describe("a grid", () => {
  it("is four columns of three: the cell is `column * 3 + row`, columns left to right and the first row toward the middle", () => {
    const scale = 1
    const pitch = pitchOf(scale)
    expect(cellSpot(0, scale)).toEqual({ x: -1.5 * pitch.x, z: -pitch.z })
    expect(cellSpot(2, scale)).toEqual({ x: -1.5 * pitch.x, z: pitch.z })
    expect(cellSpot(11, scale)).toEqual({ x: 1.5 * pitch.x, z: pitch.z })
    expect(cellSpot(4, scale).z).toBe(0)
    const xs = Array.from({ length: 4 }, (_, column) => cellSpot(column * 3, scale).x)
    expect(xs).toEqual([...xs].sort((a, b) => a - b))
  })

  it("overlaps its rows a little, so that the figure at the top of each card stays readable, and never overlaps its columns", () => {
    for (const scale of [0.3, 0.6, 1]) {
      const pitch = pitchOf(scale)
      const card = cardSize(scale)
      expect(pitch.z).toBeLessThan(card.height)
      expect(pitch.z).toBeGreaterThan(card.height * 0.55)
      expect(pitch.x).toBeGreaterThan(card.width)
    }
  })

  it("has the size its cells say", () => {
    const { width, depth } = gridSize(1)
    const pitch = pitchOf(1)
    expect(width).toBeCloseTo(3 * pitch.x + CARD.width)
    expect(depth).toBeCloseTo(2 * pitch.z + CARD.height)
  })

  it("lays a card face up or face down at its cell, a hair higher the lower the row, so that overlapping cards never fight for a pixel", () => {
    const up = cellPose(1, true, 0.5)
    const down = cellPose(1, false, 0.5)
    expect(up.scale).toBe(0.5)
    expect(up.position.y).toBeLessThan(cellPose(2, true, 0.5).position.y)
    expect(up.quaternion.equals(down.quaternion)).toBe(false)
  })

  it("puts the cell of the viewer where it reads in the frame of the grid, and the cell of a turned seat where its frame turns it", () => {
    const viewer = { at: { x: 0, z: 3 }, yaw: 0, scale: 0.7 }
    const spot = cellSpot(0, 0.7)
    expect(cellPlace(viewer, 0)).toMatchObject({ x: spot.x, z: 3 + spot.z, yaw: 0 })
    // across the table (yaw π), the first column is on the viewer's right and the first row nearer the viewer
    const across = { at: { x: 0, z: -3 }, yaw: Math.PI, scale: 0.7 }
    expect(cellPlace(across, 0).x).toBeCloseTo(-spot.x)
    expect(cellPlace(across, 0).z).toBeCloseTo(-3 - spot.z)
  })

  it("has twelve cells zones that tile the grid with no gap and no overlap, for the viewer and for a seat turned to the side", () => {
    for (const grid of [{ at: { x: 0, z: 3.4 }, yaw: 0, scale: 0.74 }, { at: { x: -4, z: 0 }, yaw: -Math.PI / 2, scale: 0.5 }, { at: { x: 2, z: -3 }, yaw: Math.PI * 0.8, scale: 0.4 }]) {
      const zones = Array.from({ length: 12 }, (_, position) => cellZone(grid, position))
      for (let i = 0; i < 12; i++) for (let j = i + 1; j < 12; j++) expect(boxesOverlap(zones[i]!, zones[j]!), `${i} and ${j}`).toBe(false)
      // four columns of `pitch.x` and rows that add up to the depth of the grid: the gaps between the columns belong to the zones
      const area = zones.reduce((sum, zone) => sum + 4 * zone.halfWidth * zone.halfDepth, 0)
      const { depth } = gridSize(grid.scale)
      expect(area).toBeCloseTo(4 * pitchOf(grid.scale).x * depth, 6)
      // every zone holds its own card's centre, in its own frame
      zones.forEach((zone, position) => {
        const centre = cellPlace(grid, position)
        const dx = centre.x - zone.x
        const dz = centre.z - zone.z
        const along = dx * Math.cos(zone.yaw) - dz * Math.sin(zone.yaw)
        const out = dx * Math.sin(zone.yaw) + dz * Math.cos(zone.yaw)
        expect(Math.abs(along), `cell ${position}`).toBeLessThanOrEqual(zone.halfWidth + 1e-9)
        expect(Math.abs(out), `cell ${position}`).toBeLessThanOrEqual(zone.halfDepth + 1e-9)
      })
    }
  })

  it("makes the zone of a card of the viewer comfortably big: at least a card wide and two thirds of a card tall", () => {
    const grid = grids(seatSpots(ids(4), "p0"), "p0").get("p0")!
    const card = cardSize(grid.scale)
    for (let position = 0; position < 12; position++) {
      const zone = cellZone(grid, position)
      expect(zone.halfWidth * 2).toBeGreaterThanOrEqual(card.width)
      expect(zone.halfDepth * 2).toBeGreaterThanOrEqual(card.height * 0.6)
    }
  })

  it("keeps the plate of a seat out of every zone of its grid", () => {
    for (const n of SIZES) {
      const spots = seatSpots(ids(n), "p0")
      const placed = grids(spots, "p0")
      for (const [id, spot] of spots) {
        const plate = plateBox(spot, placed.get(id)!)
        for (let position = 0; position < 12; position++) expect(boxesOverlap(plate, cellZone(placed.get(id)!, position)), `${n} players, ${id}, cell ${position}`).toBe(false)
      }
    }
  })
})

describe("the table", () => {
  it("keeps every plate, grid, pile, card in hand and strip apart from the others, at every table of two to eight, for a player and for a spectator", () => {
    for (const seated of [true, false]) {
      for (const n of SIZES) {
        // the last box is the strip of the middle, which holds the piles and the pads by design
        const boxes = tableBoxes(n, seated).slice(0, -1)
        for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) expect(boxesOverlap(boxes[i]!, boxes[j]!), `${n} players${seated ? "" : ", spectator"}: boxes ${i} and ${j}`).toBe(false)
      }
    }
  })

  it("keeps the strip of the middle clear of every plate and grid", () => {
    for (const n of SIZES) {
      const boxes = tableBoxes(n)
      const strip = boxes.at(-1) as Box
      // the last four are the piles, the card in hand and the strip itself
      const placed = boxes.slice(0, -4)
      for (const [i, box] of placed.entries()) expect(boxesOverlap(strip, box), `${n} players, box ${i}`).toBe(false)
    }
  })

  it("has as many plates and grids as players, and the piles, the hand and the strip", () => {
    for (const n of SIZES) expect(tableBoxes(n)).toHaveLength(2 * n + 4)
  })

  it("is a function of the seat order alone: renaming the players moves nothing", () => {
    const a = grids(seatSpots(["a", "b", "c"], "b"), "b")
    const b = grids(seatSpots(["x", "y", "z"], "y"), "y")
    expect([...a.values()]).toEqual([...b.values()])
  })

  it("puts the viewer's grid in front, bigger than the opponents'", () => {
    for (const n of SIZES) {
      const all = grids(seatSpots(ids(n), "p0"), "p0")
      expect(all.get("p0")!.scale).toBeGreaterThan(all.get("p1")!.scale)
      expect(all.get("p0")!.at).toEqual({ x: 0, z: LAYOUT_SETTINGS.viewerZ })
      expect(gridBox(all.get("p0")!).yaw).toBe(0)
    }
  })

  it("turns an opponent's grid to face its player, and not when `faceSeat` is 0", () => {
    const spots = seatSpots(ids(4), "p0")
    expect(Math.abs(grids(spots, "p0").get("p2")!.yaw)).toBeCloseTo(Math.PI)
    LAYOUT_SETTINGS.faceSeat = 0
    try {
      expect(grids(spots, "p0").get("p2")!.yaw).toBe(0)
    } finally {
      LAYOUT_SETTINGS.faceSeat = 1
    }
  })
})

describe("the middle of the table", () => {
  it("has the draw pile on the left, the discard on the right and the card in hand between them", () => {
    const { deck, held, discard } = pilePlaces()
    expect(deck.x).toBeLessThan(held.x)
    expect(held.x).toBeLessThan(discard.x)
    expect(deck.z).toBe(held.z)
    expect(held.z).toBe(discard.z)
  })

  it("lays the pads under the piles, one gap from them, as wide as the room between the piles' middles and one gap apart", () => {
    const { draw, take, throwAway, deal, prompt } = floorPlan()
    const pile = (CARD.height * LAYOUT_SETTINGS.pileScale) / 2
    const { deck, discard } = pilePlaces()
    expect(draw.z - draw.depth / 2 - (deck.z + pile)).toBeCloseTo(FLOOR.gap)
    expect(take.z).toBe(draw.z)
    // pad to pad, one gap
    expect(take.x - take.width / 2 - (draw.x + draw.width / 2)).toBeCloseTo(FLOOR.gap)
    expect(draw.x).toBe(deck.x)
    expect(take.x).toBe(discard.x)
    // throwing away is where taking is: the two never show at once
    expect(throwAway).toEqual(take)
    // deal is one pad across the room of the two
    expect(deal.x - deal.width / 2).toBeCloseTo(draw.x - draw.width / 2)
    expect(deal.x + deal.width / 2).toBeCloseTo(take.x + take.width / 2)
    // the words lie above the piles, one gap from them
    expect(deck.z - pile - (prompt.z + prompt.depth / 2)).toBeCloseTo(FLOOR.gap)
  })

  it("keeps the pads clear of the piles and of the card in hand", () => {
    const { draw, take, deal } = floorPlan()
    const { deck, held, discard } = pilePlaces()
    const R = LAYOUT_SETTINGS
    const card = (place: { x: number; z: number }, scale: number): Box => ({ x: place.x, z: place.z, halfWidth: (CARD.width * scale) / 2, halfDepth: (CARD.height * scale) / 2, yaw: 0 })
    const pad = (p: { x: number; z: number; width: number; depth: number }): Box => ({ x: p.x, z: p.z, halfWidth: p.width / 2, halfDepth: p.depth / 2, yaw: 0 })
    for (const p of [draw, take, deal]) for (const c of [card(deck, R.pileScale), card(discard, R.pileScale), card(held, R.heldScale)]) expect(boxesOverlap(pad(p), c)).toBe(false)
    expect(boxesOverlap(pad(draw), pad(take))).toBe(false)
  })
})

describe("the words laid on the table", () => {
  it("breaks a sentence at the spaces into lines of at most the length asked, and keeps a long word whole", () => {
    expect(wrapWords("turn two of your cards over", 12)).toEqual(["turn two of", "your cards", "over"])
    expect(wrapWords("Unbelievably long", 5)).toEqual(["Unbelievably", "long"])
    expect(wrapWords("   ", 5)).toEqual([])
  })

  it("shrinks the letters until the lines fit the room, never below the least", () => {
    const small = fitPrompt("Place it in your grid, or discard it", 6.4, 0.9)
    expect(small.lines.length * small.step).toBeLessThanOrEqual(0.9 + 1e-9)
    const long = fitPrompt("A very long sentence in another language that cannot possibly fit on one line of the table at all", 6.4, 0.9)
    expect(long.height).toBeGreaterThanOrEqual(0.22 - 1e-9)
  })

  it("turns a plate back by half a turn when it would be more than a quarter turn from upright", () => {
    expect(uprightYaw(0)).toBeCloseTo(0)
    expect(uprightYaw(Math.PI)).toBeCloseTo(0)
    expect(uprightYaw(-Math.PI / 2)).toBeCloseTo(-Math.PI / 2)
    expect(uprightYaw((3 * Math.PI) / 4)).toBeCloseTo(-Math.PI / 4)
  })
})
