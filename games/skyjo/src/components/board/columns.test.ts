import type { CardFace, PublicCell } from "@skyjo/engine"
import { Vector3 } from "three"
import { describe, expect, it } from "vitest"
import { flightAt, flightOf, removalSequence, restoredCells, shownColumns, STACK, stackAt, stackPlan, stackPoses, type Vec } from "./columns"
import { cellSpot, chairsOf, columnSpot, landingOn, pitchOf, seatsOf, WHOLE_GRID } from "./layout"
import { type Removal, removalTiming } from "./pacing"

const face = (id: number, type = "card-5"): CardFace => ({ id, type })
const up = (id: number): PublicCell => ({ up: true, card: face(id) })
const down: PublicCell = { up: false }
/** The cells of a grid from its four columns, each a column of three cells or `null` for a column that was thrown away */
const grid = (...columns: (PublicCell[] | null)[]): PublicCell[] => columns.flatMap((column) => column ?? [null, null, null])
const column = (cell: PublicCell): PublicCell[] => [cell, cell, cell]

describe("the columns a grid lays out", () => {
  it("are the four of a whole grid", () => {
    expect(shownColumns(grid(column(down), column(down), column(down), column(down)))).toEqual([0, 1, 2, 3])
    expect(WHOLE_GRID).toEqual([0, 1, 2, 3])
  })

  it("leave out a column that was thrown away, which has no cell in the view, and keep the others in order", () => {
    expect(shownColumns(grid(column(down), null, column(up(1)), column(down)))).toEqual([0, 2, 3])
    expect(shownColumns(grid(null, null, column(up(1)), null))).toEqual([2])
    expect(shownColumns(grid(null, null, null, null))).toEqual([])
  })

  it("keep the room of a column that is on its way: until the grid has closed over it, it is still laid out", () => {
    const cells = grid(column(down), null, column(down), column(down))
    expect(shownColumns(cells, [1])).toEqual([0, 1, 2, 3])
    expect(shownColumns(cells, [])).toEqual([0, 2, 3])
    // two columns, one of them closed: only the other keeps its room
    expect(shownColumns(grid(null, column(down), null, column(down)), [2])).toEqual([1, 2, 3])
  })

  it("give back the three cells of a column thrown away, face up, as they lay in the grid", () => {
    const cards = [face(10), face(11), face(12)]
    expect(restoredCells({ column: 2, cards })).toEqual([
      { cell: { up: true, card: cards[0] }, position: 6 },
      { cell: { up: true, card: cards[1] }, position: 7 },
      { cell: { up: true, card: cards[2] }, position: 8 },
    ])
  })
})

