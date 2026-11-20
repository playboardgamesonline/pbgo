import { aspectScale, cornersOfBox, frameBoxOfPoses, HELD_FAN_SETTINGS, inFrame, outOfFrame, placeCamera, plateAbove, plateBoxOf, plateOf, pointInFrame, type Pose, SEAT_SETTINGS, screenHandLayout, screenViewOf } from "@pbgo/table"
import { PerspectiveCamera, Vector3 } from "three"
import { describe, expect, it } from "vitest"
import { CAMERA } from "./camera"
import { BID, bidPose, bidRowPose, CLOCK, HAND_MAX, HAND_SETTINGS, heldBox, heldFrame, heldFrom, HELD_SHADOW, heldLayout, seatFrame, seats, trickPose } from "./layout"
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

/** A shape on the screen: the corners of a convex polygon, in the picture's own units (-1 to 1 across and up), which is how the viewer sees the table: what must not run into what, the viewer's hand included, is judged there */
type Polygon = { x: number; y: number }[]

/** The windows the board is seen in, wide and narrow: the aspect ratios of the picture */
const ASPECTS = [1.33, 1.6, 1.78, 2.4]

/** The camera as the table puts it for a window of this aspect ratio */
function cameraOf(aspect: number) {
  const camera = new PerspectiveCamera(CAMERA.fov, aspect, 0.1, 200)
  placeCamera(camera, CAMERA, { distanceScale: aspectScale(aspect) })
  camera.updateProjectionMatrix()
  camera.updateMatrixWorld()
  return camera
}

const onScreen = (camera: PerspectiveCamera, point: Vector3): { x: number; y: number } => {
  const shown = point.clone().project(camera)
  return { x: shown.x, y: shown.y }
}

const CORNERS = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
] as const

/** The card a pose lays in the world, as the polygon it covers on the screen: its four corners, as the pose scales, turns and places it, seen through the camera */
function cardOnScreen(camera: PerspectiveCamera, pose: Pose): Polygon {
  return CORNERS.map(([sx, sy]) => onScreen(camera, new Vector3((sx * CARD_SIZE.width) / 2, (sy * CARD_SIZE.height) / 2, 0).multiplyScalar(pose.scale).applyQuaternion(pose.quaternion).add(pose.position)))
}

/** A card of the viewer's hand, whose pose is in the frame of the camera: put in the world, then seen */
function handCardOnScreen(camera: PerspectiveCamera, pose: Pose): Polygon {
  return CORNERS.map(([sx, sy]) => onScreen(camera, camera.localToWorld(new Vector3((sx * CARD_SIZE.width) / 2, (sy * CARD_SIZE.height) / 2, 0).multiplyScalar(pose.scale).applyQuaternion(pose.quaternion).add(pose.position))))
}

/** A rectangle lying on the table, as the polygon it covers on the screen: the plate of a seat, the foot of the hourglass */
function flatOnScreen(camera: PerspectiveCamera, corners: { x: number; z: number }[]): Polygon {
  return corners.map(({ x, z }) => onScreen(camera, new Vector3(x, 0.03, z)))
}

/** Whether two convex polygons overlap, by the axes of their sides: they are apart when a gap shows on any of them */
function polygonsOverlap(a: Polygon, b: Polygon): boolean {
  const axes = [a, b].flatMap((polygon) => polygon.map((point, i) => ({ x: polygon[(i + 1) % polygon.length]!.y - point.y, y: point.x - polygon[(i + 1) % polygon.length]!.x })))
  const span = (polygon: Polygon, axis: { x: number; y: number }) => {
    const along = polygon.map((point) => point.x * axis.x + point.y * axis.y)
    return [Math.min(...along), Math.max(...along)] as const
  }
  return axes.every((axis) => {
    const [a0, a1] = span(a, axis)
    const [b0, b1] = span(b, axis)
    return a0 < b1 && b0 < a1
  })
}

type Hand = { id: string; cards: Polygon[]; plate: Polygon }

