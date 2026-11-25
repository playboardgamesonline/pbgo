import type { PlayerView, VisibleCard } from "@courtisans/engine"
import { aspectScale, cornersOfBox, frameBoxOfPoses, HELD_FAN_SETTINGS, inFrame, placeCamera, plateAbove, plateBoxOf, type Place, polygonsOverlap, SEAT_SETTINGS, type TableBox } from "@pbgo/table"
import { PerspectiveCamera, Vector3 } from "three"
import { describe, expect, it } from "vitest"
import { CAMERA } from "./camera"
import {
  arrangeDomain,
  CARD_SCALE,
  CARD_SIZE,
  columnX,
  deckTopPose,
  DH,
  DL,
  DRAW_PILE,
  domainBox,
  HAND_MAX,
  handBox,
  HELD_SHADOW,
  heldFrame,
  heldFrom,
  heldLayout,
  seatHotspot,
  laneArea,
  MAT_D,
  MAT_W,
  MISSION_H,
  MISSION_PILE,
  missionPilePose,
  missionRestPose,
  MISSION_SCALE,
  MISSION_W,
  BUTTON_PAD,
  type Seat,
  seatBox,
  seats,
  STEP,
  tablePose,
} from "./layout"

const ids = (count: number) => Array.from({ length: count }, (_, i) => `p${i}`)

/** The view of a table of `count` players with nothing played, seen by `viewer` (none: a spectator) */
function viewOf(count: number, viewer: string | null): PlayerView {
  return {
    me: viewer ? { id: viewer, hand: [], missions: [] } : null,
    players: ids(count).map((id) => ({ id, domain: [], handCount: 3, missionsRead: true, missions: null })),
    table: [],
    deckCount: 60,
    activePlayerId: null,
    firstPlayerId: null,
    availableZones: [],
    phase: "playing",
    results: null,
  }
}

/** Every table of two to five players, seated at each place and as a spectator */
function everyTable(): { label: string; count: number; seats: Map<string, Seat> }[] {
  return [2, 3, 4, 5].flatMap((count) =>
    [...ids(count), null].map((viewer) => ({ label: `${count} players, ${viewer ?? "spectator"}`, count, seats: seats(viewOf(count, viewer)) })),
  )
}

/** A box on the table as a polygon in the world: the corners of a rectangle with its middle at (`x`, `z`), turned by `yaw` */
function rectangle(x: number, z: number, width: number, depth: number, yaw = 0): Place[] {
  return cornersOfBox({ minX: -width / 2, maxX: width / 2, minZ: -depth / 2, maxZ: depth / 2 }, { x, z, yaw })
}

const MAT = rectangle(0, 0, MAT_W, MAT_D)
const DRAW = rectangle(DRAW_PILE.x, DRAW_PILE.z, DL, DH)
const MISSIONS = rectangle(MISSION_PILE.x, MISSION_PILE.z, MISSION_W * MISSION_SCALE, MISSION_H * MISSION_SCALE)

/** What a seat covers of the table, each as a polygon in the world */
function shapesOf(seat: Seat) {
  const box = seatBox(seat)
  const plate = plateBoxOf(plateAbove(box, SEAT_SETTINGS), SEAT_SETTINGS)
  const hand = handBox(seat)
  return {
    domain: cornersOfBox(domainBox(seat), seat.frame),
    plate: cornersOfBox(plate, seat.frame),
    hand: hand ? cornersOfBox(hand, seat.frame) : null,
  }
}

describe("the seats", () => {
  it("put the viewer in front and turn every other seat toward the middle of the table, as the player who sits there sees it", () => {
    for (const { label, seats: places } of everyTable()) {
      for (const seat of places.values()) {
        const top = { x: -Math.sin(seat.frame.yaw), z: -Math.cos(seat.frame.yaw) }
        // The top of the frame points from the seat to the middle of the table (the origin) within a quarter turn, and straight at it at the sides and in front
        const toMiddle = { x: -seat.frame.x, z: -seat.frame.z }
        const length = Math.hypot(toMiddle.x, toMiddle.z)
        expect((top.x * toMiddle.x + top.z * toMiddle.z) / length, label).toBeGreaterThan(0.75)
        if (seat.viewer) expect(seat.frame.yaw, label).toBe(0)
      }
    }
  })

  it("give every player a seat of their own, whoever the viewer is", () => {
    for (const { label, count, seats: places } of everyTable()) {
      expect(places.size, label).toBe(count)
      const spots = [...places.values()].map((seat) => `${seat.frame.x.toFixed(2)},${seat.frame.z.toFixed(2)}`)
      expect(new Set(spots).size, label).toBe(count)
    }
  })

  it("keep the turn going to the left of the viewer", () => {
    const places = seats(viewOf(4, "p0"))
    // The player after the viewer is at the left of the picture, the one before them at the right
    expect(places.get("p1")!.frame.x).toBeLessThan(0)
    expect(places.get("p3")!.frame.x).toBeGreaterThan(0)
  })
})

