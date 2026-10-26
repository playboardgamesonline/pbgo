import { Euler, Quaternion, Vector3 } from "three"
import { describe, expect, it } from "vitest"
import { fan, grid, inFrame, pile, row, seats } from "./layout"
import { FACE_DOWN, FACE_UP, type Pose, RESTING_HEIGHT, onTable } from "./pose"

const AXES = [new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, 0, 1)]

/** Two orientations are the same when they send every axis to the same place (a quaternion and its negative are one rotation) */
function expectSameRotation(a: Quaternion, b: Quaternion) {
  for (const axis of AXES) expect(axis.clone().applyQuaternion(a).distanceTo(axis.clone().applyQuaternion(b))).toBeCloseTo(0, 10)
}

function expectAt(pose: Pose, x: number, y: number, z: number) {
  expect(pose.position.x).toBeCloseTo(x, 12)
  expect(pose.position.y).toBeCloseTo(y, 12)
  expect(pose.position.z).toBeCloseTo(z, 12)
}

/** Where the card's front looks, and where its top edge points */
const frontOf = (pose: Pose) => new Vector3(0, 0, 1).applyQuaternion(pose.quaternion)
const topOf = (pose: Pose) => new Vector3(0, 1, 0).applyQuaternion(pose.quaternion)

const euler = (x: number, y: number, z: number) => new Quaternion().setFromEuler(new Euler(x, y, z))
const xs = (poses: Pose[]) => poses.map((pose) => pose.position.x)

describe("inFrame", () => {
  it("moves a pose to the spot, whose yaw 0 keeps its orientation, scale and delay", () => {
    const placed = inFrame({ x: 2, z: -3 }, onTable(1, 4, { y: 0.5, scale: 0.8, delay: 0.2 }))
    expectAt(placed, 3, 0.5, 1)
    expectSameRotation(placed.quaternion, FACE_UP)
    expect(placed.scale).toBe(0.8)
    expect(placed.delay).toBe(0.2)
  })

  it("turns the pose about the spot: what is on the right of a spot that looks to the left lies away from the viewer", () => {
    const placed = inFrame({ x: 0, z: 0, yaw: Math.PI / 2 }, onTable(1, 0, { y: 0.5 }))
    expectAt(placed, 0, 0.5, -1)
    expect(frontOf(placed).y).toBeCloseTo(1, 12)
    expect(topOf(placed).x).toBeCloseTo(-1, 12)
    expect(topOf(placed).z).toBeCloseTo(0, 12)
  })

  it("turns first, then moves: a half turn sends the pose to the other side of the spot", () => {
    expectAt(inFrame({ x: 0, z: 0, yaw: Math.PI }, onTable(1, 2)), -1, RESTING_HEIGHT, -2)
    expectAt(inFrame({ x: 1, z: 2, yaw: Math.PI }, onTable(1, 2)), 0, RESTING_HEIGHT, 0)
  })

  it("adds the yaw of the spot to the yaw of the pose, whichever face is up", () => {
    expectSameRotation(inFrame({ x: 0, z: 0, yaw: 0.7 }, onTable(0, 0, { yaw: 0.2 })).quaternion, onTable(0, 0, { yaw: 0.9 }).quaternion)
    expectSameRotation(inFrame({ x: 5, z: 5, yaw: 0.7 }, onTable(0, 0, { face: "down" })).quaternion, onTable(0, 0, { face: "down", yaw: 0.7 }).quaternion)
  })

  it("hands back a new pose and touches neither the pose nor the spot", () => {
    const pose = onTable(1, 2)
    const spot = { x: 1, z: 1, yaw: 0.3 }
    const placed = inFrame(spot, pose)
    placed.position.x = 99
    placed.quaternion.set(0, 1, 0, 0)
    expectAt(pose, 1, RESTING_HEIGHT, 2)
    expectSameRotation(pose.quaternion, FACE_UP)
    expect(spot).toEqual({ x: 1, z: 1, yaw: 0.3 })
    expect("delay" in inFrame(spot, pose)).toBe(false)
  })
})

