import { aspectScale, boxesOverlap, FACE_DOWN, frameBoxOfPoses, HELD_FAN_SETTINGS, inFrame, placeCamera, plateBoxOf, pointInFrame, polygonsOverlap, SCREEN_HAND_SETTINGS, SEAT_SETTINGS, screenHandLayout, screenViewOf, type Pose } from "@pbgo/table"
import { PerspectiveCamera, Vector3 } from "three"
import { describe, expect, it } from "vitest"
import { CAMERA, fitFor } from "./camera"
import { areaGap, areaOf, areaPoses, ASIDE_FACE_UP, asideBox, asidePoses, CARD, cardScaleOf, chairsOf, columnPoses, columnSizes, columnsBox, controlBoxes, dealPlace, dealtFrom, HAND_MAX, HAND_SETTINGS, heldFrom, heldLayout, heldShadowOf, LAYOUT_SETTINGS, lineOf, lines, MIDDLE, middleBoxes, quadOf, reachQuads, revealedPoses, revealPoses, seats, seenQuads, tableLines, VIEW_TILT } from "./layout"

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
      const box = frameBoxOfPoses(heldLayout(n, seat, 4), CARD, seat, { tilt: VIEW_TILT })!
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
      const from = heldFrom(seat, 3, 6)
      const poses = heldLayout(3, seat, 6).map((pose) => inFrame(seat, pose))
      // the first or the last card of the fan, in the world: which of the two is on the viewer's left depends on the way the seat is turned
      const ends = [poses[0]!, poses[2]!]
      expect(ends.some((end) => Math.hypot(end.position.x - from.position.x, end.position.z - from.position.z) < 1e-6), id).toBe(true)
    }
  })

  it("has a round shadow under a hand that is the size of its fan: no smaller than its footprint and not much larger", () => {
    for (const chairs of [2, 4, 6]) {
      for (let n = 1; n <= HAND_MAX; n++) {
        const half = ((n - 1) * HELD_FAN_SETTINGS.gap + CARD.width * cardScaleOf(chairs)) / 2
        expect(heldShadowOf(chairs).radius(n) / half, `a hand of ${n}, ${chairs} chairs`).toBeGreaterThan(0.9)
        expect(heldShadowOf(chairs).radius(n) / half, `a hand of ${n}, ${chairs} chairs`).toBeLessThan(1.75)
      }
    }
  })

  it("holds cards of the size of every card of the table, whatever the table", () => {
    for (const chairs of [2, 3, 4, 5, 6]) {
      const seat = seats(ids(chairs), "p0").get("p1")!
      for (let n = 1; n <= HAND_MAX; n++) for (const pose of heldLayout(n, seat, chairs)) expect(pose.scale, `${chairs} chairs`).toBeCloseTo(cardScaleOf(chairs), 9)
      expect(heldFrom(seat, 2, chairs).scale, `${chairs} chairs`).toBeCloseTo(cardScaleOf(chairs), 9)
    }
  })
})

/** What is on the table of `count` players as polygons on it, by what it is: for every seat its plate, its play area and its hand, for an opponent, the room of its press, and the middle of the table */
function shapes(count: number, seated: boolean) {
  const all = tableLines(count, seated)
  const middle = middleBoxes(count === 2, chairsOf(count, seated)).map((box, i) => ({ what: `the middle ${i}`, shape: quadOf(box, { x: 0, z: 0, yaw: 0 }) }))
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

  it("keeps the boxes of the middle clear of one another: the deck with its count, the cards set aside, the columns and the Deal button", () => {
    const over: string[] = []
    for (const chairs of [2, 3, 4, 5, 6]) {
      // the three cards set aside face up are there at a table of two players, which a spectator sees as three chairs
      const boxes = middleBoxes(chairs <= 3, chairs)
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) if (boxesOverlap(boxes[i]!, boxes[j]!)) over.push(`${i} and ${j}, ${chairs} chairs`)
    }
    expect(over).toEqual([])
  })

  it("holds the Deal button and the faces of a reveal inside the room of the controls", () => {
    const { deal, reveal } = controlBoxes()
    const inside = (box: { minX: number; maxX: number; minZ: number; maxZ: number }, x: number, z: number, width: number, depth: number) => {
      expect(x - width / 2).toBeGreaterThanOrEqual(box.minX - 1e-9)
      expect(x + width / 2).toBeLessThanOrEqual(box.maxX + 1e-9)
      expect(z - depth / 2).toBeGreaterThanOrEqual(box.minZ - 1e-9)
      expect(z + depth / 2).toBeLessThanOrEqual(box.maxZ + 1e-9)
    }
    const pad = dealPlace()
    inside(deal, pad.x, pad.z, pad.width, pad.depth)
    for (const count of [1, 2]) for (const pose of revealPoses(count)) inside(reveal, pose.position.x, pose.position.z, CARD.width * MIDDLE.reveal.scale, CARD.height * MIDDLE.reveal.scale)
  })

  it("lays no copy of the cards below them: the characters a Guard can name are not on the table", () => {
    expect(Object.keys(MIDDLE)).not.toContain("guess")
    expect(Object.keys(controlBoxes())).toEqual(["deal", "reveal"])
  })
})