describe("the line of a seat", () => {
  it("stands, from the middle of the table outward, as the plate, the domain and the hand", () => {
    for (const { label, seats: places } of everyTable()) {
      for (const seat of places.values()) {
        const { domain, plate, hand } = shapesOf(seat)
        const frameOf = (shape: Place[]) => shape.map((point) => ({ x: point.x - seat.frame.x, z: point.z - seat.frame.z }))
        // In the frame of the seat: the plate lies on the middle's side of the domain (the least z), the hand beyond it
        const depthOf = (shape: Place[]) => {
          const yaw = seat.frame.yaw
          return frameOf(shape).map((point) => point.x * Math.sin(yaw) + point.z * Math.cos(yaw))
        }
        expect(Math.max(...depthOf(plate)), label).toBeLessThanOrEqual(Math.min(...depthOf(domain)) + 1e-6)
        if (hand) expect(Math.min(...depthOf(hand)), label).toBeGreaterThanOrEqual(Math.max(...depthOf(domain)) - 1e-6)
      }
    }
  })

  it("leaves nothing of a seat on another seat, on the mat or on the piles", () => {
    for (const { label, seats: places } of everyTable()) {
      const shapes = [...places.entries()].map(([id, seat]) => ({ id, ...shapesOf(seat) }))
      for (const a of shapes) {
        for (const [what, shape] of [
          ["the mat", MAT],
          ["the draw pile", DRAW],
          ["the missions", MISSIONS],
        ] as const) {
          expect(polygonsOverlap(a.domain, shape), `${label}: the domain of ${a.id} and ${what}`).toBe(false)
          expect(polygonsOverlap(a.plate, shape), `${label}: the plate of ${a.id} and ${what}`).toBe(false)
          if (a.hand) expect(polygonsOverlap(a.hand, shape), `${label}: the hand of ${a.id} and ${what}`).toBe(false)
        }
        for (const b of shapes) {
          if (a.id >= b.id) continue
          expect(polygonsOverlap(a.domain, b.domain), `${label}: the domains of ${a.id} and ${b.id}`).toBe(false)
          expect(polygonsOverlap(a.plate, b.plate), `${label}: the plates of ${a.id} and ${b.id}`).toBe(false)
          expect(polygonsOverlap(a.plate, b.domain), `${label}: the plate of ${a.id} and the domain of ${b.id}`).toBe(false)
          expect(polygonsOverlap(b.plate, a.domain), `${label}: the plate of ${b.id} and the domain of ${a.id}`).toBe(false)
          if (a.hand) expect(polygonsOverlap(a.hand, b.domain), `${label}: the hand of ${a.id} and the domain of ${b.id}`).toBe(false)
          if (b.hand) expect(polygonsOverlap(b.hand, a.domain), `${label}: the hand of ${b.id} and the domain of ${a.id}`).toBe(false)
        }
      }
    }
  })

  it("keeps the plate clear of the cards of the Queen's table, two deep in every column and on both levels", () => {
    for (const { label, seats: places } of everyTable()) {
      for (const [id, seat] of places) {
        const { plate } = shapesOf(seat)
        for (const column of ["butterfly", "toad", "nightingale", "queen", "hare", "stag", "carp"] as const) {
          for (const level of ["up", "down"] as const) {
            for (let rank = 0; rank < 2; rank++) {
              const pose = tablePose(column, level, rank)
              const card = rectangle(pose.position.x, pose.position.z, DL, DH)
              expect(polygonsOverlap(plate, card), `${label}: the plate of ${id} and ${column} ${level} ${rank}`).toBe(false)
            }
          }
        }
        expect(columnX("queen"), label).toBeCloseTo(0, 6)
      }
    }
  })

  it("holds the room of the biggest hand of an opponent whatever the hand holds, so the plate never moves as cards are played", () => {
    const seat = seats(viewOf(3, "p0")).get("p1")!
    const room = handBox(seat)!
    for (const n of [1, 2, 3]) {
      const now = frameBoxOfPoses(heldLayout(n, seat), CARD_SIZE, seat.frame, { tilt: CAMERA.tilt })!
      // The box of the hand is in the frame of the seat: the hand stands beyond the domain
      const shifted: TableBox = { ...now, minZ: now.minZ + DH / 2 + 0.4, maxZ: now.maxZ + DH / 2 + 0.4 }
      expect(room.minX, `${n} cards`).toBeLessThanOrEqual(shifted.minX + 1e-6)
      expect(room.maxX, `${n} cards`).toBeGreaterThanOrEqual(shifted.maxX - 1e-6)
      expect(room.minZ, `${n} cards`).toBeLessThanOrEqual(shifted.minZ + 1e-6)
      expect(room.maxZ, `${n} cards`).toBeGreaterThanOrEqual(shifted.maxZ - 1e-6)
    }
  })
})

