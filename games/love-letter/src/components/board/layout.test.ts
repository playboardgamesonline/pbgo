import { standingDistance, type Viewport } from "@pbgo/table"
import { describe, expect, it } from "vitest"
import { Vector3 } from "three"
import { fitFor } from "./camera"
import {
  areaBox,
  areaGap,
  areaPoses,
  areas,
  backsPoses,
  type Box,
  CARD,
  cornersOf,
  faceUpPoses,
  fanPoses,
  fanSeen,
  fitSentence,
  guessPlaces,
  guessPoses,
  handBox,
  handOf,
  LAYOUT_SETTINGS,
  middleBoxes,
  nameWidth,
  padPlace,
  pairPlaces,
  PLATE_TRAILING,
  plateAt,
  plateBox,
  plateFit,
  seatAngle,
  seatSpots,
  seenBoxes,
  STRIP,
  stripBox,
  tableBoxes,
  tableOf,
  tableQuads,
  uprightYaw,
  VIEW_TILT,
  zoneBoxes,
} from "./layout"

const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i}`)
const SIZES = [2, 3, 4, 5, 6]

/** Whether two turned rectangles share any area (the separating axis test), with a hair of tolerance so that boxes that touch do not count */
function boxesMeet(a: Box, b: Box): boolean {
  const ca = cornersOf(a)
  const cb = cornersOf(b)
  const axes = [ca, cb].flatMap((corners) => [
    { x: corners[1]!.x - corners[0]!.x, z: corners[1]!.z - corners[0]!.z },
    { x: corners[2]!.x - corners[1]!.x, z: corners[2]!.z - corners[1]!.z },
  ])
  return axes.every((axis) => {
    const project = (corners: typeof ca) => corners.map((corner) => corner.x * axis.x + corner.z * axis.z)
    const [pa, pb] = [project(ca), project(cb)]
    const length = Math.hypot(axis.x, axis.z)
    return Math.min(Math.max(...pa), Math.max(...pb)) - Math.max(Math.min(...pa), Math.min(...pb)) > 1e-6 * length
  })
}

describe("the angle of a seat", () => {
  const angles = (n: number, seated = true) => Array.from({ length: n }, (_, i) => seatAngle(i, n, seated))

  it("puts the viewer in front and the others around the table, clockwise from them, at every size of table from two to six", () => {
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

  it("is the table of the arrangement: who sits where", () => {
    expect(angles(2)).toEqual([0, 180])
    expect(angles(3)).toEqual([0, 145, 215])
    expect(angles(4)).toEqual([0, 72, 180, 288])
    expect(angles(5)).toEqual([0, 72, 144, 216, 288])
    expect(angles(6).map(Math.round)).toEqual([0, 66, 123, 180, 237, 294])
  })

  it("seats a spectator at the places a table with one more player has, the empty chair in front being nobody's", () => {
    for (const n of SIZES) {
      const all = angles(n, false)
      const full = angles(n + 1)
      expect(all, `${n} players`).toEqual(full.slice(1))
    }
  })
})

describe("the seats", () => {
  it("put the viewer in front, upright, and give every other seat the yaw that turns it to face its player", () => {
    for (const n of SIZES) {
      const spots = seatSpots(ids(n), "p1")
      expect(spots.size, `${n} players`).toBe(n)
      expect(spots.get("p1"), `${n} players: the viewer`).toMatchObject({ x: 0, yaw: 0 })
      expect(spots.get("p1")!.z).toBeGreaterThan(0)
      for (const [id, spot] of spots) {
        if (id === "p1") continue
        // a face-up card's top edge points along -z at yaw 0; turned by the yaw it points at the middle of the table, as a seated player reads it
        const top = { x: -Math.sin(spot.yaw), z: -Math.cos(spot.yaw) }
        const toMiddle = { x: -spot.x / Math.hypot(spot.x, spot.z), z: -spot.z / Math.hypot(spot.x, spot.z) }
        expect(top.x, `${n} players: ${id}`).toBeCloseTo(toMiddle.x)
        expect(top.z, `${n} players: ${id}`).toBeCloseTo(toMiddle.z)
      }
    }
  })

  it("make the turn pass to the viewer's left", () => {
    for (const n of SIZES.filter((size) => size > 2)) {
      const spots = seatSpots(ids(n), "p0")
      expect(spots.get("p1")!.x, `${n} players`).toBeLessThan(0)
      expect(spots.get(`p${n - 1}`)!.x, `${n} players`).toBeGreaterThan(0)
    }
  })

  it("stand one opposite the viewer for two, in the upper corners for three, one on each side, a little toward the viewer, for four", () => {
    const at = (n: number) => [...seatSpots(ids(n), "p0").values()]
    const [, across] = at(2)
    expect(across!.x).toBeCloseTo(0)
    expect(Math.abs(Math.abs(across!.yaw) - Math.PI)).toBeLessThan(1e-9)
    const [, left3, right3] = at(3)
    expect(left3!.x).toBeLessThan(0)
    expect(right3!.x).toBeGreaterThan(0)
    expect(left3!.z).toBeLessThan(0)
    expect(right3!.z).toBeLessThan(0)
    const [, left, top, right] = at(4)
    // turned a little less than a quarter turn from the viewer: the side seats face the middle of the table, which is a little away from the viewer's side
    expect(left!.yaw).toBeGreaterThan(-Math.PI / 2 - 0.1)
    expect(left!.yaw).toBeLessThan(-1.2)
    expect(right!.yaw).toBeCloseTo(-left!.yaw)
    expect(left!.z).toBeGreaterThan(0)
    expect(Math.abs(top!.yaw)).toBeCloseTo(Math.PI)
  })

  it("seat a spectator, who has no seat, with nobody in front", () => {
    for (const n of SIZES) {
      const spots = [...seatSpots(ids(n), null).values()]
      expect(spots.some((spot) => Math.abs(spot.x) < 1e-6 && spot.z > 0)).toBe(false)
      expect(new Set(spots.map((spot) => spot.x.toFixed(3) + spot.z.toFixed(3))).size).toBe(n)
    }
  })

  it("grow the ring and shrink the cards of the opponents as the table fills, from two to six", () => {
    let radius = 0
    let scale = Infinity
    for (const n of SIZES) {
      const table = tableOf(n)
      expect(table.radiusX, `${n} players`).toBeGreaterThanOrEqual(radius)
      expect(table.areaScale, `${n} players`).toBeLessThanOrEqual(scale)
      radius = table.radiusX
      scale = table.areaScale
    }
    expect(tableOf(2)).toMatchObject({ radiusX: LAYOUT_SETTINGS.radiusX2, areaScale: LAYOUT_SETTINGS.areaScale2 })
    expect(tableOf(6)).toMatchObject({ radiusX: LAYOUT_SETTINGS.radiusX6, areaScale: LAYOUT_SETTINGS.areaScale6 })
  })
})

describe("the play areas", () => {
  it("give every player one, the viewer's in front of them, as wide as the room the seats beside it leave", () => {
    for (const n of SIZES) {
      const all = areas(seatSpots(ids(n), "p0"), "p0")
      expect([...all.keys()].sort()).toEqual(ids(n).sort())
      expect(all.get("p0")!.at.z).toBe(LAYOUT_SETTINGS.viewerZ)
      expect(all.get("p0")!.yaw).toBe(0)
      expect(all.get("p0")!.width, `${n} players`).toBeLessThanOrEqual(LAYOUT_SETTINGS.viewerWidth)
      expect(all.get("p0")!.width, `${n} players`).toBeGreaterThanOrEqual(CARD.width * 3)
    }
  })

  it("lay the cards in a row that grows closer as it fills, never closer than the medallion with the value of a card allows", () => {
    const area = { scale: 0.8, width: 8 }
    const card = CARD.width * area.scale
    const gaps = [1, 2, 3, 5, 8, 12, 20].map((n) => areaGap(n, area))
    for (let i = 1; i < gaps.length; i++) expect(gaps[i]!).toBeLessThanOrEqual(gaps[i - 1]! + 1e-9)
    expect(gaps[0]).toBeCloseTo(card * LAYOUT_SETTINGS.gap)
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(card * LAYOUT_SETTINGS.closest - 1e-9)
    // a face is 760 wide and the medallion ends at 235: the third of the card that stays in sight is the medallion's
    expect(LAYOUT_SETTINGS.closest).toBeGreaterThanOrEqual(235 / 760)
  })

  it("give each card a hair more height than the one before, so that the newest is on top and nothing fights for a pixel", () => {
    const poses = areaPoses(6, { scale: 0.8, width: 8 })
    expect(poses).toHaveLength(6)
    for (let i = 1; i < poses.length; i++) expect(poses[i]!.position.y).toBeGreaterThan(poses[i - 1]!.position.y)
    // the oldest first, on the left
    expect(poses[0]!.position.x).toBeLessThan(poses[5]!.position.x)
  })

  it("keep a row of the most cards a round can lay inside the room of its area", () => {
    for (const n of SIZES) {
      const spots = seatSpots(ids(n), "p0")
      for (const area of areas(spots, "p0").values()) {
        const full = areaBox(area, 20)
        expect(full.halfWidth * 2, `${n} players`).toBeLessThanOrEqual(area.width + 1e-9)
      }
    }
  })
})

describe("the block of a seat: play area, hand, plate", () => {
  /** The distance of a box along the way out from the middle, in the frame of the seat */
  const alongOut = (spot: { yaw: number }, box: Box) => box.x * Math.sin(spot.yaw) + box.z * Math.cos(spot.yaw)

  it("lays out the viewer's block along the way out: the play area first, then the hand, then the plate, with a gap between", () => {
    for (const n of SIZES) {
      const spots = seatSpots(ids(n), "p0")
      const area = areas(spots, "p0").get("p0")!
      const hand = handOf(area, true)
      const plate = plateBox(spots.get("p0")!, area, hand)
      const areaB = areaBox(area, 3)
      const handB = handBox(hand, 2)
      const spot = spots.get("p0")!
      // the hand is the fan as the camera sees it (`handBox`), which lies a gap past the play area and a gap before the plate
      expect(alongOut(spot, handB) - handB.halfDepth, `${n} players: hand past area`).toBeGreaterThanOrEqual(alongOut(spot, areaB) + areaB.halfDepth + LAYOUT_SETTINGS.blockGap - 1e-9)
      expect(alongOut(spot, plate) - plate.halfDepth, `${n} players: plate past hand`).toBeGreaterThanOrEqual(alongOut(spot, handB) + handB.halfDepth + LAYOUT_SETTINGS.blockGap - 1e-9)
    }
  })

  it("sees the viewer's fan, with the camera of every window, over the depth the layout gives it, clear of the play area of the viewer, whatever the table", () => {
    const WINDOWS: Viewport[] = [
      { width: 1280, height: 720 },
      { width: 1440, height: 900 },
      { width: 1920, height: 1080 },
      { width: 1024, height: 1366 },
    ]
    for (const viewport of WINDOWS) {
      for (const n of SIZES) {
        const label = `${n} players in ${viewport.width}x${viewport.height}`
        const { camera } = fitFor(n, viewport)
        // where the camera stands (`placeCamera` of the table kit): `distance` from the target, `tilt` from the vertical, in front of the table
        const distance = standingDistance(camera, viewport)
        const tilt = (camera.tilt * Math.PI) / 180
        const eye = new Vector3(camera.targetX, distance * Math.cos(tilt), camera.targetZ + distance * Math.sin(tilt))
        /** Where on the table a point is seen: where the line from the eye through it meets the ground */
        const groundOf = (point: Vector3) => {
          const ray = point.clone().sub(eye)
          return eye.clone().add(ray.multiplyScalar(-eye.y / ray.y))
        }
        const spots = seatSpots(ids(n), "p0")
        const area = areas(spots, "p0").get("p0")!
        const hand = handOf(area, true)
        // the top and the bottom edge of a card of the fan, in the world
        const pose = fanPoses(1, hand)[0]!
        const half = (CARD.height * hand.scale) / 2
        const edge = (sign: number) => new Vector3(0, sign * half, 0).applyQuaternion(pose.quaternion).add(pose.position).add(new Vector3(hand.at.x, 0, hand.at.z))
        const [top, bottom] = [groundOf(edge(1)).z, groundOf(edge(-1)).z]
        const seen = fanSeen(hand.scale)
        // what the layout takes the fan to cover holds what the real camera sees of it, and not much more: its edges are at most a third of a world unit past the real ones
        const [near, far] = [hand.at.z + seen.middle - seen.half, hand.at.z + seen.middle + seen.half]
        expect(top, `${label}: the top edge`).toBeGreaterThanOrEqual(near)
        expect(bottom, `${label}: the bottom edge`).toBeLessThanOrEqual(far)
        expect(top - near, `${label}: the top edge`).toBeLessThan(0.35)
        expect(far - bottom, `${label}: the bottom edge`).toBeLessThan(0.35)
        // so the fan is seen below the play area, a gap from it, and above the plate, a gap from it
        expect(top, `${label}: the fan clear of the area`).toBeGreaterThanOrEqual(area.at.z + (CARD.height * area.scale) / 2 + LAYOUT_SETTINGS.blockGap)
        const plate = plateBox(spots.get("p0")!, area, hand)
        expect(bottom, `${label}: the fan clear of the plate`).toBeLessThanOrEqual(plate.z - plate.halfDepth - LAYOUT_SETTINGS.blockGap + 1e-9)
      }
    }
  })

  it("is tilted the way the camera is: the layout and the camera read the same angle", () => {
    expect(fitFor(4, { width: 1440, height: 900 }).camera.tilt).toBe(VIEW_TILT)
  })

  it("lays out an opponent's block in two rows: the play area first, then the plate with the hand beside it, so that the block is no deeper than its area and its plate", () => {
    for (const n of SIZES) {
      const spots = seatSpots(ids(n), "p0")
      const placed = areas(spots, "p0")
      for (const [id, spot] of spots) {
        if (id === "p0") continue
        const area = placed.get(id)!
        const hand = handOf(area, false)
        const plate = plateBox(spot, area, hand)
        const areaB = areaBox(area, 3)
        const handB = handBox(hand, 3)
        // the plate lies past the play area; the hand is on the same row as the plate, beside it, never over it
        expect(alongOut(spot, plate) - plate.halfDepth, `${n} players: ${id}: plate past area`).toBeGreaterThanOrEqual(alongOut(spot, areaB) + areaB.halfDepth - 1e-9)
        expect(boxesMeet(plate, handB), `${n} players: ${id}: hand and plate`).toBe(false)
        expect(boxesMeet(areaB, handB), `${n} players: ${id}: hand and area`).toBe(false)
        // the hand is the width of the plate and a gap from its middle, on the side of the viewer: a seat at the left or the right has it below its plate on the screen
        if (Math.abs(spot.x) > 1) expect(handB.z, `${n} players: ${id}: hand toward the viewer`).toBeGreaterThan(plate.z - 1e-9)
      }
    }
  })

  it("lets an opponent's backs grow away from the plate, the first one fixed, so that no back moves when another is drawn", () => {
    const spots = seatSpots(ids(4), "p0")
    const area = areas(spots, "p0").get("p1")!
    const hand = handOf(area, false)
    const [one, two, three] = [backsPoses(1, hand), backsPoses(2, hand), backsPoses(3, hand)]
    expect(two[0]!.position.x).toBeCloseTo(one[0]!.position.x)
    expect(three[0]!.position.x).toBeCloseTo(one[0]!.position.x)
    expect(Math.sign(three[2]!.position.x - three[0]!.position.x)).toBe(hand.side)
  })

  it("gives the viewer a hand bigger than any other card of the table, an opponent a small one", () => {
    expect(LAYOUT_SETTINGS.viewerHandScale).toBeGreaterThan(LAYOUT_SETTINGS.viewerAreaScale)
    expect(LAYOUT_SETTINGS.viewerHandScale).toBeGreaterThan(LAYOUT_SETTINGS.areaScale2)
    expect(LAYOUT_SETTINGS.opponentHandScale).toBeLessThan(LAYOUT_SETTINGS.areaScale6)
  })

  it("centres what a plate shows on the middle of its box: the avatar and the name stand on the place of the seat and the tokens hang off the right of the name, so the place is half of their room to the left of the box, as the plate reads", () => {
    for (const n of SIZES) {
      const spots = seatSpots(ids(n), "p0")
      const placed = areas(spots, "p0")
      for (const [id, spot] of spots) {
        const area = placed.get(id)!
        const hand = handOf(area, id === "p0")
        const plate = plateAt(spot, area, hand)
        const box = plateBox(spot, area, hand)
        const along = { x: Math.cos(plate.yaw), z: -Math.sin(plate.yaw) }
        expect((box.x - plate.x) * along.x + (box.z - plate.z) * along.z, `${n} players: ${id}`).toBeCloseTo((PLATE_TRAILING * area.plate) / 2)
      }
    }
  })

  it("draws the plate of a long name smaller, so that the avatar, the name and the tokens fit the room the layout keeps for them: a name of twelve capitals as wide as a W at a table of six, as every other", () => {
    // `nameWidth` takes the width of a text over the height of its lettering, as the browser measures it in the display font (Cabazon, at the weight of the table's lettering): a capital W is 0.893 of it and a letter of an ordinary name about 0.4 ("Alexandrina" is 4.3,
    // "Maximilian-Joh" 5.7)
    const wide = nameWidth(12 * 0.893)
    const short = nameWidth(4 * 0.893)
    expect(plateFit(short)).toBe(1)
    expect(plateFit(wide)).toBeLessThan(1)
    expect(plateFit(nameWidth(4.3))).toBe(1)
    expect(plateFit(nameWidth(5.7))).toBeLessThan(1)
    for (const n of SIZES) {
      const spots = seatSpots(ids(n), "p0")
      const placed = areas(spots, "p0")
      const boxes = [...tableBoxes(n)]
      for (const [id, spot] of spots) {
        const area = placed.get(id)!
        const hand = handOf(area, id === "p0")
        const fit = plateFit(wide)
        const box = plateBox(spot, area, hand)
        // what is drawn, as wide as the avatar, the name and the tokens are once the plate is fitted, centred where `plateAt` puts it: inside the box of the plate, whatever the name
        const drawn = (0.18 + 0.56 + wide + PLATE_TRAILING) * fit * area.plate
        expect(drawn, `${n} players: ${id}`).toBeLessThanOrEqual(box.halfWidth * 2 + 1e-9)
        const along = { x: Math.cos(uprightYaw(spot.yaw)), z: -Math.sin(uprightYaw(spot.yaw)) }
        const place = plateAt(spot, area, hand, fit)
        // the centre of what is drawn (the place, half the room of the tokens to the right) is the middle of the box, along the plate's row
        expect((box.x - place.x) * along.x + (box.z - place.z) * along.z, `${n} players: ${id}`).toBeCloseTo((PLATE_TRAILING * fit * area.plate) / 2)
        // and the box of what is drawn meets no other box of the table but the plate's own
        const content = { ...box, halfWidth: drawn / 2 }
        for (const other of boxes) if (other.x !== box.x || other.z !== box.z) expect(boxesMeet(content, other), `${n} players: ${id}`).toBe(false)
      }
    }
  })

  it("turns a plate to read upright, never upside down, for every seat of every table", () => {
    for (const n of SIZES) {
      const spots = seatSpots(ids(n), "p0")
      const placed = areas(spots, "p0")
      for (const [id, spot] of spots) {
        const plate = plateAt(spot, placed.get(id)!, handOf(placed.get(id)!, id === "p0"))
        expect(Math.abs(plate.yaw), `${n} players: ${id}`).toBeLessThanOrEqual(Math.PI / 2 + 1e-9)
      }
    }
    expect(uprightYaw(Math.PI)).toBeCloseTo(0)
    expect(uprightYaw(-Math.PI / 2)).toBeCloseTo(-Math.PI / 2)
  })
})

describe("what lies on the table", () => {
  /** Every box of a table, named, in the order `tableBoxes` gives them: the plate, the area and the hand of each seat, then the middle */
  const named = (n: number, full: boolean, seated: boolean) => {
    const boxes = tableBoxes(n, full, seated)
    const names = [...Array.from({ length: n }, (_, i) => [`plate ${i}`, `area ${i}`, `hand ${i}`]).flat(), ...middleBoxes(n === 2).map((_, i) => `middle ${i}`), "strip"]
    return boxes.map((box, i) => ({ name: names[i]!, box }))
  }

  it("is one box for each plate, play area and hand of a seat, and for each of the deck, the card set aside and, at two players, the cards set aside face up, and one for the strip of the controls", () => {
    for (const n of SIZES) expect(tableBoxes(n)).toHaveLength(3 * n + (n === 2 ? 3 : 2) + 1)
  })

  it("never lays a plate, a play area, a hand or the middle over another, at every size of table, for a player and for a spectator, with the areas at the nominal size and at all the room they may take", () => {
    for (const seated of [true, false]) {
      for (const full of [false, true]) {
        for (const n of SIZES) {
          // a spectator has no seat, and the platform has no spectator (only the admin's preview could ask): at two players the seats of the layout are the corners of a table of three and a row of the most cards they may lay is no case to tune a table for,
          // and a table of six has no seventh seat for the empty chair
          if (!seated && (n === 6 || (full && n === 2))) continue
          const all = named(n, full, seated)
          for (let i = 0; i < all.length; i++) {
            for (let j = i + 1; j < all.length; j++) {
              const [a, b] = [all[i]!, all[j]!]
              expect(boxesMeet(a.box, b.box), `${n} players${seated ? "" : ", spectator"}${full ? ", full areas" : ""}: ${a.name} and ${b.name}`).toBe(false)
            }
          }
        }
      }
    }
  })

  it("lays the three cards set aside face up side by side, each as big as a card of the middle", () => {
    const poses = faceUpPoses(3)
    expect(poses).toHaveLength(3)
    expect(poses[0]!.position.x).toBeLessThan(poses[1]!.position.x)
    expect(poses[1]!.position.x).toBeLessThan(poses[2]!.position.x)
    expect(poses[0]!.scale).toBeCloseTo(LAYOUT_SETTINGS.faceUpScale)
  })
})

describe("the zones that choose a player", () => {
  it("is one for each seat, and none overlaps another zone, the plate or the hand of another seat, or the middle of the table, at every size of table, for a player and for a spectator", () => {
    for (const seated of [true, false]) {
      for (const n of SIZES) {
        // see above: a table of six has no seventh seat for a spectator's empty chair
        if (!seated && n === 6) continue
        const boxes = zoneBoxes(n, seated)
        expect(boxes, `${n} players`).toHaveLength(n)
        for (let i = 0; i < n; i++) {
          for (let j = i + 1; j < n; j++) expect(boxesMeet(boxes[i]!, boxes[j]!), `${n} players${seated ? "" : ", spectator"}: zones ${i} and ${j}`).toBe(false)
        }
        // the zones against the middle of the table
        for (const zone of boxes) for (const middle of [...middleBoxes(n === 2), stripBox()]) expect(boxesMeet(zone, middle), `${n} players${seated ? "" : ", spectator"}: a zone and the middle`).toBe(false)
      }
    }
  })

  it("holds the play area of its player and, for an opponent, their hand and their plate, so that a press on a card or on the name chooses them", () => {
    for (const n of SIZES) {
      const ids_ = ids(n)
      const spots = seatSpots(ids_, "p0")
      const placed = areas(spots, "p0")
      const boxes = zoneBoxes(n)
      ids_.forEach((id, i) => {
        const area = placed.get(id)!
        const hand = handOf(area, id === "p0")
        const zone = boxes[i]!
        // the middle of the play area of every player is in their zone
        expect(pointIn(zone, area.at), `${n} players: ${id}: the area`).toBe(true)
        if (id !== "p0") {
          expect(pointIn(zone, hand.at), `${n} players: ${id}: the hand`).toBe(true)
          expect(pointIn(zone, plateAt(spots.get(id)!, area, hand)), `${n} players: ${id}: the plate`).toBe(true)
        } else {
          // the viewer's hand is pressed on its own: their zone stops short of it
          expect(pointIn(zone, hand.at), `${n} players: the viewer's hand`).toBe(false)
        }
      })
    }
  })

  it("is at least as wide as a few cards, even for a play area with none in it", () => {
    for (const n of SIZES) for (const zone of zoneBoxes(n)) expect(zone.halfWidth * 2, `${n} players`).toBeGreaterThanOrEqual(2)
  })
})

