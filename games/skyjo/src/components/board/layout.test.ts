import { cornersOfBox, PILE_LABEL_GAP, PILE_LABEL_HEIGHT, type Place, polygonsOverlap, pointInFrame } from "@pbgo/table"
import { describe, expect, it } from "vitest"
import { CARD, cardSize, cellPlace, cellPose, cellSpot, FLOOR, floorPlan, gridBox, gridSize, LAYOUT_SETTINGS, pilePlaces, pitchOf, plateBox, seatsOf, tableParts, tableQuads } from "./layout"

const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i}`)
const SIZES = [2, 3, 4, 5, 6, 7, 8]

/** A rectangle on the table, whose sides run along x and z, as its corners going round */
const rect = (x: number, z: number, halfWidth: number, halfDepth: number): Place[] => [
  { x: x - halfWidth, z: z - halfDepth },
  { x: x + halfWidth, z: z - halfDepth },
  { x: x + halfWidth, z: z + halfDepth },
  { x: x - halfWidth, z: z + halfDepth },
]

/** The corners of the twelve cards of a seat's grid on the table, turned as its frame is */
function cardsOf(id: string, n: number, seated = true): Place[][] {
  const seat = seatsOf(ids(n), seated ? "p0" : null).get(id)!
  const card = cardSize(seat.scale)
  return Array.from({ length: 12 }, (_, position) => {
    const at = cellPlace(seat, position)
    const along = { x: Math.cos(at.yaw), z: -Math.sin(at.yaw) }
    const down = { x: Math.sin(at.yaw), z: Math.cos(at.yaw) }
    return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => ({ x: at.x + (a! * card.width * along.x + b! * card.height * down.x) / 2, z: at.z + (a! * card.width * along.z + b! * card.height * down.z) / 2 }))
  })
}

describe("the seats", () => {
  it("put the viewer in front, upright, and give every other seat the yaw that turns it to face the middle", () => {
    for (const n of SIZES) {
      const placed = seatsOf(ids(n), "p0")
      const viewer = placed.get("p0")!
      expect(viewer.frame).toEqual({ x: 0, z: LAYOUT_SETTINGS.viewerZ, yaw: 0 })
      for (const [id, seat] of placed) {
        if (id === "p0") continue
        // the top of the frame, its least z, points at the middle of the table
        const top = pointInFrame({ x: seat.frame.x, z: seat.frame.z, yaw: seat.frame.yaw }, { x: 0, z: -1 })
        const toMiddle = Math.hypot(seat.frame.x, seat.frame.z)
        expect((top.x - seat.frame.x) * (-seat.frame.x / toMiddle) + (top.z - seat.frame.z) * (-seat.frame.z / toMiddle), `${n} players, ${id}`).toBeCloseTo(1, 6)
      }
    }
  })

  it("turn the order of play to the viewer's left: the player after the viewer sits on the viewer's left", () => {
    for (const n of SIZES) {
      const placed = seatsOf(ids(n), "p0")
      expect(placed.get("p1")!.frame.x, `${n} players`).toBeLessThan(0)
      if (n > 2) expect(placed.get(`p${n - 1}`)!.frame.x, `${n} players`).toBeGreaterThan(0)
    }
  })

  it("do not depend on who sits first: the viewer is always in front", () => {
    for (const viewer of ["p0", "p2", "p3"]) {
      const seat = seatsOf(ids(4), viewer).get(viewer)!
      expect(seat.frame).toEqual({ x: 0, z: LAYOUT_SETTINGS.viewerZ, yaw: 0 })
    }
  })

  it("seat a spectator on a ring with an empty chair in front: nobody sits in front", () => {
    for (const n of SIZES) {
      for (const seat of seatsOf(ids(n), null).values()) expect(Math.abs(seat.frame.x) > 1e-6 || seat.frame.z < 0, `${n} players`).toBe(true)
    }
  })

  it("grow from a table of two to a table of eight: smaller cards for opponents", () => {
    const scales = SIZES.map((n) => seatsOf(ids(n), "p0").get("p1")!.scale)
    for (let i = 1; i < scales.length; i++) expect(scales[i]!).toBeLessThanOrEqual(scales[i - 1]! + 1e-9)
    expect(scales[0]).toBeCloseTo(LAYOUT_SETTINGS.opponentScale2)
    expect(scales.at(-1)).toBeCloseTo(LAYOUT_SETTINGS.opponentScale8)
  })

  it("are a function of the seat order alone: renaming the players moves nothing", () => {
    const a = seatsOf(["a", "b", "c"], "b")
    const b = seatsOf(["x", "y", "z"], "y")
    expect([...a.values()]).toEqual([...b.values()])
  })

  it("put the viewer's grid in front, bigger than the opponents'", () => {
    for (const n of SIZES) {
      const placed = seatsOf(ids(n), "p0")
      expect(placed.get("p0")!.scale).toBeGreaterThan(placed.get("p1")!.scale)
    }
  })
})

describe("a grid", () => {
  it("is four columns of three: the cell is `column * 3 + row`, columns left to right and the first row toward the middle", () => {
    const first = cellSpot(0, 1)
    const last = cellSpot(11, 1)
    expect(first.x).toBeLessThan(last.x)
    expect(first.z).toBeLessThan(cellSpot(2, 1).z)
    // the grid is centred on the frame of its seat
    expect(first.x).toBeCloseTo(-last.x)
    expect(cellSpot(1, 1).z).toBeCloseTo(0)
    // three rows in a column, four columns in a row
    expect(new Set(Array.from({ length: 12 }, (_, p) => cellSpot(p, 1).x)).size).toBe(4)
    expect(new Set(Array.from({ length: 12 }, (_, p) => cellSpot(p, 1).z)).size).toBe(3)
  })

  it("never overlaps two cards, in a row or in a column, and leaves a gap of at least a twentieth of a card between neighbours", () => {
    const scale = 0.6
    const card = cardSize(scale)
    for (let a = 0; a < 12; a++) {
      for (let b = a + 1; b < 12; b++) {
        const dx = Math.abs(cellSpot(a, scale).x - cellSpot(b, scale).x)
        const dz = Math.abs(cellSpot(a, scale).z - cellSpot(b, scale).z)
        // two cards apart on the one axis or the other, by their own size at least
        expect(dx >= card.width * 1.05 - 1e-9 || dz >= card.height * 1.05 - 1e-9, `${a} and ${b}`).toBe(true)
      }
    }
  })

  it("keeps the cards of every grid of every table apart, whatever their turn", () => {
    for (const n of SIZES) {
      for (const id of ids(n)) {
        const cards = cardsOf(id, n)
        for (let i = 0; i < 12; i++) for (let j = i + 1; j < 12; j++) expect(polygonsOverlap(cards[i]!, cards[j]!), `${n} players, ${id}: ${i} and ${j}`).toBe(false)
      }
    }
  })

  it("has the size its cells say", () => {
    const { width, depth } = gridSize(1)
    const pitch = pitchOf(1)
    expect(width).toBeCloseTo(3 * pitch.x + CARD.width)
    expect(depth).toBeCloseTo(2 * pitch.z + CARD.height)
    // the box of the grid, which the plate stands above, is the cards' own
    const box = gridBox(1)
    expect(box.maxX - box.minX).toBeCloseTo(width)
    expect(box.maxZ - box.minZ).toBeCloseTo(depth)
    expect(box.minX).toBeCloseTo(-box.maxX)
  })

  it("lays a card face up or face down at its cell, a hair higher the lower the row, so that overlapping cards never fight for a pixel", () => {
    const up = cellPose(1, true, 0.5)
    const down = cellPose(1, false, 0.5)
    expect(up.scale).toBe(0.5)
    expect(up.position.y).toBeLessThan(cellPose(2, true, 0.5).position.y)
    expect(up.quaternion.equals(down.quaternion)).toBe(false)
  })

  it("puts the cell of the viewer where it reads in the frame of the grid, and the cell of the seat across where its frame turns it", () => {
    const viewer = seatsOf(ids(2), "p0").get("p0")!
    const spot = cellSpot(0, viewer.scale)
    expect(cellPlace(viewer, 0)).toMatchObject({ x: spot.x, z: viewer.frame.z + spot.z, yaw: 0 })
    // across the table (yaw π), the first column is on the viewer's right and the first row nearer the viewer
    const across = seatsOf(ids(2), "p0").get("p1")!
    const there = cellSpot(0, across.scale)
    expect(cellPlace(across, 0).x).toBeCloseTo(across.frame.x - there.x)
    expect(cellPlace(across, 0).z).toBeCloseTo(across.frame.z - there.z)
  })
})

describe("the table", () => {
  /** The things that lie on the table, each named, for the pairs that must keep apart */
  function things(n: number, seated: boolean): [string, Place[]][] {
    const parts = tableParts(n, seated)
    return [
      ...parts.plates.map((polygon, i): [string, Place[]] => [`plate ${i}`, polygon]),
      ...parts.grids.map((polygon, i): [string, Place[]] => [`grid ${i}`, polygon]),
      ["draw pile", parts.deck],
      ["discard", parts.discard],
      ["card in hand", parts.held],
    ]
  }

  it("keeps every plate, grid, pile and the card in hand apart from the others, at every table of two to eight, for a player and for a spectator", () => {
    const touching: string[] = []
    for (const seated of [true, false]) {
      for (const n of SIZES) {
        const all = things(n, seated)
        for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) if (polygonsOverlap(all[i]![1], all[j]![1])) touching.push(`${n} players${seated ? "" : ", spectator"}: ${all[i]![0]} and ${all[j]![0]}`)
      }
    }
    expect(touching).toEqual([])
  })

  it("keeps the strip of the middle, with its counts and the room over the piles, clear of every plate and grid", () => {
    const touching: string[] = []
    for (const seated of [true, false]) {
      for (const n of SIZES) {
        const { plates, grids, strip } = tableParts(n, seated)
        for (const [i, polygon] of [...plates, ...grids].entries()) if (polygonsOverlap(strip, polygon)) touching.push(`${n} players${seated ? "" : ", spectator"}: ${i < n ? `plate ${i}` : `grid ${i - n}`}`)
      }
    }
    expect(touching).toEqual([])
  })

  it("stands every plate on the middle's side of its grid, centred on the axis of the seat", () => {
    for (const n of SIZES) {
      for (const seat of seatsOf(ids(n), "p0").values()) {
        const plate = plateBox(seat)
        // in the frame of the seat the top, the least z, is toward the middle: the plate is above the grid, clear of it
        expect(plate.maxZ, `${n} players`).toBeLessThanOrEqual(seat.above.minZ)
        expect(plate.minX + plate.maxX, `${n} players`).toBeCloseTo(0, 6)
      }
    }
  })

  it("has as many plates and grids as players, and the piles, the hand and the strip", () => {
    for (const n of SIZES) {
      expect(tableParts(n).plates).toHaveLength(n)
      expect(tableParts(n).grids).toHaveLength(n)
      expect(tableQuads(n)).toHaveLength(2 * n + 4)
    }
  })

  it("lays the corners of a seat's box where its frame turns them", () => {
    const seat = seatsOf(ids(4), "p0").get("p2")!
    const corners = cornersOfBox(seat.above, seat.frame)
    const centre = corners.reduce((sum, c) => ({ x: sum.x + c.x / 4, z: sum.z + c.z / 4 }), { x: 0, z: 0 })
    expect(centre.x).toBeCloseTo(seat.frame.x)
    expect(centre.z).toBeCloseTo(seat.frame.z)
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

  it("keeps a room over the piles, one gap from them, and lays the deal button in it", () => {
    const { deal, above } = floorPlan()
    const pile = (CARD.height * LAYOUT_SETTINGS.pileScale) / 2
    const { deck } = pilePlaces()
    // the room lies above the piles, one gap from them
    expect(deck.z - pile - (above.z + above.depth / 2)).toBeCloseTo(FLOOR.gap)
    // the button is across the two piles, in the room
    expect(deal.x).toBe(0)
    expect(deal.z).toBe(above.z)
    expect(deal.depth).toBeLessThanOrEqual(above.depth)
    expect(deal.width).toBeLessThanOrEqual(above.width)
  })

  it("keeps the deal button clear of the piles and of the card in hand", () => {
    const { deal } = floorPlan()
    const { deck, held, discard } = pilePlaces()
    const R = LAYOUT_SETTINGS
    const pad = rect(deal.x, deal.z, deal.width / 2, deal.depth / 2)
    for (const [place, scale] of [[deck, R.pileScale], [discard, R.pileScale], [held, R.heldScale]] as const) expect(polygonsOverlap(pad, rect(place.x, place.z, (CARD.width * scale) / 2, (CARD.height * scale) / 2))).toBe(false)
  })

  it("holds in the strip the piles, the card in hand, the count under each pile and the room over them", () => {
    const { strip, above } = floorPlan()
    const { deck, held, discard } = pilePlaces()
    const R = LAYOUT_SETTINGS
    const within = (inner: { x: number; z: number; halfWidth: number; halfDepth: number }) =>
      inner.x - inner.halfWidth >= strip.x - strip.width / 2 - 1e-9 &&
      inner.x + inner.halfWidth <= strip.x + strip.width / 2 + 1e-9 &&
      inner.z - inner.halfDepth >= strip.z - strip.depth / 2 - 1e-9 &&
      inner.z + inner.halfDepth <= strip.z + strip.depth / 2 + 1e-9
    for (const [place, scale] of [[deck, R.pileScale], [discard, R.pileScale], [held, R.heldScale]] as const) expect(within({ x: place.x, z: place.z, halfWidth: (CARD.width * scale) / 2, halfDepth: (CARD.height * scale) / 2 })).toBe(true)
    expect(within({ x: above.x, z: above.z, halfWidth: strip.width / 2, halfDepth: above.depth / 2 })).toBe(true)
    // the count of a pile lies under it, in the strip: its middle is the kit's gap under the edge of the pile
    expect(within({ x: deck.x, z: deck.z + (CARD.height * R.pileScale) / 2 + PILE_LABEL_GAP, halfWidth: 0.4, halfDepth: PILE_LABEL_HEIGHT / 2 })).toBe(true)
  })
})