describe("the domain", () => {
  const family = (f: VisibleCard["family"], id: number): VisibleCard => ({ id, family: f, role: null })
  // Four families of three cards: more than every seat holds side by side, so the piles close up to fit its width
  const FULL: VisibleCard[] = (["butterfly", "toad", "nightingale", "hare"] as const).flatMap((f, i) => Array.from({ length: 3 }, (_, k) => family(f, i * 10 + k)))

  it("lies in the frame of its seat, turned as the seat is, and never wider than its seat allows", () => {
    for (const { label, seats: places } of everyTable()) {
      for (const [id, seat] of places) {
        const { poses, zone } = arrangeDomain(seat, FULL)
        expect(poses.size, `${label}: ${id}`).toBe(FULL.length)
        const frame = seat.frame
        for (const pose of poses.values()) {
          // In the frame the cards lie along its x axis, centred on it, and no card strays beyond the width the seat allows
          const at = new Vector3().copy(pose.position)
          const local = { x: (at.x - frame.x) * Math.cos(frame.yaw) - (at.z - frame.z) * Math.sin(frame.yaw), z: (at.x - frame.x) * Math.sin(frame.yaw) + (at.z - frame.z) * Math.cos(frame.yaw) }
          expect(Math.abs(local.z), `${label}: ${id}`).toBeLessThan(1e-6)
          expect(Math.abs(local.x) + DL / 2, `${label}: ${id}`).toBeLessThanOrEqual(seat.maxWidth / 2 + 1e-6)
          // A card lies face up, and its top points to the middle of the table, as the top of the frame does
          expect(new Vector3(0, 0, 1).applyQuaternion(pose.quaternion).y, `${label}: ${id}`).toBeGreaterThan(0.99)
          const top = new Vector3(0, 1, 0).applyQuaternion(pose.quaternion)
          expect(top.x * -Math.sin(frame.yaw) + top.z * -Math.cos(frame.yaw), `${label}: ${id}`).toBeGreaterThan(0.99)
        }
        expect(zone.yaw, `${label}: ${id}`).toBe(frame.yaw)
        expect(zone.labelYaw, `${label}: ${id}`).toBe(frame.yaw)
      }
    }
  })

  it("makes a place for the count of each pile on the side of the domain that is away from the middle of the table", () => {
    const seat = seats(viewOf(3, "p0")).get("p0")!
    const { zone } = arrangeDomain(seat, FULL)
    expect(zone.piles).toHaveLength(4)
    for (const pile of zone.piles) expect(pile.position.z).toBeGreaterThan(seat.frame.z + DH / 2)
  })

  it("keeps the room of the plate, the domain and the hand in the picture, at every window", () => {
    for (const aspect of [1.33, 1.6, 1.78, 2.4]) {
      const camera = new PerspectiveCamera(CAMERA.fov, aspect, 0.1, 200)
      placeCamera(camera, CAMERA, { distanceScale: aspectScale(aspect) })
      camera.updateProjectionMatrix()
      camera.updateMatrixWorld()
      for (const { label, seats: places } of everyTable()) {
        for (const [id, seat] of places) {
          const { domain, plate, hand } = shapesOf(seat)
          for (const [what, shape] of [["domain", domain], ["plate", plate], ...(hand ? [["hand", hand] as const] : [])] as const) {
            for (const point of shape) {
              const shown = new Vector3(point.x, 0, point.z).project(camera)
              expect(Math.abs(shown.x), `${label} at ${aspect}: the ${what} of ${id}`).toBeLessThan(0.99)
              expect(Math.abs(shown.y), `${label} at ${aspect}: the ${what} of ${id}`).toBeLessThan(0.99)
            }
          }
        }
      }
    }
  })
})


