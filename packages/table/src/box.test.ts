import { describe, expect, it } from "vitest"
import { boxesOverlap, boxOfPoses, boxOfRect, centreOf, cornersOfBox, frameBoxOfPoses, joinBoxes, pointInFrame, type TableBox } from "./box"
import { fan, inFrame, row } from "./layout"
import { onTable } from "./pose"

const SIZE = { width: 1.2, height: 1.8 }

describe("boxOfRect", () => {
  it("is the rectangle itself when it is not turned", () => {
    expect(boxOfRect({ x: 2, z: -3, width: 6, depth: 2 })).toEqual({ minX: -1, maxX: 5, minZ: -4, maxZ: -2 })
  })

  it("swaps its width and its depth for a quarter turn, either way", () => {
    for (const yaw of [Math.PI / 2, -Math.PI / 2, (3 * Math.PI) / 2]) {
      const box = boxOfRect({ x: 0, z: 0, width: 6, depth: 2, yaw })
      expect(box.maxX - box.minX).toBeCloseTo(2)
      expect(box.maxZ - box.minZ).toBeCloseTo(6)
    }
  })

  it("is as it was for a half turn, and wider for an eighth of one", () => {
    const half = boxOfRect({ x: 1, z: 1, width: 6, depth: 2, yaw: Math.PI })
    expect(half.maxX - half.minX).toBeCloseTo(6)
    const eighth = boxOfRect({ x: 0, z: 0, width: 6, depth: 2, yaw: Math.PI / 4 })
    expect(eighth.maxX - eighth.minX).toBeCloseTo((6 + 2) * Math.SQRT1_2)
    expect(centreOf(eighth)).toEqual({ x: 0, z: 0 })
  })
})

describe("joinBoxes", () => {
  it("holds every box, and skips a player who has no cards", () => {
    const a: TableBox = { minX: 0, maxX: 1, minZ: 0, maxZ: 1 }
    const b: TableBox = { minX: 3, maxX: 4, minZ: -2, maxZ: -1 }
    expect(joinBoxes([a, null, b])).toEqual({ minX: 0, maxX: 4, minZ: -2, maxZ: 1 })
    expect(joinBoxes([null])).toBeNull()
    expect(joinBoxes([])).toBeNull()
  })
})