describe("the strip of the controls", () => {
  const inside = (pad: { x: number; z: number; width: number; depth: number }, box = stripBox()) =>
    Math.abs(pad.x) + pad.width / 2 <= box.halfWidth + 1e-9 && pad.z - pad.depth / 2 >= box.z - box.halfDepth - 1e-9 && pad.z + pad.depth / 2 <= box.z + box.halfDepth + 1e-9
  const boxOf = (pad: { x: number; z: number; width: number; depth: number }): Box => ({ x: pad.x, z: pad.z, halfWidth: pad.width / 2, halfDepth: pad.depth / 2, yaw: 0 })

  it("holds every pad it draws, whichever is drawn, and stays between the deck and the card set aside, with room to spare", () => {
    for (const pad of [padPlace(), ...pairPlaces(), ...guessPlaces()]) expect(inside(pad)).toBe(true)
    const deckEdge = LAYOUT_SETTINGS.deckX + (CARD.width * LAYOUT_SETTINGS.deckScale) / 2
    const asideEdge = LAYOUT_SETTINGS.asideX - (CARD.width * LAYOUT_SETTINGS.asideScale) / 2
    expect(stripBox().halfWidth).toBeLessThan(asideEdge)
    expect(-stripBox().halfWidth).toBeGreaterThan(deckEdge)
  })

  it("lays the nine characters out as two rows of small faces, five then four, each row centred, that touch nothing, in the order of their value", () => {
    const places = guessPlaces()
    expect(places).toHaveLength(9)
    expect(guessPoses()).toHaveLength(9)
    for (let i = 0; i < 9; i++) for (let j = i + 1; j < 9; j++) expect(boxesMeet(boxOf(places[i]!), boxOf(places[j]!))).toBe(false)
    // the first row has five, the second four, and each is centred on the middle of the table
    expect(places.slice(0, 5).every((place) => place.z === places[0]!.z)).toBe(true)
    expect(places.slice(5).every((place) => place.z === places[5]!.z)).toBe(true)
    expect(places[5]!.z).toBeGreaterThan(places[0]!.z)
    expect(places[0]!.x + places[4]!.x).toBeCloseTo(0)
    expect(places[5]!.x + places[8]!.x).toBeCloseTo(0)
    // left to right, by value
    for (const row of [places.slice(0, 5), places.slice(5)]) for (let i = 1; i < row.length; i++) expect(row[i]!.x).toBeGreaterThan(row[i - 1]!.x)
  })

  it("makes each of the nine faces big enough to press, and to know by its picture: at least half of a card of the table", () => {
    for (const place of guessPlaces()) expect(place.width).toBeGreaterThanOrEqual(CARD.width * 0.5)
    expect(STRIP.guess.scale).toBeGreaterThanOrEqual(0.5)
  })

  it("puts Swap and Keep side by side, a gap apart, and the single pad in the middle", () => {
    const [swap, keep] = pairPlaces()
    expect(swap.x).toBeLessThan(0)
    expect(keep.x).toBeGreaterThan(0)
    expect(keep.x - swap.x - swap.width).toBeGreaterThan(0)
    expect(padPlace().x).toBe(0)
  })

  it("keeps the sentence above the pads", () => {
    for (const pad of [padPlace(), ...pairPlaces(), ...guessPlaces()]) expect(STRIP.sentence.z + STRIP.sentence.height / 2).toBeLessThanOrEqual(pad.z - pad.depth / 2 + 1e-9)
  })

  it("fits a sentence in its width: on one line when it is short, on two when it is long, smaller when two lines do not fit, and never more than the height it is given", () => {
    const wide = STRIP.sentence.width
    const one = fitSentence("Choose a card", wide, 0.42)
    expect(one.lines).toEqual(["Choose a card"])
    expect(one.height).toBeCloseTo(0.42)
    const two = fitSentence("Choose a player, yourself included", wide, 0.42)
    expect(two.lines).toHaveLength(2)
    expect(two.lines.join(" ")).toBe("Choose a player, yourself included")
    for (const line of two.lines) expect(Array.from(line).length * 0.58 * two.height).toBeLessThanOrEqual(wide + 1e-9)
    const long = fitSentence("Nobody can be chosen: the card is played with no effect at all, whatever it is", wide, 0.42)
    expect(long.lines).toHaveLength(2)
    expect(long.height).toBeLessThan(0.42)
    expect(long.height).toBeGreaterThanOrEqual(0.21)
    expect(fitSentence("", wide, 0.42).lines).toEqual([])
    expect(fitSentence("Unbroken", wide, 0.42).lines).toEqual(["Unbroken"])
  })

  it("sets a sentence by the width of the letters of its font when it is measured: a narrow font keeps on one line what a broad one breaks into two", () => {
    const wide = STRIP.sentence.width
    const narrow = (text: string) => Array.from(text).length * 0.42
    const broad = (text: string) => Array.from(text).length * 0.7
    const sentence = "Choose a card to play"
    expect(fitSentence(sentence, wide, 0.42, narrow).lines).toEqual([sentence])
    expect(fitSentence(sentence, wide, 0.42, narrow).height).toBeCloseTo(0.42)
    const two = fitSentence(sentence, wide, 0.42, broad)
    expect(two.lines).toHaveLength(2)
    expect(two.lines.join(" ")).toBe(sentence)
    for (const line of two.lines) expect(broad(line) * two.height).toBeLessThanOrEqual(wide + 1e-9)
    // the break leaves the two lines most alike in width, not in letters
    const uneven = (text: string) => Array.from(text).reduce((width, letter) => width + (letter === "W" ? 3 : 1), 0)
    expect(fitSentence("WWWW a b c d e f g", 1, 1, uneven).lines).toEqual(["WWWW", "a b c d e f g"])
    expect(fitSentence("WWWW a b c d e f g", 1, 1).lines).toEqual(["WWWW a b", "c d e f g"])
  })
})