describe("the lanes and the button of the Queen's table", () => {
  const COLUMNS = ["butterfly", "toad", "nightingale", "queen", "hare", "stag", "carp"] as const
  const pad = rectangle(BUTTON_PAD.at.x, BUTTON_PAD.at.z, BUTTON_PAD.width, BUTTON_PAD.depth)
  const areaOf = (a: { at: { x: number; z: number; yaw: number }; width: number; depth: number }) => rectangle(a.at.x, a.at.z, a.width, a.depth, a.at.yaw)

  it("are pressed over the cards that lie in them and over no seat, whatever the table", () => {
    for (const { label, seats: places } of everyTable()) {
      for (const [id, seat] of places) {
        const area = areaOf(seatHotspot(seat, seat.maxWidth))
        for (const column of COLUMNS) {
          for (const light of [true, false]) {
            const lane = areaOf(laneArea(column, light, STEP * 0.96))
            expect(polygonsOverlap(lane, area), `${label}: the ${light ? "light" : "disgrace"} lane of ${column} and the area of ${id}`).toBe(false)
            expect(polygonsOverlap(lane, shapesOf(seat).plate), `${label}: the lane of ${column} and the plate of ${id}`).toBe(false)
          }
        }
      }
    }
  })

  it("start at the edge of the mat and run away from it", () => {
    for (const column of COLUMNS) {
      const light = laneArea(column, true, STEP)
      const disgrace = laneArea(column, false, STEP)
      expect(light.at.x).toBeCloseTo(columnX(column), 6)
      // the lane's area starts at the mat's edge: its middle is half its depth beyond it
      expect(light.at.z + light.depth / 2).toBeCloseTo(-MAT_D / 2, 6)
      expect(disgrace.at.z - disgrace.depth / 2).toBeCloseTo(MAT_D / 2, 6)
    }
  })

  it("leaves the button of the table clear of every seat, lane, pile and the mat, at every table", () => {
    for (const { label, seats: places } of everyTable()) {
      for (const [id, seat] of places) {
        const { domain, plate, hand } = shapesOf(seat)
        expect(polygonsOverlap(pad, domain), `${label}: the button and the domain of ${id}`).toBe(false)
        expect(polygonsOverlap(pad, plate), `${label}: the button and the plate of ${id}`).toBe(false)
        if (hand) expect(polygonsOverlap(pad, hand), `${label}: the button and the hand of ${id}`).toBe(false)
        expect(polygonsOverlap(pad, areaOf(seatHotspot(seat, seat.maxWidth))), `${label}: the button and the area of ${id}`).toBe(false)
      }
    }
    for (const column of COLUMNS) {
      for (const light of [true, false]) expect(polygonsOverlap(pad, areaOf(laneArea(column, light, STEP * 0.96))), `the button and the ${light ? "light" : "disgrace"} lane of ${column}`).toBe(false)
    }
    for (const [what, shape] of [["the mat", MAT], ["the draw pile", DRAW], ["the missions", MISSIONS]] as const) expect(polygonsOverlap(pad, shape), `the button and ${what}`).toBe(false)
  })

  it("stays in the picture at every window", () => {
    for (const aspect of [1.33, 1.6, 1.78, 2.4]) {
      const camera = new PerspectiveCamera(CAMERA.fov, aspect, 0.1, 200)
      placeCamera(camera, CAMERA, { distanceScale: aspectScale(aspect) })
      camera.updateProjectionMatrix()
      camera.updateMatrixWorld()
      for (const point of pad) {
        const shown = new Vector3(point.x, 0, point.z).project(camera)
        expect(Math.abs(shown.x), `at ${aspect}`).toBeLessThan(0.99)
        expect(Math.abs(shown.y), `at ${aspect}`).toBeLessThan(0.99)
      }
    }
  })
})