describe("boxOfPoses", () => {
  it("is the footprint of a card lying face up: its top edge points to -z", () => {
    const box = boxOfPoses([onTable(2, 3)], SIZE)!
    expect(box.minX).toBeCloseTo(2 - 0.6)
    expect(box.maxX).toBeCloseTo(2 + 0.6)
    expect(box.minZ).toBeCloseTo(3 - 0.9)
    expect(box.maxZ).toBeCloseTo(3 + 0.9)
  })

  it("scales a card by its pose, and turns it by its yaw", () => {
    const small = boxOfPoses([onTable(0, 0, { scale: 0.5 })], SIZE)!
    expect(small.maxX - small.minX).toBeCloseTo(0.6)
    const sideways = boxOfPoses([onTable(0, 0, { yaw: Math.PI / 2 })], SIZE)!
    expect(sideways.maxX - sideways.minX).toBeCloseTo(1.8)
    expect(sideways.maxZ - sideways.minZ).toBeCloseTo(1.2)
  })

  it("holds a whole row, and takes the same box face down", () => {
    const up = boxOfPoses(row(5, { gap: 1.4 }), SIZE)!
    const down = boxOfPoses(row(5, { gap: 1.4, face: "down" }), SIZE)!
    expect(up.maxX - up.minX).toBeCloseTo(4 * 1.4 + 1.2)
    expect(up.maxZ - up.minZ).toBeCloseTo(1.8)
    expect(down.minX).toBeCloseTo(up.minX)
    expect(down.maxZ).toBeCloseTo(up.maxZ)
  })

  it("is the covered part of the table for a card that stands up toward the viewer", () => {
    // a fan whose cards lean over by 0.6 rad covers less depth than a card lying flat
    const flat = boxOfPoses(fan(1, { gap: 1 }), SIZE)!
    const leaning = boxOfPoses(fan(1, { gap: 1, tilt: 0.6 }), SIZE)!
    expect(leaning.maxZ - leaning.minZ).toBeLessThan(flat.maxZ - flat.minZ)
    expect(leaning.maxZ - leaning.minZ).toBeCloseTo(1.8 * Math.cos(0.6))
  })

  it("is what the camera sees of a card that stands off the table, which hides the table behind it", () => {
    // a hand that leans toward its player, raised: its top edge is high, so it covers the table farther from the viewer than where it lies
    const hand = fan(3, { gap: 1.2, y: 1.1, z: 6, tilt: 0.6 })
    const lying = boxOfPoses(hand, SIZE)!
    const seen = boxOfPoses(hand, SIZE, { tilt: 42 })!
    expect(seen.minZ).toBeLessThan(lying.minZ)
    expect(seen.minX).toBeCloseTo(lying.minX)
    expect(seen.maxX).toBeCloseTo(lying.maxX)
    // the top corners are at y = 1.1 + 0.9 * sin(0.6), which the view carries back by that times the tangent of the tilt
    expect(lying.minZ - seen.minZ).toBeCloseTo((1.1 + 0.9 * Math.sin(0.6)) * Math.tan((42 * Math.PI) / 180), 1)
  })

  it("is the same for a card that lies flat on the table, but for the hair of its height", () => {
    const flat = boxOfPoses(row(4, { gap: 1.4 }), SIZE)!
    const seen = boxOfPoses(row(4, { gap: 1.4 }), SIZE, { tilt: 42 })!
    expect(seen.minZ).toBeCloseTo(flat.minZ, 1)
    expect(seen.maxZ).toBeCloseTo(flat.maxZ, 1)
  })

  it("takes the frame a layout is drawn in, as a zone does", () => {
    const framed = boxOfPoses(row(3, { gap: 2 }), SIZE, { frame: { x: 4, z: -3, yaw: Math.PI / 2 } })!
    // the row runs along x in its frame: a quarter turn lays it along z, and the cards turn with it
    expect(framed.maxX - framed.minX).toBeCloseTo(1.8)
    expect(framed.maxZ - framed.minZ).toBeCloseTo(4 + 1.2)
    expect(centreOf(framed).x).toBeCloseTo(4)
    expect(centreOf(framed).z).toBeCloseTo(-3)
  })

  it("has no box for no card", () => {
    expect(boxOfPoses([], SIZE)).toBeNull()
  })
})

describe("boxesOverlap", () => {
  const a: TableBox = { minX: 0, maxX: 2, minZ: 0, maxZ: 2 }
  it("tells boxes that cover the same part of the table", () => {
    expect(boxesOverlap(a, { minX: 1, maxX: 3, minZ: 1, maxZ: 3 })).toBe(true)
    expect(boxesOverlap(a, { minX: 3, maxX: 4, minZ: 0, maxZ: 2 })).toBe(false)
  })

  it("lets two boxes that only touch be, and counts them for a clear space asked", () => {
    const touching: TableBox = { minX: 2, maxX: 4, minZ: 0, maxZ: 2 }
    expect(boxesOverlap(a, touching)).toBe(false)
    expect(boxesOverlap(a, touching, 0.1)).toBe(true)
    expect(boxesOverlap(a, { minX: 2.2, maxX: 4, minZ: 0, maxZ: 2 }, 0.1)).toBe(false)
  })
})