describe("the place of a column", () => {
  const scale = 0.5

  it("is the same as it always was in a whole grid: four columns a pitch apart, centred on the axis of the seat", () => {
    const { x } = pitchOf(scale)
    expect(WHOLE_GRID.map((c) => columnSpot(c, scale))).toEqual([-1.5 * x, -0.5 * x, 0.5 * x, 1.5 * x])
    expect(cellSpot(7, scale)).toEqual({ x: columnSpot(2, scale), z: 0 })
  })

  it("closes over a column that was thrown away: the columns left are a pitch apart and centred, whichever column went", () => {
    const { x } = pitchOf(scale)
    for (const gone of WHOLE_GRID) {
      const shown = WHOLE_GRID.filter((c) => c !== gone)
      const places = shown.map((c) => columnSpot(c, scale, shown))
      expect(places).toEqual([-x, 0, x])
      // centred, and no two closer than a pitch
      expect(places.reduce((sum, place) => sum + place, 0)).toBeCloseTo(0)
    }
    // the first column that goes: the three others slide half a pitch toward it, and the last one that goes sends the three others half a pitch the other way
    expect(columnSpot(1, scale, [1, 2, 3]) - columnSpot(1, scale)).toBeCloseTo(-0.5 * x)
    expect(columnSpot(2, scale, [0, 1, 2]) - columnSpot(2, scale)).toBeCloseTo(0.5 * x)
    // the column in the middle: the columns at the sides slide in half a pitch each, toward the gap
    expect(columnSpot(0, scale, [0, 2, 3]) - columnSpot(0, scale)).toBeCloseTo(0.5 * x)
    expect(columnSpot(2, scale, [0, 2, 3]) - columnSpot(2, scale)).toBeCloseTo(-0.5 * x)
    expect(columnSpot(3, scale, [0, 2, 3]) - columnSpot(3, scale)).toBeCloseTo(-0.5 * x)
  })

  it("is what remains of two columns thrown away at once: two columns, centred, a pitch apart", () => {
    const { x } = pitchOf(scale)
    expect([1, 3].map((c) => columnSpot(c, scale, [1, 3]))).toEqual([-0.5 * x, 0.5 * x])
    expect(columnSpot(2, scale, [2])).toBeCloseTo(0)
  })

  it("keeps every cell where its row says, and never lets two cells of a grid touch, for any columns laid out", () => {
    const { x, z } = pitchOf(scale)
    const card = { width: 1.2 * scale, height: 1.93 * scale }
    for (let mask = 1; mask < 16; mask++) {
      const shown = WHOLE_GRID.filter((c) => mask & (1 << c))
      const cells = shown.flatMap((c) => [0, 1, 2].map((row) => cellSpot(c * 3 + row, scale, shown)))
      for (let i = 0; i < cells.length; i++) {
        for (let j = i + 1; j < cells.length; j++) {
          expect(Math.abs(cells[i]!.x - cells[j]!.x) >= x - 1e-9 || Math.abs(cells[i]!.z - cells[j]!.z) >= z - 1e-9, `${shown} ${i} ${j}`).toBe(true)
          expect(Math.abs(cells[i]!.x - cells[j]!.x) >= card.width || Math.abs(cells[i]!.z - cells[j]!.z) >= card.height, `${shown} ${i} ${j}`).toBe(true)
        }
      }
    }
  })
})

describe("the film of a move that throws columns away", () => {
  const removal = (at: number, timing = removalTiming(1)): Removal => ({ player: "ana", column: 1, cards: [face(1), face(2), face(3)], at, timing })

  it("starts with every column where it lay, and ends with every one landed and the gap closed", () => {
    const { start, final } = removalSequence(7, [removal(0), removal(2)])
    expect(start).toEqual({ v: 7, stages: ["waiting", "waiting"], closed: [false, false] })
    expect(final).toEqual({ v: 7, stages: ["landed", "landed"], closed: [true, true] })
    expect(removalSequence(7, [])).toEqual({ start: { v: 7, stages: [], closed: [] }, final: { v: 7, stages: [], closed: [] }, steps: [] })
  })

  it("takes a column through its parts in order: it gathers after being read, the stack sets out, the gap closes while it flies, and it lands", () => {
    const timing = removalTiming(1)
    const { steps } = removalSequence(3, [removal(0.8, timing)])
    const gathering = 0.8 + timing.hold
    const travelling = gathering + timing.gather
    expect(steps.map(([ms]) => ms)).toEqual([gathering, travelling, travelling + timing.closeAt, travelling + timing.travel].map((s) => Math.round(s * 1000)))
    expect(steps.map(([, patch]) => [patch.stages?.[0], patch.closed?.[0]])).toEqual([
      ["gathering", false],
      ["travelling", false],
      ["travelling", true],
      ["landed", true],
    ])
    // the column is over when its timing says: the gap closes within the time the stack flies, so the last part is the landing
    expect(0.8 + timing.total).toBeCloseTo(travelling + Math.max(timing.travel, timing.closeAt + timing.close))
  })

  it("plays the columns of a move one after the other: the next does not gather before the one before has landed and closed", () => {
    const timing = removalTiming(2)
    const first = removal(0, timing)
    const second = removal(timing.total, timing)
    const { steps } = removalSequence(1, [first, second])
    const at = (k: number, what: (patch: { stages?: string[]; closed?: boolean[] }) => boolean) => steps.find(([, patch]) => what(patch))![0] / 1000
    // the first has landed, and its gap is closed, no later than the second gathers
    expect(at(0, (p) => p.stages?.[0] === "landed")).toBeLessThanOrEqual(timing.total + 1e-9 + timing.hold)
    expect(at(1, (p) => p.stages?.[1] === "gathering")).toBeCloseTo(timing.total + timing.hold)
    // a step is a complete picture of every column, so that what a step leaves out does not go back
    const last = steps.at(-1)![1]
    expect(last).toEqual({ stages: ["landed", "landed"], closed: [true, true] })
    for (const [, patch] of steps) expect(patch.stages).toHaveLength(2)
  })

  it("orders its steps by time whatever order the columns were listed in", () => {
    const { steps } = removalSequence(1, [removal(2), removal(0)])
    const times = steps.map(([ms]) => ms)
    expect(times).toEqual([...times].sort((a, b) => a - b))
  })
})