describe("the cards that lie on the table", () => {
  const COLUMNS = ["butterfly", "toad", "nightingale", "queen", "hare", "stag", "carp"] as const
  const family = (f: VisibleCard["family"], id: number): VisibleCard => ({ id, family: f, role: null })
  // Every family, some of them twice, so that a domain has piles of every kind: closed, spread open, and with cards turned over
  const DOMAIN: VisibleCard[] = (["butterfly", "toad", "toad", "nightingale", "hare", "hare", "stag", "carp"] as const).map((f, i) => family(f, i))

  it("are all of one size, as at a real table: the Queen's table, the draw pile, every domain and the hands that the opponents hold", () => {
    const wrong: string[] = []
    const check = (what: string, scale: number) => {
      if (Math.abs(scale - CARD_SCALE) > 1e-9) wrong.push(`${what}: ${scale}`)
    }
    for (const column of COLUMNS) for (const level of ["up", "down"] as const) for (let rank = 0; rank < 4; rank++) check(`the Queen's table, ${column} ${level} ${rank}`, tablePose(column, level, rank, rank).scale)
    for (const n of [0, 1, 30, 60, 90]) check(`the draw pile at ${n}`, deckTopPose(n).scale)
    for (const { label, seats: places } of everyTable()) {
      for (const [id, seat] of places) {
        for (const pose of arrangeDomain(seat, DOMAIN).poses.values()) check(`${label}: the domain of ${id}`, pose.scale)
        for (const pose of arrangeDomain(seat, DOMAIN, "toad", new Set([0, 3]), 1).poses.values()) check(`${label}: the domain of ${id}, a pile open, another lifted, two cards turned over`, pose.scale)
        if (seat.viewer) continue
        for (let n = 1; n <= HAND_MAX; n++) {
          for (const pose of heldLayout(n, seat)) check(`${label}: a hand of ${n} of ${id}`, pose.scale)
          check(`${label}: where a card played from a hand of ${n} of ${id} flies from`, heldFrom(seat, n).scale)
        }
      }
    }
    expect(wrong).toEqual([])
  })

  it("are of one size at every table: it does not depend on the players, the mat and the camera being fixed", () => {
    const scales = new Set(everyTable().flatMap(({ seats: places }) => [...places.values()].flatMap((seat) => [...arrangeDomain(seat, DOMAIN).poses.values()].map((pose) => pose.scale))))
    expect([...scales]).toEqual([CARD_SCALE])
  })

  it("keep the missions that lie on the table as wide as a courtier, in the pile they are dealt from and at rest, face down and face up", () => {
    const seat = seats(viewOf(3, "p0")).get("p1")!
    const { zone } = arrangeDomain(seat, DOMAIN)
    const poses = [missionPilePose(0), missionPilePose(MISSION_PILE.size + 3), missionRestPose(zone, 0, "m"), missionRestPose(zone, 1, "m", true)]
    for (const pose of poses) expect(MISSION_W * pose.scale).toBeCloseTo(DL, 9)
    expect(MISSION_W * MISSION_SCALE).toBeCloseTo(DL, 9)
  })

  it("are no bigger than the mat lets them be: the cards of two neighbouring columns of the Queen's table stay a hair apart", () => {
    const columns = COLUMNS.map((column) => ({ column, pose: tablePose(column, "up", 0) }))
    for (let i = 1; i < columns.length; i++) {
      const [a, b] = [columns[i - 1]!, columns[i]!]
      const shape = (c: typeof a) => rectangle(c.pose.position.x, c.pose.position.z, DL, DH)
      expect(polygonsOverlap(shape(a), shape(b), 0.1), `${a.column} and ${b.column}`).toBe(false)
    }
  })
})

describe("the hands that the opponents hold", () => {
  it("have a round shadow that is the size of their fan: no smaller than its footprint and not much larger", () => {
    for (let n = 1; n <= HAND_MAX; n++) {
      const half = ((n - 1) * HELD_FAN_SETTINGS.gap + DL) / 2
      expect(HELD_SHADOW.radius(n) / half, `a hand of ${n}`).toBeGreaterThan(0.9)
      expect(HELD_SHADOW.radius(n) / half, `a hand of ${n}`).toBeLessThan(1.75)
    }
  })

  it("stand in the picture, card by card as the camera sees them and not only as the boxes that hold them, at every window", () => {
    const outside: string[] = []
    for (const aspect of [1.33, 1.6, 1.78, 2.4]) {
      const camera = new PerspectiveCamera(CAMERA.fov, aspect, 0.1, 200)
      placeCamera(camera, CAMERA, { distanceScale: aspectScale(aspect) })
      camera.updateProjectionMatrix()
      camera.updateMatrixWorld()
      for (const { label, seats: places } of everyTable()) {
        for (const [id, seat] of places) {
          if (seat.viewer) continue
          for (let n = 1; n <= HAND_MAX; n++) {
            for (const [k, given] of heldLayout(n, seat).entries()) {
              const pose = inFrame(heldFrame(seat), given)
              for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
                const corner = new Vector3((sx * CARD_SIZE.width) / 2, (sy * CARD_SIZE.height) / 2, 0).multiplyScalar(pose.scale).applyQuaternion(pose.quaternion).add(pose.position)
                const shown = corner.project(camera)
                // a hair of air round the window
                if (Math.abs(shown.x) >= 0.98 || Math.abs(shown.y) >= 0.98) outside.push(`${label} at ${aspect}: card ${k + 1} of a hand of ${n} of ${id} at (${shown.x.toFixed(3)}, ${shown.y.toFixed(3)})`)
              }
            }
          }
        }
      }
    }
    expect(outside).toEqual([])
  })
})
