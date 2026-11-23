import { aspectScale, boxesOverlap, frameBoxOfPoses, HELD_FAN_SETTINGS, inFrame, placeCamera, plateBoxOf, pointInFrame, polygonsOverlap, SCREEN_HAND_SETTINGS, SEAT_SETTINGS, screenHandLayout, screenViewOf, type Pose } from "@pbgo/table"
import { PerspectiveCamera, Vector3 } from "three"
import { describe, expect, it } from "vitest"
import { CAMERA, fitFor } from "./camera"
import { areaGap, areaPoses, CARD, chairsOf, guessPlaces, HAND_MAX, HAND_SETTINGS, heldFrom, HELD_SHADOW, heldLayout, LAYOUT_SETTINGS, lineOf, lines, middleBoxes, padPlace, pairPlaces, quadOf, reachQuads, seats, seenQuads, STRIP, stripBox, tableLines, VIEW_TILT } from "./layout"

const ids = (count: number) => Array.from({ length: count }, (_, i) => `p${i}`)

/** Every table the board must hold: two to six players with the viewer seated, and a spectator's view up to five (a full table has no seventh chair for the spectator's empty one) */
const TABLES = [
  ...[2, 3, 4, 5, 6].map((count) => ({ count, seated: true })),
  ...[2, 3, 4, 5].map((count) => ({ count, seated: false })),
]
const where = ({ count, seated }: { count: number; seated: boolean }) => `${count} players${seated ? "" : ", spectator"}`

/** A point of the world in the frame of a seat: x to the right of the player who sits there, the least z toward the middle of the table (the inverse of `pointInFrame`) */
function inSeat(seat: { x: number; z: number; yaw: number }, point: { x: number; z: number }): { x: number; z: number } {
  const dx = point.x - seat.x
  const dz = point.z - seat.z
  return { x: dx * Math.cos(seat.yaw) - dz * Math.sin(seat.yaw), z: dx * Math.sin(seat.yaw) + dz * Math.cos(seat.yaw) }
}

describe("the seats of the table", () => {
  it("put the viewer in front and the others on the ring in turn order, the turn passing to the viewer's left", () => {
    const ring = seats(ids(4), "p0")
    expect(ring.get("p0")).toMatchObject({ x: 0, z: LAYOUT_SETTINGS.viewerZ, yaw: 0 })
    // the player after the viewer sits on their left, which is the least x as the camera sees the table; the last sits on their right
    expect(ring.get("p1")!.x).toBeLessThan(0)
    expect(ring.get("p3")!.x).toBeGreaterThan(0)
    expect(ring.get("p2")!.x).toBeCloseTo(0, 6)
    expect(ring.get("p2")!.z).toBeLessThan(0)
  })

  it("seat a spectator as at a table of one more player, the chair in front staying empty", () => {
    for (const count of [2, 3, 4, 5]) {
      const spectator = [...seats(ids(count), null).values()]
      const table = [...seats(ids(count + 1), "p0").values()]
      // the chairs a spectator sees are those of the table with one more player, the viewer's chair left out
      expect(spectator.map((seat) => seat.z).every((z) => z < LAYOUT_SETTINGS.viewerZ)).toBe(true)
      expect(spectator).toHaveLength(count)
      expect(table).toHaveLength(count + 1)
      for (const seat of spectator) expect(Math.hypot(seat.x, seat.z)).toBeGreaterThan(1)
    }
  })

  it("turn every seat toward the middle: the top of its frame, its least z, points at it", () => {
    for (const table of TABLES) {
      const ring = seats(ids(table.count), table.seated ? "p0" : null)
      for (const [id, seat] of ring) {
        if (seat.x === 0 && seat.z > 0) continue
        const top = pointInFrame({ x: 0, z: 0, yaw: seat.yaw }, { x: 0, z: -1 })
        const toMiddle = { x: -seat.x / Math.hypot(seat.x, seat.z), z: -seat.z / Math.hypot(seat.x, seat.z) }
        expect(top.x * toMiddle.x + top.z * toMiddle.z, `${id}, ${where(table)}`).toBeCloseTo(1, 9)
      }
    }
  })
})