/** The hands and the plates of a table of `count` as the viewer `viewer` sees it (`null`: a spectator, who has no seat) in a window of this aspect ratio: for each player the polygons of their cards on the screen, hands of every size, and the one of their plate. The viewer's hand is the screen hand, in the frame of the camera; their plate is at their seat */
function hands(count: number, viewer: number | null, aspect: number): Hand[] {
  const players = ids(count)
  const me = viewer === null ? null : players[viewer]!
  const ring = seats(players, me)
  const camera = cameraOf(aspect)
  const view = screenViewOf({ m00: camera.projectionMatrix.elements[0]!, m11: camera.projectionMatrix.elements[5]! }, HAND_SETTINGS.distance)
  return players.map((id) => {
    const seat = ring.get(id)!
    if (id === me) {
      const cards = Array.from({ length: HAND_MAX }, (_, i) => screenHandLayout(i + 1, view, CARD_SIZE, HAND_SETTINGS).map((pose) => handCardOnScreen(camera, pose))).flat()
      const plate = plateBoxOf(plateOf(seat, true))
      return { id, cards, plate: flatOnScreen(camera, cornersOfBox(plate, { x: 0, z: 0, yaw: 0 })) }
    }
    const frame = heldFrame(seat)
    const cards = Array.from({ length: HAND_MAX }, (_, i) => heldLayout(i + 1, seat).map((pose) => cardOnScreen(camera, inFrame(frame, pose)))).flat()
    return { id, cards, plate: flatOnScreen(camera, cornersOfBox(plateBoxOf(plateAbove(heldBox(seat))), seatFrame(seat))) }
  })
}

/** What else lies on the table of `count` while the players bid and play: the bid each player has made, the card each has played to the middle, the row of bid cards the viewer chooses from (at its longest) and the clock */
function middle(count: number, viewer: number | null, aspect: number) {
  const players = ids(count)
  const ring = seats(players, viewer === null ? null : players[viewer]!)
  const camera = cameraOf(aspect)
  const things = players.flatMap((id) => [
    { what: `bid of ${id}`, shape: cardOnScreen(camera, bidPose(ring.get(id)!, true)) },
    { what: `trick card of ${id}`, shape: cardOnScreen(camera, trickPose(ring.get(id)!, 0)) },
  ])
  if (viewer !== null) for (let k = 0; k < 11; k++) things.push({ what: `bid card ${k}`, shape: cardOnScreen(camera, bidRowPose(k, 11)) })
  const half = CLOCK.size / 2
  things.push({
    what: "the clock",
    shape: flatOnScreen(camera, [
      { x: CLOCK.at.x - half, z: CLOCK.at.z - half },
      { x: CLOCK.at.x + half, z: CLOCK.at.z - half },
      { x: CLOCK.at.x + half, z: CLOCK.at.z + half },
      { x: CLOCK.at.x - half, z: CLOCK.at.z + half },
    ]),
  })
  return things
}

/** Every table the board must hold: two to six players, seated at each place, and a spectator's view up to five, in every window */
const TABLES = ASPECTS.flatMap((aspect) => [
  ...[2, 3, 4, 5, 6].flatMap((count) => Array.from({ length: count }, (_, viewer) => ({ count, viewer: viewer as number | null, aspect }))),
  ...[2, 3, 4, 5].map((count) => ({ count, viewer: null as number | null, aspect })),
])