describe("the columns of the cards in the middle", () => {
  const deck = () => middleBoxes(false)[0]!
  const widthOf = (chairs?: number) => CARD.width * columnSizes([1], chairs).scale
  /** The counts of every table of columns the middle can hold, from one column of one card to ten columns, the tallest of up to six cards */
  const roundsOf = () => Array.from({ length: 10 }, (_, i) => i + 1).flatMap((columns) => [1, 2, 3, 4, 5, 6].map((tallest) => Array.from({ length: columns }, (_, column) => (column === columns - 1 ? tallest : 1))))

  it("has a slot for each card, none for none", () => {
    expect(columnPoses([])).toEqual([])
    for (const counts of [[1], [2, 4, 1], [1, 1, 1, 1, 1, 1, 1, 1, 1, 1], [2, 6, 2, 2, 2, 2, 2, 1, 1, 1]]) expect(columnPoses(counts)).toHaveLength(counts.reduce((sum, count) => sum + count, 0))
  })

  it("lays the columns from the left to the right, one for each value that has a card, the first card of each as high as the deck, side by side with a gap and no card over the next column", () => {
    for (const chairs of [2, 6]) {
      const counts = [2, 4, 2, 1, 2]
      const poses = columnPoses(counts, chairs)
      const firsts = counts.map((_, column) => poses[counts.slice(0, column).reduce((sum, count) => sum + count, 0)]!)
      firsts.forEach((pose, column) => {
        expect(pose.position.z - (CARD.height * pose.scale) / 2, `column ${column}, ${chairs} chairs`).toBeCloseTo(deck().minZ + (chairs === 2 ? 0 : 0) * 0 + (middleBoxes(false, chairs)[0]!.minZ - deck().minZ), 9)
        if (column > 0) expect(pose.position.x - firsts[column - 1]!.position.x, `column ${column}, ${chairs} chairs`).toBeCloseTo(widthOf(chairs) * (1 + MIDDLE.columns.gap), 9)
      })
      // the copies of a column stand on its axis: no card leans into the next column
      let index = 0
      counts.forEach((count, column) => {
        for (let copy = 0; copy < count; copy++) expect(poses[index++]!.position.x, `column ${column}, ${chairs} chairs`).toBeCloseTo(firsts[column]!.position.x, 9)
      })
    }
  })

  it("cascades the copies of a column down, each a share of its height below the one before and a hair higher, so that the last one played is whole at the foot", () => {
    const counts = [1, 5, 2]
    const poses = columnPoses(counts)
    const { scale, step } = columnSizes(counts)
    const guards = poses.slice(1, 6)
    guards.forEach((pose, copy) => {
      expect(pose.position.z - guards[0]!.position.z, `copy ${copy}`).toBeCloseTo(copy * step * CARD.height * scale, 9)
      if (copy > 0) expect(pose.position.y).toBeGreaterThan(guards[copy - 1]!.position.y)
    })
    // a copy shows its banner and its value above the next one: the share it lies down is more than the banner's
    expect(step).toBeGreaterThanOrEqual(MIDDLE.columns.stepMin)
    expect(MIDDLE.columns.stepMax).toBeGreaterThan(0.2)
  })

  it("closes the cascade up as the tallest column grows, never below the least and never past the most, and lays the copies of a short column the most apart", () => {
    for (const chairs of [2, 6]) {
      let last = Infinity
      for (let tallest = 1; tallest <= 6; tallest++) {
        const { step } = columnSizes([1, tallest, 1], chairs)
        expect(step, `${tallest} cards, ${chairs} chairs`).toBeGreaterThanOrEqual(MIDDLE.columns.stepMin - 1e-9)
        expect(step, `${tallest} cards, ${chairs} chairs`).toBeLessThanOrEqual(MIDDLE.columns.stepMax + 1e-9)
        expect(step, `${tallest} cards, ${chairs} chairs`).toBeLessThanOrEqual(last + 1e-9)
        last = step
      }
      expect(columnSizes([1, 2, 1], chairs).step).toBe(MIDDLE.columns.stepMax)
    }
  })

  it("centres the block of columns on the table while it has the room for that, and keeps to the side of the deck past it", () => {
    for (const chairs of [2, 6]) {
      const { minX: left, maxX: right } = columnsBox(chairs)
      for (let columns = 1; columns <= 10; columns++) {
        const counts = Array.from({ length: columns }, () => 1)
        const width = widthOf(chairs)
        const xs = columnPoses(counts, chairs).map((pose) => pose.position.x)
        const first = xs[0]! - width / 2
        const last = xs[xs.length - 1]! + width / 2
        const label = `${columns} columns, ${chairs} chairs`
        expect(first, label).toBeGreaterThanOrEqual(left - 1e-9)
        expect(last, label).toBeLessThanOrEqual(right + 1e-9)
        // centred when it can be: the middle of the block is the middle of the table
        if (first > left + 1e-9 && last < right - 1e-9) expect((first + last) / 2, label).toBeCloseTo(0, 9)
        // else it is pushed against the side of its room
        else expect(first <= left + 1e-9 || last >= right - 1e-9, label).toBe(true)
      }
    }
  })

  it("keeps the columns a card's width and a gap apart while the room allows it, closes them up as they are many, and never lets one lie over the next", () => {
    for (const chairs of [2, 3, 4, 5, 6]) {
      const width = widthOf(chairs)
      let last = Infinity
      for (let columns = 2; columns <= 10; columns++) {
        const { pitch } = columnSizes(Array.from({ length: columns }, () => 1), chairs)
        expect(pitch, `${columns} columns, ${chairs} chairs`).toBeGreaterThanOrEqual(width - 1e-9)
        expect(pitch, `${columns} columns, ${chairs} chairs`).toBeLessThanOrEqual(width * (1 + MIDDLE.columns.gap) + 1e-9)
        expect(pitch, `${columns} columns, ${chairs} chairs`).toBeLessThanOrEqual(last + 1e-9)
        last = pitch
      }
      // the usual gap holds up to the eight columns that a round has all but never, at every table
      expect(columnSizes(Array.from({ length: 8 }, () => 1), chairs).pitch, `${chairs} chairs`).toBeCloseTo(width * (1 + MIDDLE.columns.gap), 9)
    }
  })

  it("never leaves its box, whatever the round and the table: the cards of the widest and of the tallest columns end where the room ends, the cascade included", () => {
    for (const chairs of [2, 3, 4, 5, 6]) {
      const box = columnsBox(chairs)
      for (const counts of roundsOf()) {
        const { scale } = columnSizes(counts, chairs)
        const label = `${counts.join(",")}, ${chairs} chairs`
        for (const pose of columnPoses(counts, chairs)) {
          expect(pose.position.x - (CARD.width * scale) / 2, label).toBeGreaterThanOrEqual(box.minX - 1e-9)
          expect(pose.position.x + (CARD.width * scale) / 2, label).toBeLessThanOrEqual(box.maxX + 1e-9)
          expect(pose.position.z - (CARD.height * scale) / 2, label).toBeGreaterThanOrEqual(box.minZ - 1e-9)
          expect(pose.position.z + (CARD.height * scale) / 2, label).toBeLessThanOrEqual(box.maxZ + 1e-9)
        }
      }
    }
  })

  it("keeps every card where it is when a copy joins a column that is not the tallest: only the new card is added, and the others shift only when the columns change in number or the tallest in height", () => {
    const before = columnPoses([1, 3, 1])
    const after = columnPoses([2, 3, 1])
    const same = (a: Pose, b: Pose) => ["x", "z"].every((axis) => Math.abs(a.position[axis as "x" | "z"] - b.position[axis as "x" | "z"]) < 1e-9) && Math.abs(a.scale - b.scale) < 1e-9
    expect(same(before[0]!, after[0]!)).toBe(true)
    for (let copy = 0; copy < 3; copy++) expect(same(before[1 + copy]!, after[2 + copy]!), `guard ${copy}`).toBe(true)
    expect(same(before[4]!, after[5]!)).toBe(true)
  })

  it("has more room at a table of three chairs or fewer, where no seat stands at the sides of the middle", () => {
    expect(columnsBox(2).maxX).toBe(MIDDLE.columns.wideRight)
    expect(columnsBox(MIDDLE.columns.wideChairs).maxX).toBe(MIDDLE.columns.wideRight)
    expect(columnsBox(MIDDLE.columns.wideChairs + 1).maxX).toBe(MIDDLE.columns.right)
    expect(columnsBox(6).maxX).toBe(MIDDLE.columns.right)
    // the middle that a table is given is the one of its chairs: a spectator of three players sees the ring of four
    expect(middleBoxes(false, chairsOf(3, true))).toContainEqual(columnsBox(3))
    expect(middleBoxes(false, chairsOf(3, false))).toContainEqual(columnsBox(4))
  })

  it("has a box of its own among those of the middle, to the right of the deck, as high as it and clear of the Deal button below it", () => {
    for (const chairs of [2, 6]) {
      const box = columnsBox(chairs)
      expect(middleBoxes(false, chairs)).toContainEqual(box)
      const { deal } = controlBoxes()
      expect(deal.minZ).toBeGreaterThan(box.maxZ)
      expect(box.minX).toBeGreaterThan(middleBoxes(false, chairs)[0]!.maxX)
      expect(box.minZ).toBeCloseTo(CARD.height * cardScaleOf(chairs) * -0.5 + LAYOUT_SETTINGS.deckZ, 9)
    }
  })

  it("is the room the faces of a reveal lie over: they are inside the box of the columns", () => {
    const box = columnsBox()
    const { reveal } = controlBoxes()
    expect(reveal.minX).toBeGreaterThanOrEqual(box.minX)
    expect(reveal.maxX).toBeLessThanOrEqual(box.maxX)
    expect(reveal.minZ).toBeGreaterThanOrEqual(box.minZ)
    expect(reveal.maxZ).toBeLessThanOrEqual(box.maxZ)
  })
})