describe("the play area of a seat", () => {
  const area = { scale: 0.85, width: 4 }

  it("keeps the value of every card in sight: a card lies at most a third over the one before it, and never farther than its own width apart", () => {
    for (const n of [2, 5, 9, 15]) {
      const gap = areaGap(n, area)
      expect(gap).toBeGreaterThanOrEqual(CARD.width * area.scale * LAYOUT_SETTINGS.closest - 1e-9)
      expect(gap).toBeLessThanOrEqual(CARD.width * area.scale * LAYOUT_SETTINGS.gap + 1e-9)
    }
  })

  it("is a row centred on the axis of the seat, the oldest card on the left, each a hair higher than the one before", () => {
    const poses = areaPoses(5, area, -2)
    const xs = poses.map((pose) => pose.position.x)
    expect(xs).toEqual([...xs].sort((a, b) => a - b))
    expect(xs[0]! + xs[4]!).toBeCloseTo(0, 9)
    poses.forEach((pose, i) => {
      expect(pose.position.z).toBeCloseTo(-2, 9)
      if (i > 0) expect(pose.position.y).toBeGreaterThan(poses[i - 1]!.position.y)
    })
  })

  it("is as wide as its room while it fits, and no wider than a card's width less a third of it per card after that", () => {
    const wide = (n: number) => {
      const xs = areaPoses(n, area, 0).map((pose) => pose.position.x)
      return Math.max(...xs) - Math.min(...xs) + CARD.width * area.scale
    }
    expect(wide(4)).toBeLessThanOrEqual(area.width + 1e-9)
    expect(wide(7)).toBeLessThanOrEqual(area.width + 1e-9)
  })
})

describe("the line of a seat", () => {
  it("is along the axis of its seat, from the middle of the table outward: the plate, then the play area, then the hand, each clear of the next", () => {
    for (const table of TABLES) {
      for (const line of tableLines(table.count, table.seated)) {
        const label = `${line.viewer ? "the viewer" : "an opponent"}, ${where(table)}`
        // in the frame of the seat the least z is toward the middle
        expect(line.plateBox.maxZ, label).toBeLessThanOrEqual(line.play.minZ - SEAT_SETTINGS.plateGap + 1e-9)
        expect(line.play.maxZ, label).toBeLessThanOrEqual(line.hand.minZ - LAYOUT_SETTINGS.blockGap + 1e-9)
        // all on the same axis: the play area and the hand are centred on it, and so is the name (the favor tokens hang off its right)
        expect((line.play.minX + line.play.maxX) / 2, label).toBeCloseTo(0, 9)
        expect((line.hand.minX + line.hand.maxX) / 2, label).toBeCloseTo(0, 9)
        expect(line.plate.x, label).toBeCloseTo(0, 9)
        expect(boxesOverlap(line.plateBox, line.play), label).toBe(false)
        expect(boxesOverlap(line.play, line.hand), label).toBe(false)
      }
    }
  })

  it("holds a hand of every size where it is: the room of an opponent's hand is that of the biggest, as the camera sees it", () => {
    const seat = seats(ids(4), "p0").get("p1")!
    const { hand } = lineOf(seat, false, 4)
    for (let n = 1; n <= HAND_MAX; n++) {
      const box = frameBoxOfPoses(heldLayout(n, seat), CARD, seat, { tilt: VIEW_TILT })!
      expect(box.minX).toBeGreaterThanOrEqual(hand.minX - 1e-9)
      expect(box.maxX).toBeLessThanOrEqual(hand.maxX + 1e-9)
      expect(box.minZ).toBeGreaterThanOrEqual(hand.minZ - 1e-9)
      expect(box.maxZ).toBeLessThanOrEqual(hand.maxZ + 1e-9)
    }
  })

  it("keeps the press area over the cards and the plate, with the room round them", () => {
    for (const table of TABLES) {
      for (const line of tableLines(table.count, table.seated)) {
        for (const box of [line.cards, line.plateBox]) {
          expect(line.press.minX).toBeLessThanOrEqual(box.minX)
          expect(line.press.maxX).toBeGreaterThanOrEqual(box.maxX)
          expect(line.press.minZ).toBeLessThanOrEqual(box.minZ)
          expect(line.press.maxZ).toBeGreaterThanOrEqual(box.maxZ)
        }
      }
    }
  })

  it("sends the card that is played from an end of the hand, the one on the left as the viewer sees it", () => {
    for (const [id, seat] of seats(ids(5), "p0")) {
      if (id === "p0") continue
      const from = heldFrom(seat, 3)
      const poses = heldLayout(3, seat).map((pose) => inFrame(seat, pose))
      // the first or the last card of the fan, in the world: which of the two is on the viewer's left depends on the way the seat is turned
      const ends = [poses[0]!, poses[2]!]
      expect(ends.some((end) => Math.hypot(end.position.x - from.position.x, end.position.z - from.position.z) < 1e-6), id).toBe(true)
    }
  })

  it("has a round shadow under a hand that is the size of its fan: no smaller than its footprint and not much larger", () => {
    for (let n = 1; n <= HAND_MAX; n++) {
      const half = ((n - 1) * HELD_FAN_SETTINGS.gap + CARD.width * HELD_FAN_SETTINGS.scale) / 2
      expect(HELD_SHADOW.radius(n) / half, `a hand of ${n}`).toBeGreaterThan(0.9)
      expect(HELD_SHADOW.radius(n) / half, `a hand of ${n}`).toBeLessThan(1.75)
    }
  })
})