describe("fan", () => {
  // The hand of the template: the numbers its first version drew
  const hand = { gap: 1.05, y: 1.1, rise: 0.004, z: 6.1, curve: 0.06, tilt: 0.62, roll: 0.05, scale: 1.2 }

  it("makes one pose per card", () => {
    expect(fan(0, hand)).toHaveLength(0)
    expect(fan(1, hand)).toHaveLength(1)
    expect(fan(7, hand)).toHaveLength(7)
  })

  it("centres the cards on x = 0, the first on the left, whatever their number", () => {
    expect(xs(fan(4, { gap: 2 }))).toEqual([-3, -1, 1, 3])
    expect(xs(fan(3, { gap: 1 }))).toEqual([-1, 0, 1])
    for (const n of [1, 2, 5, 8]) {
      const x = xs(fan(n, { gap: 0.7 }))
      expect(x.reduce((sum, v) => sum + v, 0)).toBeCloseTo(0, 12)
      expect(x).toEqual([...x].sort((a, b) => a - b))
    }
  })

  it("is symmetric about the middle: the ends at the same distance and depth, rolled opposite ways", () => {
    const cards = fan(6, hand)
    for (let i = 0; i < 3; i++) {
      const [left, right] = [cards[i], cards[5 - i]]
      expect(left.position.x).toBeCloseTo(-right.position.x, 12)
      expect(left.position.z).toBeCloseTo(right.position.z, 12)
      expect(topOf(left).x).toBeCloseTo(-topOf(right).x, 12)
      expect(topOf(left).y).toBeCloseTo(topOf(right).y, 12)
      expect(topOf(left).z).toBeCloseTo(topOf(right).z, 12)
    }
  })

  it("rises by a step per card, so overlapping cards never fight for the same pixels", () => {
    const y = fan(5, hand).map((card) => card.position.y)
    y.forEach((height, i) => expect(height).toBeCloseTo(1.1 + i * 0.004, 12))
    expect(y).toEqual([...y].sort((a, b) => a - b))
  })

  it("swings the ends toward the viewer by the curve, the middle card staying put", () => {
    const cards = fan(5, hand)
    expect(cards[2].position.z).toBeCloseTo(6.1, 12)
    expect(cards[1].position.z).toBeCloseTo(6.1 + 0.06, 12)
    expect(cards[0].position.z).toBeCloseTo(6.1 + 0.12, 12)
  })

  it("lies flat face up with no tilt and no roll", () => {
    for (const card of fan(3, { gap: 1 })) {
      expectSameRotation(card.quaternion, FACE_UP)
      expect(card.scale).toBe(1)
    }
  })

  it("leans every card toward the viewer by the tilt", () => {
    const [card] = fan(1, { gap: 1, tilt: 0.62 })
    expect(frontOf(card).x).toBeCloseTo(0, 12)
    expect(frontOf(card).y).toBeCloseTo(Math.cos(0.62), 12)
    expect(frontOf(card).z).toBeCloseTo(Math.sin(0.62), 12)
  })

  it("opens the fan toward the far side: the right-hand cards turn clockwise seen from above", () => {
    const cards = fan(3, { gap: 1, roll: 0.1 })
    expect(topOf(cards[0]).x).toBeLessThan(0)
    expect(topOf(cards[1]).x).toBeCloseTo(0, 12)
    expect(topOf(cards[2]).x).toBeGreaterThan(0)
    expect(topOf(cards[2]).x).toBeCloseTo(Math.sin(0.1), 12)
  })

  it("turns the cards the same way about the vertical axis whichever face is up", () => {
    const up = fan(5, { gap: 1, roll: 0.1, face: "up" })
    const down = fan(5, { gap: 1, roll: 0.1, face: "down" })
    up.forEach((card, i) => {
      expectSameRotation(card.quaternion.clone().multiply(FACE_UP.clone().invert()), down[i].quaternion.clone().multiply(FACE_DOWN.clone().invert()))
      expect(frontOf(down[i]).y).toBeCloseTo(-1, 12)
    })
  })

  it("draws the hand the template used to: same positions, same orientations, same scale", () => {
    const n = 5
    fan(n, hand).forEach((card, i) => {
      const off = i - (n - 1) / 2
      expectAt(card, off * 1.05, 1.1 + i * 0.004, 6.1 + Math.abs(off) * 0.06)
      expectSameRotation(card.quaternion, euler(-Math.PI / 2 + 0.62, 0, -off * 0.05))
      expect(card.scale).toBe(1.2)
    })
  })

  it("keeps every card at or above the resting height unless told otherwise", () => {
    for (const card of fan(9, { gap: 1 })) expect(card.position.y).toBeGreaterThanOrEqual(RESTING_HEIGHT)
  })
})