describe("the cards set aside", () => {
  const sizeOf = (chairs: number) => ({ width: CARD.width * cardScaleOf(chairs), height: CARD.height * cardScaleOf(chairs) })

  it("lie in one column on the left of the deck, a gap away from it and on one axis, the card face down as high as the deck and face down", () => {
    for (const chairs of [2, 3, 4, 5, 6]) {
      const label = `${chairs} chairs`
      const { width, height } = sizeOf(chairs)
      const { down, up } = asidePoses(ASIDE_FACE_UP, chairs)
      const deck = middleBoxes(false, chairs)[0]!
      expect(down.position.x + width / 2, label).toBeCloseTo(deck.minX - width * MIDDLE.aside.gap, 9)
      expect(down.position.z - height / 2, label).toBeCloseTo(deck.minZ, 9)
      expect(down.quaternion.angleTo(FACE_DOWN), label).toBeCloseTo(0, 9)
      for (const pose of up) expect(pose.position.x, label).toBeCloseTo(down.position.x, 9)
    }
  })

  it("lay the cards face up under the one face down: the first a gap below it, each of the others a share of its height below the one before and a hair higher, so that the banner of each is in sight and the last is whole at the foot", () => {
    for (const chairs of [2, 3]) {
      const label = `${chairs} chairs`
      const { height } = sizeOf(chairs)
      const { down, up } = asidePoses(ASIDE_FACE_UP, chairs)
      expect(up).toHaveLength(ASIDE_FACE_UP)
      expect(up[0]!.position.z - height / 2, label).toBeCloseTo(down.position.z + height / 2 + height * MIDDLE.aside.apart, 9)
      up.forEach((pose, i) => {
        if (i === 0) return
        expect(pose.position.z - up[i - 1]!.position.z, label).toBeCloseTo(MIDDLE.aside.step * height, 9)
        expect(pose.position.y, label).toBeGreaterThan(up[i - 1]!.position.y)
      })
      // a card shows its banner and its value above the next one: the share it lies down is more than the banner's, as in the columns of the cards that are done with
      expect(MIDDLE.aside.step).toBeGreaterThanOrEqual(MIDDLE.columns.stepMax)
    }
  })

  it("have no slot for the cards face up where there are none, and the box of the column is then one card tall", () => {
    for (const chairs of [2, 3, 4, 5, 6]) {
      const { height } = sizeOf(chairs)
      expect(asidePoses(0, chairs).up).toEqual([])
      const box = asideBox(0, chairs)
      expect(box.maxZ - box.minZ, `${chairs} chairs`).toBeCloseTo(height, 9)
    }
  })

  it("fit in the box that is kept for them, with or without the cards face up, which is clear of the deck on its right", () => {
    for (const chairs of [2, 3, 4, 5, 6]) {
      for (const faceUp of [0, ASIDE_FACE_UP]) {
        const label = `${chairs} chairs, ${faceUp} face up`
        const { width, height } = sizeOf(chairs)
        const box = asideBox(faceUp, chairs)
        const { down, up } = asidePoses(faceUp, chairs)
        for (const pose of [down, ...up]) {
          expect(pose.position.x - width / 2, label).toBeGreaterThanOrEqual(box.minX - 1e-9)
          expect(pose.position.x + width / 2, label).toBeLessThanOrEqual(box.maxX + 1e-9)
          expect(pose.position.z - height / 2, label).toBeGreaterThanOrEqual(box.minZ - 1e-9)
          expect(pose.position.z + height / 2, label).toBeLessThanOrEqual(box.maxZ + 1e-9)
        }
        // its foot is the foot of the last card
        expect(box.maxZ, label).toBeCloseTo([down, ...up].at(-1)!.position.z + height / 2, 9)
        expect(box.maxX, label).toBeLessThan(middleBoxes(false, chairs)[0]!.minX)
      }
    }
  })
})