/** What is on the table of `count` players as polygons on it, by what it is: for every seat its plate, its play area and its hand, for an opponent, the room of its press, and the middle of the table */
function shapes(count: number, seated: boolean) {
  const all = tableLines(count, seated)
  const middle = [...middleBoxes(count === 2), stripBox()].map((box, i) => ({ what: `the middle ${i}`, shape: quadOf(box, { x: 0, z: 0, yaw: 0 }) }))
  const things = all.flatMap((line, i) => [
    { what: `plate of seat ${i}`, shape: quadOf(line.plateBox, line.seat), seat: i },
    { what: `play area of seat ${i}`, shape: quadOf(line.play, line.seat), seat: i },
    ...(line.viewer ? [] : [{ what: `hand of seat ${i}`, shape: quadOf(line.hand, line.seat), seat: i }]),
  ])
  return { things, middle, presses: all.map((line, i) => ({ what: `press of seat ${i}`, shape: quadOf(line.press, line.seat) })) }
}

describe("the table", () => {
  it("never lays one seat's plate, play area or hand over another's, nor over the middle of the table", () => {
    const over: string[] = []
    for (const table of TABLES) {
      const { things, middle } = shapes(table.count, table.seated)
      for (let i = 0; i < things.length; i++) {
        for (let j = i + 1; j < things.length; j++) if (things[i]!.seat !== things[j]!.seat && polygonsOverlap(things[i]!.shape, things[j]!.shape)) over.push(`${things[i]!.what} and ${things[j]!.what}, ${where(table)}`)
        for (const other of middle) if (polygonsOverlap(things[i]!.shape, other.shape)) over.push(`${things[i]!.what} and ${other.what}, ${where(table)}`)
      }
    }
    expect(over).toEqual([])
  })

  it("keeps the areas that are pressed to choose a player apart from one another and from the middle of the table", () => {
    const over: string[] = []
    for (const table of TABLES) {
      const { presses, middle } = shapes(table.count, table.seated)
      for (let i = 0; i < presses.length; i++) {
        for (let j = i + 1; j < presses.length; j++) if (polygonsOverlap(presses[i]!.shape, presses[j]!.shape)) over.push(`${presses[i]!.what} and ${presses[j]!.what}, ${where(table)}`)
        for (const other of middle) if (polygonsOverlap(presses[i]!.shape, other.shape)) over.push(`${presses[i]!.what} and ${other.what}, ${where(table)}`)
      }
    }
    expect(over).toEqual([])
  })

  it("keeps the strip of the controls clear of the deck and the card set aside, and the pads inside it", () => {
    const strip = stripBox()
    for (const faceUp of [false, true]) for (const box of middleBoxes(faceUp)) expect(boxesOverlap(strip, box), `face up ${faceUp}`).toBe(false)
    for (const pad of [padPlace(), ...pairPlaces(), ...guessPlaces()]) {
      expect(pad.x - pad.width / 2).toBeGreaterThanOrEqual(strip.minX - 1e-9)
      expect(pad.x + pad.width / 2).toBeLessThanOrEqual(strip.maxX + 1e-9)
      expect(pad.z - pad.depth / 2).toBeGreaterThanOrEqual(strip.minZ - 1e-9)
      expect(pad.z + pad.depth / 2).toBeLessThanOrEqual(strip.maxZ + 1e-9)
    }
    expect(STRIP.half).toBeGreaterThan(0)
  })
})