describe("row", () => {
  it("makes one pose per card, centred on x = 0 with the first on the left", () => {
    expect(row(0, { gap: 1 })).toHaveLength(0)
    expect(xs(row(3, { gap: 0.32 }))).toEqual([-0.32, 0, 0.32])
    expect(xs(row(4, { gap: 2 }))).toEqual([-3, -1, 1, 3])
    expect(xs(row(1, { gap: 5 }))).toEqual([0])
  })

  it("lays the cards face up at the resting height by default", () => {
    for (const card of row(4, { gap: 1 })) {
      expectAt(card, card.position.x, RESTING_HEIGHT, 0)
      expectSameRotation(card.quaternion, FACE_UP)
      expect(card.scale).toBe(1)
    }
  })

  it("is symmetric about the middle", () => {
    const x = xs(row(7, { gap: 0.9 }))
    x.forEach((value, i) => expect(value).toBeCloseTo(-x[6 - i], 12))
  })

  it("rises by a step per card", () => {
    row(4, { gap: 1, y: 0.02, rise: 0.004 }).forEach((card, i) => expect(card.position.y).toBeCloseTo(0.02 + i * 0.004, 12))
  })

  it("puts the row at z, turns every card about the vertical axis and takes face and scale", () => {
    const cards = row(2, { gap: 1, z: 3, face: "down", turn: 0.5, scale: 0.62 })
    for (const card of cards) {
      expect(card.position.z).toBe(3)
      expectSameRotation(card.quaternion, onTable(0, 0, { face: "down", yaw: 0.5 }).quaternion)
      expect(card.scale).toBe(0.62)
    }
  })

  it("draws the backs of an opponent the way the template used to, once put at their seat", () => {
    // Seen from the viewer's seat, the cards of the left-hand opponent: n = 4, 0.32 apart, turned as the template turned them
    const seat = { x: -6.95, z: -1.51, yaw: 1.357 }
    const frame = { x: seat.x * 1.08, z: seat.z * 1.08, yaw: seat.yaw }
    row(4, { gap: 0.32, y: 0.02, rise: 0.004, face: "down", turn: -(2 * seat.yaw + Math.PI), scale: 0.62 }).forEach((slot, i) => {
      const placed = inFrame(frame, slot)
      const offset = (i - 1.5) * 0.32
      expectAt(placed, seat.x * 1.08 + Math.cos(seat.yaw) * offset, 0.02 + i * 0.004, seat.z * 1.08 - Math.sin(seat.yaw) * offset)
      expectSameRotation(placed.quaternion, euler(Math.PI / 2, 0, seat.yaw + Math.PI))
      expect(placed.scale).toBe(0.62)
    })
  })
})

describe("pile", () => {
  it("makes one pose per card, all on the same spot, the bottom card first", () => {
    expect(pile(0)).toHaveLength(0)
    const cards = pile(5)
    expect(cards).toHaveLength(5)
    for (const card of cards) {
      expect(card.position.x).toBe(0)
      expect(card.position.z).toBe(0)
    }
  })

  it("builds up from the resting height by a thin step, in a stable order", () => {
    const y = pile(6).map((card) => card.position.y)
    y.forEach((height, i) => expect(height).toBeCloseTo(RESTING_HEIGHT + i * 0.02, 12))
    expect(y).toEqual([...y].sort((a, b) => a - b))
  })

  it("starts at the height and climbs by the step it is given", () => {
    pile(3, { y: 0.5, step: 0.1 }).forEach((card, i) => expect(card.position.y).toBeCloseTo(0.5 + i * 0.1, 12))
  })

  it("lies face down by default", () => {
    for (const card of pile(4)) expectSameRotation(card.quaternion, FACE_DOWN)
  })

  it("shows another face on the top card alone, or the same for all", () => {
    const cards = pile(4, { topFace: "up" })
    cards.slice(0, 3).forEach((card) => expectSameRotation(card.quaternion, FACE_DOWN))
    expectSameRotation(cards[3].quaternion, FACE_UP)
    for (const card of pile(3, { face: "up" })) expectSameRotation(card.quaternion, FACE_UP)
    expectSameRotation(pile(3, { face: "up", topFace: "down" })[2].quaternion, FACE_DOWN)
  })

  it("leans every card a hair by its own number when it has a key, and the same way every time", () => {
    const cards = pile(5, { lean: "deck", leanAmplitude: 0.05 })
    cards.forEach((card, i) => expectSameRotation(card.quaternion, onTable(0, 0, { face: "down", lean: `deck:${i}`, leanAmplitude: 0.05 }).quaternion))
    pile(5, { lean: "deck", leanAmplitude: 0.05 }).forEach((card, i) => expect(card.quaternion.equals(cards[i].quaternion)).toBe(true))
    expect(cards[0].quaternion.equals(cards[1].quaternion)).toBe(false)
    for (const card of pile(5)) expectSameRotation(card.quaternion, FACE_DOWN)
  })

  it("takes the scale", () => {
    for (const card of pile(3, { scale: 0.9 })) expect(card.scale).toBe(0.9)
  })
})

