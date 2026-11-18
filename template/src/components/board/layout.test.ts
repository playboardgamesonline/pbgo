import { boxOfPoses, centreOf, LINE_LEADING, plateAbove, plateBoxOf, type Pose, SEAT_SETTINGS, type TableBox } from "@pbgo/table"
import { Vector3 } from "three"
import { describe, expect, it } from "vitest"
import { CAMERA } from "./camera"
import { BID, bidPose, bidRowPose, cardPoses, cardsBox, CLOCK, HAND_MAX, seats, trickPose, TURN_LINE } from "./layout"
import { CARD_SIZE } from "./textures"

type Rect = { x: number; z: number; yaw: number; width: number; depth: number }

/** The card a pose lays on the table, as a rectangle on it: where its middle is, how it is turned, and how wide and deep it is */
function cardAt(pose: { position: { x: number; z: number } }, yaw: number, scale: number): Rect {
  return { x: pose.position.x, z: pose.position.z, yaw, width: CARD_SIZE.width * scale, depth: CARD_SIZE.height * scale }
}

/** Whether two rectangles on the table overlap, by the axes of their sides: they are apart when a gap shows on any of them */
function overlap(a: Rect, b: Rect): boolean {
  const axes = [a, b].flatMap((rect) => [
    [Math.cos(rect.yaw), -Math.sin(rect.yaw)],
    [Math.sin(rect.yaw), Math.cos(rect.yaw)],
  ])
  const reach = (rect: Rect, [ax, az]: number[]) => {
    const along = [Math.cos(rect.yaw), -Math.sin(rect.yaw)]
    const across = [Math.sin(rect.yaw), Math.cos(rect.yaw)]
    return (rect.width / 2) * Math.abs(along[0]! * ax! + along[1]! * az!) + (rect.depth / 2) * Math.abs(across[0]! * ax! + across[1]! * az!)
  }
  return axes.every((axis) => Math.abs((b.x - a.x) * axis[0]! + (b.z - a.z) * axis[1]!) < reach(a, axis) + reach(b, axis))
}

const ids = (count: number) => Array.from({ length: count }, (_, i) => `p${i}`)

describe("the bid cards of the table", () => {
  it("lie in a row across the middle, the lowest bid on the left and the row centred", () => {
    const row = Array.from({ length: 6 }, (_, k) => bidRowPose(k, 6).position)
    expect(row.map((place) => place.x)).toEqual([...row.map((place) => place.x)].sort((a, b) => a - b))
    expect(row[0]!.x).toBeCloseTo(-row[5]!.x, 6)
    row.forEach((place) => expect(place.z).toBeCloseTo(BID.z, 6))
    expect(row[1]!.x - row[0]!.x).toBeCloseTo(BID.gap, 6)
  })

  it("never touch one another in the row, however many there are", () => {
    for (const count of [1, 2, 6, 11]) {
      const row = Array.from({ length: count }, (_, k) => cardAt(bidRowPose(k, count), 0, BID.scale))
      for (let i = 0; i < count; i++) for (let j = i + 1; j < count; j++) expect(overlap(row[i]!, row[j]!), `${i} and ${j} of ${count}`).toBe(false)
    }
  })

  it("rise toward the viewer when the pointer is over one", () => {
    const rest = bidRowPose(3, 6)
    const raised = bidRowPose(3, 6, true)
    expect(raised.position.y).toBeGreaterThan(rest.position.y)
    expect(raised.position.z).toBeGreaterThan(rest.position.z)
  })

  it("lie face up or face down at the seat, on the line to the middle, turned as the seat is", () => {
    const seat = seats(ids(4), "p0").get("p2")!
    const up = bidPose(seat, true)
    const down = bidPose(seat, false)
    expect(up.position.x).toBeCloseTo(seat.x * BID.toward, 6)
    expect(up.position.z).toBeCloseTo(seat.z * BID.toward, 6)
    // The two lie on the same spot, one turned over
    expect(down.position.equals(up.position)).toBe(true)
    expect(down.quaternion.equals(up.quaternion)).toBe(false)
  })

  it("leave room for one another, for the clock and for the row, at a table of two to six players, whoever the viewer is", () => {
    for (let count = 2; count <= 6; count++) {
      for (let viewer = 0; viewer < count; viewer++) {
        const players = ids(count)
        const ring = seats(players, players[viewer]!)
        const bids = players.map((id) => cardAt(bidPose(ring.get(id)!, true), ring.get(id)!.yaw, BID.scale))
        // The most bids a viewer can make: eleven cards, from none to ten
        const row = Array.from({ length: 11 }, (_, k) => cardAt(bidRowPose(k, 11), 0, BID.scale))
        for (let i = 0; i < bids.length; i++) {
          for (let j = i + 1; j < bids.length; j++) expect(overlap(bids[i]!, bids[j]!), `bids of ${i} and ${j}, ${count} players, viewer ${viewer}`).toBe(false)
          row.forEach((card, k) => expect(overlap(bids[i]!, card), `bid of ${i} and row card ${k}, ${count} players, viewer ${viewer}`).toBe(false))
          // The hourglass takes a disc of about its own width
          const clock: Rect = { x: CLOCK.at.x, z: CLOCK.at.z, yaw: 0, width: CLOCK.size * 0.9, depth: CLOCK.size * 0.9 }
          expect(overlap(bids[i]!, clock), `bid of ${i} and the clock, ${count} players, viewer ${viewer}`).toBe(false)
        }
        row.forEach((card, k) => expect(overlap(card, { x: CLOCK.at.x, z: CLOCK.at.z, yaw: 0, width: CLOCK.size * 0.9, depth: CLOCK.size * 0.9 }), `row card ${k} and the clock`).toBe(false))
      }
    }
  })
})