// --- What the viewer sees: the polygons of the shapes on the screen, in a window of each shape

type Polygon = { x: number; y: number }[]
const ASPECTS = [1.33, 1.6, 1.78, 2.4]
const CORNERS = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
] as const

/** The camera as the table puts it for a table of `count` in a window of this aspect ratio: fitted to the window (`fitFor`), then placed as the rig does */
function cameraOf(count: number, aspect: number, seated: boolean) {
  const viewport = { width: Math.round(900 * aspect), height: 900 }
  const fit = fitFor(count, viewport, CAMERA, seated)
  const camera = new PerspectiveCamera(CAMERA.fov, aspect, 0.1, 200)
  placeCamera(camera, fit.camera, { distanceScale: aspectScale(aspect) })
  camera.updateProjectionMatrix()
  camera.updateMatrixWorld()
  return camera
}

const onScreen = (camera: PerspectiveCamera, point: Vector3) => {
  const shown = point.clone().project(camera)
  return { x: shown.x, y: shown.y }
}

/** A card of a pose, in the world or (for the viewer's hand) in the frame of the camera, as the polygon it covers on the screen */
function cardOnScreen(camera: PerspectiveCamera, pose: Pose, inCamera = false): Polygon {
  return CORNERS.map(([sx, sy]) => {
    const point = new Vector3((sx * CARD.width) / 2, (sy * CARD.height) / 2, 0).multiplyScalar(pose.scale).applyQuaternion(pose.quaternion).add(pose.position)
    return onScreen(camera, inCamera ? camera.localToWorld(point) : point)
  })
}

const flatOnScreen = (camera: PerspectiveCamera, corners: { x: number; z: number }[]): Polygon => corners.map(({ x, z }) => onScreen(camera, new Vector3(x, 0.03, z)))