describe("grid", () => {
  const options = { columns: 3, gapX: 1.5, gapZ: 2.5 }

  it("makes one pose per card", () => {
    expect(grid(0, options)).toHaveLength(0)
    expect(grid(7, options)).toHaveLength(7)
  })

  it("reads like a page: line by line from the far side, from the left, a last line that is not full staying on the left", () => {
    const cells = grid(7, options).map((card) => [card.position.x, card.position.z])
    expect(cells).toEqual([
      [-1.5, -2.5],
      [0, -2.5],
      [1.5, -2.5],
      [-1.5, 0],
      [0, 0],
      [1.5, 0],
      [-1.5, 2.5],
    ])
  })

  it("centres a full grid on the origin, whether the number of lines and columns is even or odd", () => {
    for (const [n, columns] of [[4, 2], [6, 3], [9, 3], [8, 4], [12, 4]]) {
      const cards = grid(n, { columns, gapX: 1, gapZ: 1 })
      expect(cards.reduce((sum, card) => sum + card.position.x, 0)).toBeCloseTo(0, 12)
      expect(cards.reduce((sum, card) => sum + card.position.z, 0)).toBeCloseTo(0, 12)
    }
  })

  it("lays a single column down the middle", () => {
    const cards = grid(3, { columns: 1, gapX: 1, gapZ: 2 })
    expect(xs(cards)).toEqual([0, 0, 0])
    expect(cards.map((card) => card.position.z)).toEqual([-2, 0, 2])
  })

  it("keeps the cells where they are while the cards come, once the number of lines is fixed", () => {
    const fixed = { ...options, rows: 2 }
    const few = grid(4, fixed)
    const more = grid(6, fixed)
    few.forEach((card, i) => expectAt(card, more[i].position.x, more[i].position.y, more[i].position.z))
    // Without it the grid grows from its middle: the first line moves when a second one is needed
    expect(grid(2, options)[0].position.z).toBeCloseTo(0, 12)
    expect(grid(2, { ...options, rows: 2 })[0].position.z).toBeCloseTo(-1.25, 12)
  })

  it("lays the cards face up at the resting height by default, and takes height, face, turn and scale", () => {
    for (const card of grid(4, options)) {
      expect(card.position.y).toBe(RESTING_HEIGHT)
      expectSameRotation(card.quaternion, FACE_UP)
      expect(card.scale).toBe(1)
    }
    for (const card of grid(4, { ...options, y: 0.2, face: "down", turn: 0.4, scale: 0.5 })) {
      expect(card.position.y).toBe(0.2)
      expectSameRotation(card.quaternion, onTable(0, 0, { face: "down", yaw: 0.4 }).quaternion)
      expect(card.scale).toBe(0.5)
    }
  })
})