describe("the cards that lie on the table", () => {
  it("are all of one size, as at a real table: the deck, the cards set aside, the columns, the play areas of the viewer and of the opponents, and the cards laid face up between two rounds", () => {
    for (const chairs of [2, 3, 4, 5, 6]) {
      const scale = cardScaleOf(chairs)
      const label = `${chairs} chairs`
      expect(areaOf(chairs, true).scale, label).toBe(scale)
      expect(areaOf(chairs, false).scale, label).toBe(scale)
      const { down, up } = asidePoses(ASIDE_FACE_UP, chairs)
      for (const pose of [down, ...up]) expect(pose.scale, label).toBe(scale)
      for (const pose of columnPoses([2, 5, 1, 1], chairs)) expect(pose.scale, label).toBe(scale)
      expect(columnSizes([1, 2, 3], chairs).scale, label).toBe(scale)
      expect(dealtFrom(chairs).scale, label).toBe(scale)
      const line = lineOf(seats(ids(chairs), "p0").get("p1")!, false, chairs)
      for (const pose of revealedPoses(2, line)) expect(pose.scale, label).toBe(scale)
      expect(middleBoxes(true, chairs)[0]!.maxX - middleBoxes(true, chairs)[0]!.minX, label).toBeCloseTo(CARD.width * scale, 9)
    }
  })

  it("are smaller as the table fills, in steps from the table of two to the table of six", () => {
    let last = Infinity
    for (const chairs of [2, 3, 4, 5, 6]) {
      expect(cardScaleOf(chairs)).toBeLessThanOrEqual(last + 1e-9)
      last = cardScaleOf(chairs)
    }
    expect(cardScaleOf(2)).toBeCloseTo(LAYOUT_SETTINGS.cardScale2, 9)
    expect(cardScaleOf(6)).toBeCloseTo(LAYOUT_SETTINGS.cardScale6, 9)
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

describe("the viewer's hand on the screen and the middle of the table", () => {
  it("never covers the deck, nor the cards set aside (the three face up at two players included), in any window, whatever the hand holds", () => {
    const over: string[] = []
    for (const { count } of TABLES.filter((table) => table.seated)) {
      const [deck, aside] = middleBoxes(count === 2, chairsOf(count, true))
      const shapes = { deck: deck!, "cards set aside": aside! }
      for (const aspect of ASPECTS) {
        const camera = cameraOf(count, aspect, true)
        const view = screenViewOf({ m00: camera.projectionMatrix.elements[0]!, m11: camera.projectionMatrix.elements[5]! }, HAND_SETTINGS.distance)
        for (const size of [1, 2, HAND_MAX]) {
          screenHandLayout(size, view, CARD, HAND_SETTINGS).forEach((pose, i) => {
            const card = cardOnScreen(camera, pose, true)
            for (const [name, box] of Object.entries(shapes)) if (overlaps(card, flatOnScreen(camera, quadOf(box, { x: 0, z: 0, yaw: 0 })))) over.push(`card ${i} of a hand of ${size} and the ${name}, ${count} players, aspect ${aspect}`)
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
      const cards = heldLayout(n, seat, 4)
      const left = Math.min(...cards.map((pose) => pose.position.x))
      const right = Math.max(...cards.map((pose) => pose.position.x))
      expect(right - left, `a hand of ${n}`).toBeLessThan((n - 1) * 0.4 + 0.1)
    }
  })

  it("lie on the table of every seat in the picture, whole, in every window, and so do they when they are picked: lifted by a quarter of a card's height and grown a tenth", () => {
    const outside: string[] = []
    // the look of a card that is picked (`selectedLift` and `selectedScale` of the kit's card states): it rises by a share of its own height and grows about its middle
    const picked = (pose: Pose): Pose => ({ ...pose, position: pose.position.clone().add(new Vector3(0, 0.25 * CARD.height * pose.scale, 0)), scale: pose.scale * 1.1 })
    for (const { count, seated } of TABLES) {
      for (const aspect of ASPECTS) {
        const camera = cameraOf(count, aspect, seated)
        for (const line of tableLines(count, seated)) {
          if (line.viewer) continue
          for (let n = 1; n <= HAND_MAX; n++) {
            heldLayout(n, line.seat, chairsOf(count, seated)).forEach((pose, i) => {
              for (const [look, shape] of [["held", (given: Pose) => given], ["picked", picked]] as const) {
                const shown = cardOnScreen(camera, shape(inFrame(line.seat, pose)))
                if (!shown.every((point) => Math.abs(point.x) < 1 && point.y < 1 && point.y > -1)) outside.push(`card ${i} of a hand of ${n}, ${look}, ${count} players${seated ? "" : ", spectator"}, aspect ${aspect}`)
              }
            })
          }
        }
      }
    }
    expect(outside).toEqual([])
  })
})

describe("what the camera is given", () => {
  it("is the plate and the play area of every seat and the middle, and a point for the mirror image of each of their corners: one quad each, and the area of each seat to reach with the hand of each opponent where it is seen", () => {
    for (const { count, seated } of TABLES) {
      const own = count * 2
      const middle = middleBoxes(count === 2).length
      expect(seenQuads(count, seated), where({ count, seated })).toHaveLength(5 * (own + middle))
      expect(reachQuads(count, seated), where({ count, seated })).toHaveLength(2 * count - (seated ? 1 : 0))
    }
  })

  it("reaches as far to the left as to the right at every depth, so that the camera stands across the table whatever the plates trail to, and counts no area the platform's boxes could cover for the points that make it so", () => {
    for (const { count, seated } of TABLES) {
      const quads = seenQuads(count, seated)
      const key = (point: { x: number; z: number }) => `${point.x.toFixed(6)},${point.z.toFixed(6)}`
      const points = new Set(quads.flat().map(key))
      for (const point of quads.flat()) expect(points.has(key({ x: -point.x, z: point.z })), where({ count, seated })).toBe(true)
      const shapes = count * 2 + middleBoxes(count === 2, chairsOf(count, seated)).length
      expect(quads.slice(0, shapes).every((quad) => quad.length === 4), where({ count, seated })).toBe(true)
      expect(quads.slice(shapes).every((quad) => quad.length === 1), where({ count, seated })).toBe(true)
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