function overlaps(a: Polygon, b: Polygon): boolean {
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

describe("the viewer's hand on the screen", () => {
  it("is whole in the bottom left of the picture, in every window, from a portrait one to an ultra-wide one", () => {
    for (const aspect of [0.75, 1, ...ASPECTS]) {
      const camera = cameraOf(2, aspect, true)
      const view = screenViewOf({ m00: camera.projectionMatrix.elements[0]!, m11: camera.projectionMatrix.elements[5]! }, HAND_SETTINGS.distance)
      for (let n = 1; n <= HAND_MAX; n++) {
        for (const pose of screenHandLayout(n, view, CARD, HAND_SETTINGS)) {
          for (const corner of cardOnScreen(camera, pose, true)) {
            expect(corner.x, `a hand of ${n} at ${aspect}`).toBeGreaterThanOrEqual(-1.1)
            expect(corner.x, `a hand of ${n} at ${aspect}`).toBeLessThanOrEqual(-1 + HAND_SETTINGS.room * 2 + 0.12)
            expect(corner.y, `a hand of ${n} at ${aspect}`).toBeLessThanOrEqual(-0.2)
          }
        }
      }
    }
    expect(HAND_SETTINGS.room).toBeLessThanOrEqual(SCREEN_HAND_SETTINGS.room)
  })

  it("never covers the viewer's play area, nor their plate, in any window, a hand of two cards or of three", () => {
    const over: string[] = []
    for (const { count } of TABLES.filter((table) => table.seated)) {
      for (const aspect of ASPECTS) {
        const camera = cameraOf(count, aspect, true)
        const view = screenViewOf({ m00: camera.projectionMatrix.elements[0]!, m11: camera.projectionMatrix.elements[5]! }, HAND_SETTINGS.distance)
        const mine = lines(ids(count), "p0").get("p0")!
        const parts = { "play area": flatOnScreen(camera, quadOf(mine.play, mine.seat)), plate: flatOnScreen(camera, quadOf(mine.plateBox, mine.seat)) }
        for (const size of [2, HAND_MAX]) {
          screenHandLayout(size, view, CARD, HAND_SETTINGS).forEach((pose, i) => {
            const card = cardOnScreen(camera, pose, true)
            for (const [name, shape] of Object.entries(parts)) if (overlaps(card, shape)) over.push(`card ${i} of a hand of ${size} and the ${name}, ${count} players, aspect ${aspect}`)
          })
        }
      }
    }
    expect(over).toEqual([])
  })

  it("never covers an opponent's plate or play area either", () => {
    const over: string[] = []
    for (const { count } of TABLES.filter((table) => table.seated)) {
      for (const aspect of ASPECTS) {
        const camera = cameraOf(count, aspect, true)
        const view = screenViewOf({ m00: camera.projectionMatrix.elements[0]!, m11: camera.projectionMatrix.elements[5]! }, HAND_SETTINGS.distance)
        const others = tableLines(count, true).filter((line) => !line.viewer)
        for (const size of [2, HAND_MAX]) {
          const hand = screenHandLayout(size, view, CARD, HAND_SETTINGS).map((pose) => cardOnScreen(camera, pose, true))
          others.forEach((line, k) => {
            for (const [name, box] of [["plate", line.plateBox], ["play area", line.play]] as const) hand.forEach((card, i) => overlaps(card, flatOnScreen(camera, quadOf(box, line.seat))) && over.push(`card ${i} of a hand of ${size} and the ${name} of opponent ${k}, ${count} players, aspect ${aspect}`))
          })
        }
      }
    }
    expect(over).toEqual([])
  })
})

describe("the cards the others hold", () => {
  it("stand straight up and keep close: a hand is no wider than its cards and a little more, so that an opponent's cards are told apart and counted", () => {
    const seat = seats(ids(4), "p0").get("p1")!
    for (let n = 1; n <= HAND_MAX; n++) {
      const cards = heldLayout(n, seat)
      const left = Math.min(...cards.map((pose) => pose.position.x))
      const right = Math.max(...cards.map((pose) => pose.position.x))
      expect(right - left, `a hand of ${n}`).toBeLessThan((n - 1) * 0.4 + 0.1)
    }
  })

  it("lie on the table of every seat in the picture, whole, in every window", () => {
    const outside: string[] = []
    for (const { count, seated } of TABLES) {
      for (const aspect of ASPECTS) {
        const camera = cameraOf(count, aspect, seated)
        for (const line of tableLines(count, seated)) {
          if (line.viewer) continue
          for (let n = 1; n <= HAND_MAX; n++) {
            heldLayout(n, line.seat).forEach((pose, i) => {
              const shown = cardOnScreen(camera, inFrame(line.seat, pose))
              if (!shown.every((point) => Math.abs(point.x) < 1 && point.y < 1 && point.y > -1)) outside.push(`card ${i} of a hand of ${n}, ${count} players${seated ? "" : ", spectator"}, aspect ${aspect}`)
            })
          }
        }
      }
    }
    expect(outside).toEqual([])
  })
})

describe("what the camera is given", () => {
  it("is the plate and the play area of every seat, and the middle with its mirror image: one quad each, and the area of each seat to reach", () => {
    for (const { count, seated } of TABLES) {
      const own = count * 2
      const middle = middleBoxes(count === 2).length + 1
      expect(seenQuads(count, seated), where({ count, seated })).toHaveLength(own + 2 * middle)
      expect(reachQuads(count, seated), where({ count, seated })).toHaveLength(count)
    }
  })

  it("lies inside the press area of the line it comes from, which holds the plate and the cards", () => {
    for (const { count, seated } of TABLES) {
      for (const line of tableLines(count, seated)) {
        for (const corner of quadOf(line.press, line.seat)) {
          const inside = inSeat(line.seat, corner)
          expect(inside.x).toBeGreaterThanOrEqual(line.press.minX - 1e-6)
          expect(inside.x).toBeLessThanOrEqual(line.press.maxX + 1e-6)
        }
      }
    }
  })

  it("is made for the number of chairs of the table, one more for a spectator", () => {
    expect(chairsOf(3)).toBe(3)
    expect(chairsOf(3, false)).toBe(4)
    expect(plateBoxOf(lineOf(seats(ids(3), "p0").get("p0")!, true, 3).plate).maxX).toBeGreaterThan(0)
  })
})