describe("pointInFrame", () => {
  it("turns a point first, then moves it, as inFrame does for a pose", () => {
    const placed = pointInFrame({ x: 4, z: -3, yaw: Math.PI / 2 }, { x: 2, z: 0 })
    expect(placed.x).toBeCloseTo(4)
    expect(placed.z).toBeCloseTo(-5)
    const half = pointInFrame({ x: 0, z: 0, yaw: Math.PI }, { x: 1, z: 2 })
    expect(half.x).toBeCloseTo(-1)
    expect(half.z).toBeCloseTo(-2)
    expect(pointInFrame({ x: 1, z: 1 }, { x: 2, z: 3 })).toEqual({ x: 3, z: 4 })
  })

  it("lands where inFrame puts a card laid there", () => {
    const frame = { x: 5, z: 2, yaw: 0.7 }
    const place = inFrame(frame, onTable(1.5, -2))
    const point = pointInFrame(frame, { x: 1.5, z: -2 })
    expect(point.x).toBeCloseTo(place.position.x)
    expect(point.z).toBeCloseTo(place.position.z)
  })
})

describe("frameBoxOfPoses", () => {
  it("is the box of the layout as it is drawn, whatever the frame: the frame only says where it lies", () => {
    for (const yaw of [0, 1, Math.PI, -2]) {
      const box = frameBoxOfPoses(row(3, { gap: 2 }), SIZE, { x: 7, z: -3, yaw })!
      expect(box.maxX - box.minX).toBeCloseTo(4 + 1.2)
      expect(box.maxZ - box.minZ).toBeCloseTo(1.8)
      expect(centreOf(box).x).toBeCloseTo(0)
      expect(centreOf(box).z).toBeCloseTo(0)
    }
  })

  it("lies where the world box of the same cards lies, once its corners are put in the world", () => {
    const frame = { x: 4, z: -3, yaw: 0.9 }
    const local = frameBoxOfPoses(row(4, { gap: 1.5 }), SIZE, frame)!
    const world = boxOfPoses(row(4, { gap: 1.5 }), SIZE, { frame })!
    const corners = cornersOfBox(local, frame)
    // the corners of the cards' box are as far out as the cards' own corners, which the world box holds
    for (const corner of corners) {
      expect(corner.x).toBeGreaterThanOrEqual(world.minX - 1e-9)
      expect(corner.x).toBeLessThanOrEqual(world.maxX + 1e-9)
      expect(corner.z).toBeGreaterThanOrEqual(world.minZ - 1e-9)
      expect(corner.z).toBeLessThanOrEqual(world.maxZ + 1e-9)
    }
  })

  it("moves the part that a card standing off the table hides toward the screen's way up, which the frame turns with the seat", () => {
    const hand = fan(3, { gap: 1.2, y: 1.1, z: 0, tilt: 0.6 })
    const lying = frameBoxOfPoses(hand, SIZE, { x: 0, z: 0, yaw: 0 })!
    const seen = frameBoxOfPoses(hand, SIZE, { x: 0, z: 0, yaw: 0 }, { tilt: 42 })!
    // not turned: the screen's way up is the least z of the frame
    expect(seen.minZ).toBeLessThan(lying.minZ)
    // turned half a turn, the screen's way up is the most z of the frame: the hidden part is on the player's side, away from the middle
    const turned = frameBoxOfPoses(hand, SIZE, { x: 0, z: 0, yaw: Math.PI }, { tilt: 42 })!
    const turnedLying = frameBoxOfPoses(hand, SIZE, { x: 0, z: 0, yaw: Math.PI })!
    expect(turned.maxZ).toBeGreaterThan(turnedLying.maxZ)
    // no corner moves toward the middle of the table: the part hidden is only ever added on the player's side
    expect(turned.minZ).toBeGreaterThanOrEqual(turnedLying.minZ - 1e-9)
    // a quarter turn: the screen's way up is the frame's x
    const sideways = frameBoxOfPoses(hand, SIZE, { x: 0, z: 0, yaw: Math.PI / 2 }, { tilt: 42 })!
    const sidewaysLying = frameBoxOfPoses(hand, SIZE, { x: 0, z: 0, yaw: Math.PI / 2 })!
    expect(sideways.maxX).toBeGreaterThan(sidewaysLying.maxX)
    expect(sideways.minZ).toBeCloseTo(sidewaysLying.minZ)
  })

  it("has no box for no card", () => {
    expect(frameBoxOfPoses([], SIZE, { x: 0, z: 0, yaw: 0 })).toBeNull()
  })
})
