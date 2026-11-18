import { aspectScale, CORNER_SCREEN, cornersOfBox, cornerFrame, frameBoxOfPoses, inFrame, onTableAt, placeCamera, plateAbove, plateBoxOf, pointInFrame, type Pose, scalePoses, SEAT_SETTINGS } from "@pbgo/table"
import { PerspectiveCamera, Vector3 } from "three"
import { describe, expect, it } from "vitest"
import { CAMERA } from "./camera"
import { BID, bidPose, bidRowPose, CLOCK, HAND_MAX, HAND_ROOM, handBox, handLayout, heldBox, heldFrame, HELD_SHADOW, heldLayout, seats, trickPose } from "./layout"
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

/**
 * The card a pose lays on the table, as the polygon it covers: its four corners, as the pose scales, turns and places it. A card that stands off the table is seen higher up the screen than where it lies, by its height times the tangent of the camera's tilt: with
 * `seen` the polygon is what the camera sees of it, which is what must not run into a plate or into what lies on the table
 */
function cardPolygon(pose: Pose, seen = false): Polygon {
  const slant = seen ? Math.tan((CAMERA.tilt * Math.PI) / 180) : 0
  return [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([sx, sy]) => {
    const corner = new Vector3((sx! * CARD_SIZE.width) / 2, (sy! * CARD_SIZE.height) / 2, 0).multiplyScalar(pose.scale).applyQuaternion(pose.quaternion).add(pose.position)
    return { x: corner.x, z: corner.z - corner.y * slant }
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

/** The corner of the screen where the viewer's hand lies, for a window of this aspect ratio: the frame the kit's `CornerHand` gives, from a camera placed as the table places it */
function cornerOf(aspect: number) {
  const camera = new PerspectiveCamera(CAMERA.fov, aspect, 0.1, 200)
  placeCamera(camera, CAMERA, { distanceScale: aspectScale(aspect) })
  camera.updateProjectionMatrix()
  camera.updateMatrixWorld()
  return cornerFrame(onTableAt(camera, CORNER_SCREEN.left, CORNER_SCREEN.row, HAND_ROOM.height), onTableAt(camera, CORNER_SCREEN.middle, CORNER_SCREEN.row, HAND_ROOM.height), HAND_ROOM)
}

/** The camera as the table puts it for a window of this aspect ratio */
function cameraOf(aspect: number) {
  const camera = new PerspectiveCamera(CAMERA.fov, aspect, 0.1, 200)
  placeCamera(camera, CAMERA, { distanceScale: aspectScale(aspect) })
  camera.updateProjectionMatrix()
  camera.updateMatrixWorld()
  return camera
}

/** The windows the board is seen in, wide and narrow */
const ASPECTS = [1.33, 1.6, 1.78, 2.4]

type Hand = { id: string; cards: Polygon[]; plate: Polygon; frame: { x: number; z: number; yaw: number } }

/** The hands of a table of `count` as the viewer `viewer` sees it (`null`: a spectator, who has no seat) in a window of this aspect ratio: for each player the polygons of their cards as the camera sees them, hands of every size, and the one of their plate, with the frame they are drawn in */
function hands(count: number, viewer: number | null, aspect: number): Hand[] {
  const players = ids(count)
  const me = viewer === null ? null : players[viewer]!
  const ring = seats(players, me)
  return players.map((id) => {
    if (id === me) {
      const corner = cornerOf(aspect)
      const frame = { x: corner.x, z: corner.z, yaw: 0 }
      const cards = Array.from({ length: HAND_MAX }, (_, i) => scalePoses(handLayout(i + 1, -1), corner.scale).map((pose) => cardPolygon(inFrame(frame, pose), true))).flat()
      return { id, cards, plate: cornersOfBox(plateBoxOf(plateAbove(handBox(corner.scale))), frame), frame }
    }
    const seat = ring.get(id)!
    const frame = heldFrame(seat)
    const cards = Array.from({ length: HAND_MAX }, (_, i) => heldLayout(i + 1).map((pose) => cardPolygon(inFrame(frame, pose), true))).flat()
    return { id, cards, plate: cornersOfBox(plateBoxOf(plateAbove(heldBox(seat))), frame), frame }
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
  const half = CLOCK.size / 2
  things.push({
    what: "the clock",
    shape: [
      { x: CLOCK.at.x - half, z: CLOCK.at.z - half },
      { x: CLOCK.at.x + half, z: CLOCK.at.z - half },
      { x: CLOCK.at.x + half, z: CLOCK.at.z + half },
      { x: CLOCK.at.x - half, z: CLOCK.at.z + half },
    ],
  })
  return things
}

/**
 * Every table of two to six players, whoever the viewer is, in every window, and a table seen by a spectator, who sits at none of the seats and has no hand in the corner: up to five players, since the far half of the ring that six spectators share is too crowded for
 * the plate of an outer seat to clear its neighbour's hand (the platform has no spectator: the board only has to draw one without failing)
 */
const TABLES = Array.from({ length: 5 }, (_, i) => i + 2)
  .flatMap((count) => [...Array.from({ length: count }, (_, viewer) => ({ count, viewer })), ...(count <= 5 ? [{ count, viewer: null }] : [])])
  .flatMap((table) => ASPECTS.map((aspect) => ({ ...table, aspect })))

describe("the hands of the table", () => {
  it("face the middle: the top of the frame of an opponent's hand points at it, and the viewer's hand is in the bottom left of the screen", () => {
    for (const count of [2, 3, 4, 5, 6]) {
      const ring = seats(ids(count), "p0")
      for (const [id, seat] of ring) {
        if (id === "p0") continue
        const frame = heldFrame(seat)
        const top = pointInFrame({ ...frame, x: 0, z: 0 }, { x: 0, z: -1 })
        const toMiddle = { x: -frame.x / Math.hypot(frame.x, frame.z), z: -frame.z / Math.hypot(frame.x, frame.z) }
        expect(top.x * toMiddle.x + top.z * toMiddle.z, `${id} of ${count}`).toBeCloseTo(1, 9)
      }
    }
    for (const aspect of ASPECTS) {
      const corner = cornerOf(aspect)
      expect(corner.x).toBeLessThan(0)
      expect(corner.z).toBeGreaterThan(0)
      expect(corner.scale).toBeGreaterThan(0.5)
    }
  })

  it("stay where they are as a player's cards are played: the room holds a hand of every size", () => {
    const seat = seats(ids(4), "p0").get("p1")!
    const room = heldBox(seat)
    for (let n = 1; n <= HAND_MAX; n++) {
      const hand = frameBoxOfPoses(heldLayout(n), CARD_SIZE, heldFrame(seat), { tilt: CAMERA.tilt })!
      expect(hand.minX).toBeGreaterThanOrEqual(room.minX - 1e-9)
      expect(hand.maxX).toBeLessThanOrEqual(room.maxX + 1e-9)
      expect(hand.minZ).toBeGreaterThanOrEqual(room.minZ - 1e-9)
      expect(hand.maxZ).toBeLessThanOrEqual(room.maxZ + 1e-9)
    }
    const hand = handBox(1)
    for (let n = 1; n <= HAND_MAX; n++) {
      const cards = frameBoxOfPoses(handLayout(n, -1), CARD_SIZE, { x: 0, z: 0, yaw: 0 }, { tilt: CAMERA.tilt })!
      expect(cards.minZ).toBeGreaterThanOrEqual(hand.minZ - 1e-9)
      expect(cards.maxZ).toBeLessThanOrEqual(hand.maxZ + 1e-9)
    }
  })

  it("stay inside the picture in every window: the viewer's hand, a hand that stands up and shows larger than the table under it, is whole in the bottom left", () => {
    const corners = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ] as const
    for (const aspect of [0.75, 1, ...ASPECTS]) {
      const camera = cameraOf(aspect)
      const corner = cornerOf(aspect)
      const frame = { x: corner.x, z: corner.z, yaw: 0 }
      for (let n = 1; n <= HAND_MAX; n++) {
        for (const given of scalePoses(handLayout(n, -1), corner.scale)) {
          const pose = inFrame(frame, given)
          for (const [sx, sy] of corners) {
            const shown = new Vector3((sx * CARD_SIZE.width) / 2, (sy * CARD_SIZE.height) / 2, 0).multiplyScalar(pose.scale).applyQuaternion(pose.quaternion).add(pose.position).project(camera)
            expect(shown.x, `a hand of ${n} at ${aspect}`).toBeGreaterThanOrEqual(-1)
            expect(shown.x, `a hand of ${n} at ${aspect}`).toBeLessThan(CORNER_SCREEN.middle + 0.05)
            expect(shown.y, `a hand of ${n} at ${aspect}`).toBeGreaterThanOrEqual(-1)
          }
        }
      }
    }
  })

  it("have the round shadow wide enough for the fan of the most cards", () => {
    const widest = frameBoxOfPoses(heldLayout(HAND_MAX), CARD_SIZE, { x: 0, z: 0, yaw: 0 })!
    expect(HELD_SHADOW.radius).toBeGreaterThan((widest.maxX - widest.minX) / 2 * 0.9)
  })
})

describe("the plates of the table", () => {
  it("stand above the cards of their player, on the side that faces the middle, whoever sits where", () => {
    for (const seat of seats(ids(5), "p0").values()) {
      if (seat.z > 0) continue
      const box = heldBox(seat)
      expect(plateBoxOf(plateAbove(box)).maxZ).toBeLessThanOrEqual(box.minZ - SEAT_SETTINGS.plateGap + 1e-9)
    }
    for (const aspect of ASPECTS) {
      const box = handBox(cornerOf(aspect).scale)
      expect(plateBoxOf(plateAbove(box)).maxZ).toBeLessThanOrEqual(box.minZ - SEAT_SETTINGS.plateGap + 1e-9)
    }
  })

  it("never lie over a card of any player or over one another, in any window", () => {
    for (const { count, viewer, aspect } of TABLES) {
      const all = hands(count, viewer, aspect)
      for (const a of all) {
        for (const b of all) {
          b.cards.forEach((card, i) => expect(polygonsOverlap(a.plate, card), `plate of ${a.id} and card ${i} of ${b.id}, ${count} players, viewer ${viewer}, aspect ${aspect}`).toBe(false))
          if (a.id < b.id) expect(polygonsOverlap(a.plate, b.plate), `plates of ${a.id} and ${b.id}, ${count} players, viewer ${viewer}, aspect ${aspect}`).toBe(false)
        }
      }
    }
  })

  it("never lie over what is played and bid in the middle, nor over the clock", () => {
    for (const { count, viewer, aspect } of TABLES) {
      for (const { id, plate } of hands(count, viewer, aspect)) {
        for (const { what, shape } of middle(count, viewer)) expect(polygonsOverlap(plate, shape), `plate of ${id} and ${what}, ${count} players, viewer ${viewer}, aspect ${aspect}`).toBe(false)
      }
    }
  })

  it("leave the middle clear of every hand too: no card of a hand lies over what is played and bid", () => {
    for (const { count, viewer, aspect } of TABLES) {
      for (const { id, cards } of hands(count, viewer, aspect)) {
        for (const { what, shape } of middle(count, viewer)) cards.forEach((card, i) => expect(polygonsOverlap(card, shape), `card ${i} of ${id} and ${what}, ${count} players, viewer ${viewer}, aspect ${aspect}`).toBe(false))
      }
    }
  })
})