describe("what the camera has to bring into the window", () => {
  it("is the corners of what is seen, and of every zone", () => {
    for (const n of SIZES) expect(tableQuads(n)).toHaveLength(seenBoxes(n).length + n)
  })

  it("is the same on both sides of the middle line for what is in the middle band, so that the scene stays in the middle of the window", () => {
    for (const n of SIZES) {
      const middle = seenBoxes(n).slice(-2 * middleBoxes(n === 2).length)
      const xs = middle.flatMap((box) => cornersOf(box).map((corner) => corner.x))
      expect(Math.min(...xs) + Math.max(...xs), `${n} players`).toBeCloseTo(0)
    }
  })

  it("leaves out an opponent's hand, which the zone of its seat holds, and keeps the viewer's", () => {
    for (const n of SIZES) expect(seenBoxes(n)).toHaveLength(2 * n + 1 + 2 * middleBoxes(n === 2).length)
  })
})

/** Whether a point of the table is inside a turned box */
function pointIn(box: Box, point: { x: number; z: number }): boolean {
  const along = { x: Math.cos(box.yaw), z: -Math.sin(box.yaw) }
  const out = { x: Math.sin(box.yaw), z: Math.cos(box.yaw) }
  const dx = point.x - box.x
  const dz = point.z - box.z
  return Math.abs(dx * along.x + dz * along.z) <= box.halfWidth + 1e-9 && Math.abs(dx * out.x + dz * out.z) <= box.halfDepth + 1e-9
}