/** A shape on the table: the corners of a convex polygon */
type Polygon = { x: number; z: number }[]

const boxPolygon = (box: TableBox): Polygon => [
  { x: box.minX, z: box.minZ },
  { x: box.maxX, z: box.minZ },
  { x: box.maxX, z: box.maxZ },
  { x: box.minX, z: box.maxZ },
]

/** The card a pose lays on the table, as the polygon it covers: its four corners, as the pose scales, turns and places it */
function cardPolygon(pose: Pose): Polygon {
  return [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([sx, sy]) => {
    const corner = new Vector3((sx! * CARD_SIZE.width) / 2, (sy! * CARD_SIZE.height) / 2, 0).multiplyScalar(pose.scale).applyQuaternion(pose.quaternion).add(pose.position)
    return { x: corner.x, z: corner.z }
  })
}

/** Whether two convex polygons overlap, by the axes of their sides: they are apart when a gap shows on any of them */
function polygonsOverlap(a: Polygon, b: Polygon): boolean {
  const axes = [a, b].flatMap((polygon) => polygon.map((point, i) => ({ x: polygon[(i + 1) % polygon.length]!.z - point.z, z: point.x - polygon[(i + 1) % polygon.length]!.x })))
  const span = (polygon: Polygon, axis: { x: number; z: number }) => {
    const along = polygon.map((point) => point.x * axis.x + point.z * axis.z)
    return [Math.min(...along), Math.max(...along)] as const
  }
  return axes.every((axis) => {
    const [a0, a1] = span(a, axis)
    const [b0, b1] = span(b, axis)
    return a0 < b1 && b0 < a1
  })
}

/** What lies on the table for each player of a table of `count`, seen by the viewer (`null`: a spectator, who has no seat): the cards, their box, and the box of the plate above them */
function plates(count: number, viewer: number | null) {
  const players = ids(count)
  const me = viewer === null ? null : players[viewer]!
  const ring = seats(players, me)
  return players.map((id) => {
    const cards = cardsBox(ring.get(id)!, id === me)
    // every card of a hand of every size, since the plate must clear them all
    const shapes = Array.from({ length: HAND_MAX }, (_, i) => cardPoses(ring.get(id)!, id === me, i + 1).map(cardPolygon)).flat()
    return { id, cards, shapes, plate: plateBoxOf(plateAbove(cards)) }
  })
}

/** What else lies on the table of `count` while the players bid and play: the bid each player has made, the card each has played to the middle, the row of bid cards the viewer chooses from (at its longest) and the clock */
function middle(count: number, viewer: number | null) {
  const players = ids(count)
  const ring = seats(players, viewer === null ? null : players[viewer]!)
  const things = players.flatMap((id) => [
    { what: `bid of ${id}`, shape: cardPolygon(bidPose(ring.get(id)!, true)) },
    { what: `trick card of ${id}`, shape: cardPolygon(trickPose(ring.get(id)!, 0)) },
  ])
  if (viewer !== null) for (let k = 0; k < 11; k++) things.push({ what: `bid card ${k}`, shape: cardPolygon(bidRowPose(k, 11)) })
  things.push({ what: "the clock", shape: boxPolygon({ minX: CLOCK.at.x - CLOCK.size / 2, maxX: CLOCK.at.x + CLOCK.size / 2, minZ: CLOCK.at.z - CLOCK.size / 2, maxZ: CLOCK.at.z + CLOCK.size / 2 }) })
  return things
}