describe("the stack of a column", () => {
  it("lies on the slot of the middle row of the column, the three cards one over the other, the first row on top", () => {
    for (const shown of [WHOLE_GRID, [0, 2, 3], [2]]) {
      const poses = stackPoses(2, 0.6, shown)
      expect(poses).toHaveLength(3)
      for (const pose of poses) {
        expect(pose.position.x).toBeCloseTo(columnSpot(2, 0.6, shown))
        expect(pose.position.z).toBeCloseTo(0)
        expect(pose.scale).toBe(0.6)
      }
      // the first row is the top of the stack (`cards[0]` is the top of the discard once they have landed), the last row the bottom
      const heights = poses.map((pose) => pose.position.y)
      expect(heights[0]!).toBeGreaterThan(heights[1]!)
      expect(heights[1]!).toBeGreaterThan(heights[2]!)
      expect(heights[0]! - heights[2]!).toBeCloseTo(2 * STACK.step)
    }
  })
})

describe("the flight of a stack", () => {
  const at = (flight: ReturnType<typeof flightOf>, e: number) => {
    const out = { x: 0, y: 0, z: 0, yaw: 0, scale: 1 }
    flightAt(flight, e, out)
    return out
  }
  const start: Vec = { x: -3, y: 0.1, z: 5 }
  const end: Vec = { x: 1.23, y: 0.07, z: -0.03 }

  it("sets out from where the stack forms, lands where it says, turns to face as the discard does and grows to the size of its cards", () => {
    const flight = flightOf(start, end, { yaw: Math.PI / 2, scaleFrom: 0.5, scaleTo: 0.818 })
    const set = at(flight, 0)
    expect(set).toMatchObject({ x: start.x, y: start.y, z: start.z, scale: 1 })
    expect(set.yaw).toBeCloseTo(0)
    const landed = at(flight, 1)
    expect(landed.x).toBeCloseTo(end.x)
    expect(landed.y).toBeCloseTo(end.y)
    expect(landed.z).toBeCloseTo(end.z)
    // a stack that faced a quarter turn one way is turned the quarter turn back: it faces the way the table's own cards do
    expect(landed.yaw).toBeCloseTo(-Math.PI / 2)
    expect(landed.scale).toBeCloseTo(0.818 / 0.5)
  })

  it("rises on the way, by about as much as a card's flight over the same distance, and is highest in the middle of it", () => {
    const flight = flightOf(start, end, { yaw: 0, scaleFrom: 0.5, scaleTo: 0.818 })
    const heights = [0, 0.25, 0.5, 0.75, 1].map((e) => at(flight, e).y)
    expect(Math.max(...heights)).toBeGreaterThan(start.y + 0.5)
    expect(heights[2]!).toBeGreaterThan(heights[0]!)
    expect(heights[2]!).toBeGreaterThan(heights[4]!)
    // it never goes under the table
    for (let k = 0; k <= 20; k++) expect(at(flight, k / 20).y).toBeGreaterThan(0)
  })

  it("makes progress along the way all the time: nearer the end the later it is", () => {
    const flight = flightOf(start, end, { yaw: 0, scaleFrom: 0.5, scaleTo: 0.818 })
    let before = Infinity
    for (let k = 0; k <= 20; k++) {
      const place = at(flight, k / 20)
      const left = Math.hypot(place.x - end.x, place.z - end.z)
      expect(left).toBeLessThanOrEqual(before + 1e-9)
      before = left
    }
  })

  it("turns the shorter way for a seat across the table: a half turn, whichever the sign of its yaw", () => {
    expect(Math.abs(flightOf(start, end, { yaw: Math.PI, scaleFrom: 1, scaleTo: 1 }).turn)).toBeCloseTo(Math.PI)
    expect(flightOf(start, end, { yaw: 2 * Math.PI + 0.3, scaleFrom: 1, scaleTo: 1 }).turn).toBeCloseTo(-0.3)
  })
})