describe("the hands of the table", () => {
  it("face the viewer, and the seats face the middle: the plate of an opponent is in a frame whose top points at the middle, their hand is turned toward the viewer so that the backs of its cards look their way", () => {
    for (let count = 2; count <= 8; count++) {
      const ring = seats(ids(count), "p0")
      for (const [id, seat] of ring) {
        if (id === "p0") continue
        const plate = seatFrame(seat)
        const top = pointInFrame({ ...plate, x: 0, z: 0 }, { x: 0, z: -1 })
        const toMiddle = { x: -plate.x / Math.hypot(plate.x, plate.z), z: -plate.z / Math.hypot(plate.x, plate.z) }
        expect(top.x * toMiddle.x + top.z * toMiddle.z, `${id} of ${count}`).toBeCloseTo(1, 9)
        // the viewer is toward +z, and above
        for (const pose of heldLayout(5, seat)) {
          const back = new Vector3(0, 0, -1).applyQuaternion(inFrame(heldFrame(seat), pose).quaternion)
          expect(back.z, `a card of ${id} of ${count}`).toBeGreaterThan(0.9)
          expect(back.y, `a card of ${id} of ${count}`).toBeGreaterThan(0)
        }
      }
    }
  })

  it("stand up and keep close: a hand is nearly straight and no wider than its cards and a little more, so that an opponent's cards are told apart and counted", () => {
    const seat = seats(ids(4), "p0").get("p1")!
    for (let n = 1; n <= HAND_MAX; n++) {
      const cards = heldLayout(n, seat)
      for (const pose of cards) {
        const back = new Vector3(0, 0, -1).applyQuaternion(pose.quaternion)
        // How far a card is from straight up: the angle between its back and the table's up is a quarter turn less
        expect(Math.asin(Math.min(1, Math.abs(back.y))), `a hand of ${n}`).toBeLessThan(0.45)
      }
      const left = Math.min(...cards.map((pose) => pose.position.x))
      const right = Math.max(...cards.map((pose) => pose.position.x))
      expect(right - left, `a hand of ${n}`).toBeLessThan((n - 1) * 0.4 + 0.1)
    }
  })

  it("stay where they are as a player's cards are played: the room holds a hand of every size", () => {
    const seat = seats(ids(4), "p0").get("p1")!
    const room = heldBox(seat)
    for (let n = 1; n <= HAND_MAX; n++) {
      const placed = heldLayout(n, seat).map((pose) => outOfFrame(seatFrame(seat), inFrame(heldFrame(seat), pose)))
      const hand = frameBoxOfPoses(placed, CARD_SIZE, seatFrame(seat), { tilt: CAMERA.tilt })!
      expect(hand.minX).toBeGreaterThanOrEqual(room.minX - 1e-9)
      expect(hand.maxX).toBeLessThanOrEqual(room.maxX + 1e-9)
      expect(hand.minZ).toBeGreaterThanOrEqual(room.minZ - 1e-9)
      expect(hand.maxZ).toBeLessThanOrEqual(room.maxZ + 1e-9)
    }
  })

  it("have the viewer's hand whole in the bottom left of the picture in every window, from a portrait one to an ultra-wide one", () => {
    for (const aspect of [0.75, 1, ...ASPECTS]) {
      const camera = cameraOf(aspect)
      const view = screenViewOf({ m00: camera.projectionMatrix.elements[0]!, m11: camera.projectionMatrix.elements[5]! }, HAND_SETTINGS.distance)
      for (let n = 1; n <= HAND_MAX; n++) {
        for (const pose of screenHandLayout(n, view, CARD_SIZE, HAND_SETTINGS)) {
          for (const corner of handCardOnScreen(camera, pose)) {
            // Flush with the left edge (a hair past it, as Courtisans' hand hangs), cut by the bottom edge, and no farther than the room the hand may take
            expect(corner.x, `a hand of ${n} at ${aspect}`).toBeGreaterThanOrEqual(-1.1)
            expect(corner.x, `a hand of ${n} at ${aspect}`).toBeLessThanOrEqual(-1 + HAND_SETTINGS.room * 2 + 0.12)
            expect(corner.y, `a hand of ${n} at ${aspect}`).toBeLessThanOrEqual(-0.2)
          }
        }
      }
    }
  })

  it("have a round shadow that is the size of their fan: no smaller than its footprint and not much larger", () => {
    for (let n = 1; n <= HAND_MAX; n++) {
      const half = ((n - 1) * HELD_FAN_SETTINGS.gap + CARD_SIZE.width * HELD_FAN_SETTINGS.scale) / 2
      expect(HELD_SHADOW.radius(n) / half, `a hand of ${n}`).toBeGreaterThan(0.9)
      expect(HELD_SHADOW.radius(n) / half, `a hand of ${n}`).toBeLessThan(1.75)
    }
  })

  it("send the card that is played from the left end of the hand, as the viewer sees it", () => {
    const ring = seats(ids(5), "p0")
    for (const [id, seat] of ring) {
      if (id === "p0") continue
      const from = heldFrom(seat, 5)
      const xs = heldLayout(5, seat).map((pose) => inFrame(heldFrame(seat), pose).position.x)
      expect(from.position.x, id).toBeCloseTo(Math.min(...xs), 6)
    }
  })
})

describe("the plates of the table", () => {
  it("stand on the side of the cards of their player that faces the middle, whoever sits where", () => {
    for (const seat of seats(ids(5), "p0").values()) {
      if (seat.z > 0) continue
      const box = heldBox(seat)
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
        for (const { what, shape } of middle(count, viewer, aspect)) expect(polygonsOverlap(plate, shape), `plate of ${id} and ${what}, ${count} players, viewer ${viewer}, aspect ${aspect}`).toBe(false)
      }
    }
  })

  it("leave the middle clear of every hand too: no card of a hand lies over what is played and bid", () => {
    for (const { count, viewer, aspect } of TABLES) {
      for (const { id, cards } of hands(count, viewer, aspect)) {
        for (const { what, shape } of middle(count, viewer, aspect)) cards.forEach((card, i) => expect(polygonsOverlap(card, shape), `card ${i} of ${id} and ${what}, ${count} players, viewer ${viewer}, aspect ${aspect}`).toBe(false))
      }
    }
  })
})