/** Every table of two to six players, whoever the viewer is, and a table seen by a spectator */
const TABLES = Array.from({ length: 5 }, (_, i) => i + 2).flatMap((count) => [...Array.from({ length: count }, (_, viewer) => ({ count, viewer })), { count, viewer: null }])

describe("the plates of the table", () => {
  it("stand above the cards of their player and centred on them, the viewer's included, whoever sits where", () => {
    for (const { count, viewer } of TABLES) {
      for (const { id, cards, plate } of plates(count, viewer)) {
        expect(plate.maxZ, `${id} of ${count}, viewer ${viewer}`).toBeLessThanOrEqual(cards.minZ - SEAT_SETTINGS.plateGap + 1e-9)
        expect(centreOf(plate).x, `${id} of ${count}, viewer ${viewer}`).toBeCloseTo(centreOf(cards).x, 6)
      }
    }
  })

  it("never lie over a card of any player or over one another", () => {
    for (const { count, viewer } of TABLES) {
      const all = plates(count, viewer)
      for (const a of all) {
        for (const b of all) {
          b.shapes.forEach((card, i) => expect(polygonsOverlap(boxPolygon(a.plate), card), `plate of ${a.id} and card ${i} of ${b.id}, ${count} players, viewer ${viewer}`).toBe(false))
          if (a.id < b.id) expect(polygonsOverlap(boxPolygon(a.plate), boxPolygon(b.plate)), `plates of ${a.id} and ${b.id}, ${count} players, viewer ${viewer}`).toBe(false)
        }
      }
    }
  })

  it("never lie over what is played and bid in the middle, nor over the clock", () => {
    for (const { count, viewer } of TABLES) {
      for (const { id, plate } of plates(count, viewer)) {
        for (const { what, shape } of middle(count, viewer)) expect(polygonsOverlap(boxPolygon(plate), shape), `plate of ${id} and ${what}, ${count} players, viewer ${viewer}`).toBe(false)
      }
    }
  })

  it("stay where they are as a player's cards are played: the room holds a hand of every size", () => {
    const seat = seats(ids(4), "p0").get("p1")!
    for (const [spot, viewer] of [[seat, false], [{ x: 0, z: 4.4, yaw: 0 }, true]] as const) {
      const room = cardsBox(spot, viewer)
      for (let n = 1; n <= HAND_MAX; n++) {
        const hand = boxOfPoses(cardPoses(spot, viewer, n), CARD_SIZE, { tilt: CAMERA.tilt })!
        expect(hand.minX).toBeGreaterThanOrEqual(room.minX - 1e-9)
        expect(hand.maxX).toBeLessThanOrEqual(room.maxX + 1e-9)
        expect(hand.minZ).toBeGreaterThanOrEqual(room.minZ - 1e-9)
        expect(hand.maxZ).toBeLessThanOrEqual(room.maxZ + 1e-9)
      }
    }
  })
})

describe("the turn line of the table", () => {
  // two lines of letters at most, each a little more than its height apart from the next
  const half = TURN_LINE.height * (LINE_LEADING + 0.5)
  const line: TableBox = { minX: TURN_LINE.at.x - TURN_LINE.width / 2, maxX: TURN_LINE.at.x + TURN_LINE.width / 2, minZ: TURN_LINE.at.z - half, maxZ: TURN_LINE.at.z + half }

  it("lies clear of every plate, of every card of every player and of what is played and bid in the middle", () => {
    for (const { count, viewer } of TABLES) {
      for (const { id, shapes, plate } of plates(count, viewer)) {
        expect(polygonsOverlap(boxPolygon(line), boxPolygon(plate)), `plate of ${id}, ${count} players, viewer ${viewer}`).toBe(false)
        shapes.forEach((card, i) => expect(polygonsOverlap(boxPolygon(line), card), `card ${i} of ${id}, ${count} players, viewer ${viewer}`).toBe(false))
      }
      for (const { what, shape } of middle(count, viewer)) expect(polygonsOverlap(boxPolygon(line), shape), `${what}, ${count} players, viewer ${viewer}`).toBe(false)
    }
  })
})