describe("a stack at every seat of every table", () => {
  const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i}`)
  /** Where a stack lands at a table of `chairs` chairs: the discard, whose cards are as big as every card of the table */
  const landingOf = (chairs: number) => landingOn(0.07, chairs)

  /** Where a card of a stack is when the stack has landed, and which way its top edge points on the table, as a turn about the vertical axis: 0 is away from the viewer */
  function landedCard(plan: ReturnType<typeof stackPlan>, row: number) {
    const pose = stackAt(plan, 1)[row]!
    const edge = new Vector3(0, 1, 0).applyQuaternion(pose.quaternion)
    return { position: pose.position, yaw: Math.atan2(-edge.x, -edge.z), scale: pose.scale }
  }

  it("is where it formed when it sets out, and keeps its three cards one over the other on the way: the same place, the first row always on top", () => {
    const seat = seatsOf(ids(5), "p0").get("p2")!
    const plan = stackPlan(seat, 1, WHOLE_GRID, landingOf(5))
    const start = stackAt(plan, 0)
    plan.poses.forEach((pose, row) => {
      expect(start[row]!.position.distanceTo(pose.position)).toBeLessThan(1e-9)
      expect(start[row]!.quaternion.angleTo(pose.quaternion)).toBeLessThan(1e-6)
      expect(start[row]!.scale).toBeCloseTo(pose.scale)
    })
    for (let k = 0; k <= 20; k++) {
      const [top, middle, bottom] = stackAt(plan, k / 20)
      expect(top!.position.x).toBeCloseTo(bottom!.position.x)
      expect(top!.position.z).toBeCloseTo(bottom!.position.z)
      expect(middle!.position.x).toBeCloseTo(bottom!.position.x)
      expect(top!.position.y).toBeGreaterThan(middle!.position.y)
      expect(middle!.position.y).toBeGreaterThan(bottom!.position.y)
    }
  })

  it("sets out from the middle row of the column and lands on the discard, the cards one over the other, facing as the discard does, at the scale of its cards, which is the scale of the cards it left: the stack does not grow on the way", () => {
    for (const seated of [true, false]) {
      for (const n of [2, 3, 4, 5, 6, 7, 8]) {
        const landing = landingOf(chairsOf(n, seated))
        const placed = seatsOf(ids(n), seated ? "p0" : null)
        for (const id of ids(n)) {
          const seat = placed.get(id)!
          for (const gone of WHOLE_GRID) {
            const shown = WHOLE_GRID
            const plan = stackPlan(seat, gone, shown, landing)
            const label = `${n} players${seated ? "" : ", spectator"}, ${id}, column ${gone}`
            expect(plan.flight.grow, label).toBeCloseTo(1, 9)
            // the stack is on the slot of the middle row of its column, wherever the seat is and however it is turned
            const middle = cellSpot(gone * 3 + 1, seat.scale, shown)
            const centre = { x: seat.frame.x + middle.x * Math.cos(seat.frame.yaw) + middle.z * Math.sin(seat.frame.yaw), z: seat.frame.z - middle.x * Math.sin(seat.frame.yaw) + middle.z * Math.cos(seat.frame.yaw) }
            for (const pose of plan.poses) {
              expect(pose.position.x, label).toBeCloseTo(centre.x)
              expect(pose.position.z, label).toBeCloseTo(centre.z)
            }
            for (let row = 0; row < 3; row++) {
              const there = landedCard(plan, row)
              expect(there.position.x, label).toBeCloseTo(landing.x)
              expect(there.position.z, label).toBeCloseTo(landing.z)
              expect(there.scale, label).toBeCloseTo(landing.scale)
              expect(Math.abs(there.yaw), label).toBeLessThanOrEqual(STACK.lean + 1e-6)
              // the first row is on top: the stack lands in the order the cards lie on the discard
              if (row > 0) expect(there.position.y, label).toBeLessThan(landedCard(plan, row - 1).position.y)
            }
            // the bottom card lands on the height it was asked to, which the pile is built to
            expect(landedCard(plan, 2).position.y, label).toBeCloseTo(landing.y)
          }
        }
      }
    }
  })
})