describe("seats", () => {
  const ring = { radiusX: 7.4, radiusZ: 4.4 }

  it("makes one seat per player, indexed like the players", () => {
    expect(seats(0, ring)).toHaveLength(0)
    expect(seats(1, ring)).toHaveLength(1)
    expect(seats(6, ring)).toHaveLength(6)
  })

  it("puts the viewer in front, upright", () => {
    expect(seats(4, { ...ring, me: 2 })[2]).toEqual({ x: 0, z: 4.4, yaw: 0 })
    expect(seats(1, { ...ring, me: 0 })).toEqual([{ x: 0, z: 4.4, yaw: 0 }])
  })

  it("puts everybody else on the far half of the table", () => {
    for (const count of [2, 3, 4, 6]) {
      seats(count, { ...ring, me: 1 % count }).forEach((seat, i) => {
        if (i === 1 % count) expect(seat.z).toBeGreaterThan(0)
        else expect(seat.z).toBeLessThan(0)
      })
    }
  })

  it("passes the turn to the left of the viewer: the next player sits at the viewer's left, the one before at the right", () => {
    const four = seats(4, { ...ring, me: 0 })
    expect(four[1].x).toBeLessThan(four[2].x)
    expect(four[2].x).toBeLessThan(four[3].x)
    // Counting from the viewer wherever they sit among the players
    const around = seats(4, { ...ring, me: 2 })
    expect([3, 0, 1].map((i) => around[i].x)).toEqual([...[3, 0, 1].map((i) => around[i].x)].sort((a, b) => a - b))
  })

  it("seats a single opponent at the far middle", () => {
    const [, seat] = seats(2, { ...ring, me: 0 })
    expect(seat.x).toBeCloseTo(0, 12)
    expect(seat.z).toBeCloseTo(-4.4, 12)
    expect(Math.cos(seat.yaw)).toBeCloseTo(1, 12)
    expect(Math.sin(seat.yaw)).toBeCloseTo(0, 12)
  })

  it("is symmetric about the middle of the table: the opponents mirror each other, yaws adding up to a full turn", () => {
    for (const count of [3, 4, 5, 6]) {
      const seating = seats(count, { ...ring, me: 0 }).slice(1)
      seating.forEach((seat, k) => {
        const mirror = seating[seating.length - 1 - k]
        expect(seat.x).toBeCloseTo(-mirror.x, 12)
        expect(seat.z).toBeCloseTo(mirror.z, 12)
        expect(Math.cos(seat.yaw + mirror.yaw)).toBeCloseTo(1, 12)
        expect(Math.sin(seat.yaw + mirror.yaw)).toBeCloseTo(0, 12)
      })
    }
  })

  it("sends the top edge of a face-up card away from the middle of the table, but for the viewer's own cards", () => {
    // A seat at the far left (no margin): the top edge points further left
    const [, left] = seats(3, { ...ring, me: 0, margin: 0 })
    expect(left.x).toBeCloseTo(-7.4, 12)
    expect(topOf(inFrame(left, onTable(0, 0))).x).toBeCloseTo(-1, 12)
    const [, far] = seats(2, { ...ring, me: 0 })
    expect(topOf(inFrame(far, onTable(0, 0))).z).toBeCloseTo(-1, 12)
    // The viewer's own cards read upright: their top edge points to the middle of the table
    expect(topOf(inFrame(seats(2, { ...ring, me: 0 })[0], onTable(0, 0))).z).toBeCloseTo(-1, 12)
  })

  it("keeps the margin free at each end of the far half", () => {
    const [, first, last] = seats(3, { ...ring, me: 0, margin: 0 })
    expect(first.x).toBeCloseTo(-7.4, 12)
    expect(last.x).toBeCloseTo(7.4, 12)
    const [, left, right] = seats(3, { ...ring, me: 0 })
    expect(left.x).toBeCloseTo(-Math.cos(0.35) * 7.4, 12)
    expect(right.x).toBeCloseTo(Math.cos(0.35) * 7.4, 12)
  })

  it("seats everybody on the far half, in order, when there is no viewer", () => {
    const all = seats(3, ring)
    expect(all.every((seat) => seat.z < 0)).toBe(true)
    expect(all[0].x).toBeLessThan(all[1].x)
    expect(all[1].x).toBeLessThan(all[2].x)
    expect(seats(3, { ...ring, me: null })).toEqual(all)
  })

  it("takes a viewer that is not a seat for no viewer: the -1 of an indexOf, an index past the players", () => {
    const all = seats(3, ring)
    expect(seats(3, { ...ring, me: -1 })).toEqual(all)
    expect(seats(3, { ...ring, me: 3 })).toEqual(all)
  })

  it("draws the ring the template used to: its radii, its margin and its yaws", () => {
    const three = seats(3, { ...ring, me: 0 })
    expect(three[0]).toEqual({ x: 0, z: 4.4, yaw: 0 })
    expect(three[1].x).toBeCloseTo(-6.951358075070604, 12)
    expect(three[1].z).toBeCloseTo(-1.508750352803986, 12)
    expect(three[1].yaw).toBeCloseTo(1.3570673276448366, 12)
    expect(three[2].x).toBeCloseTo(6.951358075070605, 12)
    expect(three[2].z).toBeCloseTo(-1.5087503528039856, 12)
    expect(three[2].yaw).toBeCloseTo(4.92611797953475, 12)
    const four = seats(4, { ...ring, me: 0 })
    expect(four[2].x).toBeCloseTo(0, 12)
    expect(four[2].z).toBeCloseTo(-4.4, 12)
    expect(Math.cos(four[2].yaw)).toBeCloseTo(1, 12)
  })
})
