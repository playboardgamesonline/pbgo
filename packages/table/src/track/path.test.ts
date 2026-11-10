import { describe, expect, it } from "vitest"
import { inFrame } from "../layout"
import { onTable } from "../pose"
import { arcSpaces, lineSpaces, loopSpaces, pathSpaces, snakeSpaces, type Space, spacesIn } from "./path"

/** Where a thing that has this yaw looks along the table: yaw 0 looks along +x, and a quarter turn looks away from the viewer (-z) */
const heading = (yaw: number) => [Math.cos(yaw), -Math.sin(yaw)] as const
const towards = (from: Space, to: Space) => {
  const length = Math.hypot(to.x - from.x, to.z - from.z)
  return [(to.x - from.x) / length, (to.z - from.z) / length] as const
}
const dot = (a: readonly [number, number], b: readonly [number, number]) => a[0] * b[0] + a[1] * b[1]
/** The angle, in radians, between two directions */
const angleBetween = (a: readonly [number, number], b: readonly [number, number]) => Math.acos(Math.min(1, Math.max(-1, dot(a, b))))
/** The length of the curve of an ellipse between two angles: the sum of many short pieces */
function arcBetween(radiusX: number, radiusZ: number, from: number, to: number) {
  const pieces = 600
  let sum = 0
  for (let k = 0; k < pieces; k++) {
    const t = from + ((to - from) * (k + 0.5)) / pieces
    sum += Math.hypot(radiusX * Math.sin(t), radiusZ * Math.cos(t))
  }
  return Math.abs(((to - from) * sum) / pieces)
}
const angleOf = (space: Space, radiusX: number, radiusZ: number) => Math.atan2(space.z / radiusZ, space.x / radiusX)
/** The lengths of the curve between each space and the next, going the way the angle runs: `way` is +1 or -1, and `closed` has the last go back to the first */
function arcs(spaces: Space[], radiusX: number, radiusZ: number, way: 1 | -1, closed: boolean) {
  const turn = Math.PI * 2
  return spaces.flatMap((space, i) => {
    const next = spaces[i + 1] ?? (closed ? spaces[0] : undefined)
    if (!next) return []
    const a = angleOf(space, radiusX, radiusZ)
    // How far the angle runs to the next space, going the way it goes
    const delta = (angleOf(next, radiusX, radiusZ) - a) * way
    const run = way * (((delta % turn) + turn) % turn)
    return [arcBetween(radiusX, radiusZ, a, a + run)]
  })
}
const gaps = (spaces: Space[], closed = false) => spaces.map((space, i) => (i === spaces.length - 1 && !closed ? null : Math.hypot(spaces[(i + 1) % spaces.length]!.x - space.x, spaces[(i + 1) % spaces.length]!.z - space.z))).filter((gap): gap is number => gap !== null)

describe("lineSpaces", () => {
  it("lays the spaces along x, the first on the left, a gap apart, the track going to the right", () => {
    const spaces = lineSpaces(5, { gap: 1.5 })
    expect(spaces.map((space) => space.x)).toEqual([-3, -1.5, 0, 1.5, 3])
    expect(spaces.every((space) => space.z === 0 && space.yaw === 0)).toBe(true)
  })

  it("is centred whatever the count, even or odd", () => {
    for (const count of [1, 2, 7, 12]) expect(lineSpaces(count, { gap: 1 }).reduce((sum, space) => sum + space.x, 0)).toBeCloseTo(0, 12)
  })

  it("has no space for a count of zero, and refuses a count that is not a whole number", () => {
    expect(lineSpaces(0, { gap: 1 })).toEqual([])
    for (const bad of [-1, 1.5, Number.NaN]) expect(() => lineSpaces(bad, { gap: 1 }), String(bad)).toThrow(RangeError)
  })
})

describe("loopSpaces", () => {
  it("puts every space on the ellipse", () => {
    for (const [radiusX, radiusZ] of [
      [3, 3],
      [5, 2],
    ] as const) {
      for (const space of loopSpaces(24, { radiusX, radiusZ })) expect((space.x / radiusX) ** 2 + (space.z / radiusZ) ** 2).toBeCloseTo(1, 9)
    }
  })

  it("starts at the front, nearest the viewer, and goes clockwise seen from above: toward the left, then away", () => {
    const [first, second, third] = loopSpaces(12, { radiusX: 4, radiusZ: 2 })
    expect(first!.x).toBeCloseTo(0, 9)
    expect(first!.z).toBeCloseTo(2, 9)
    expect(second!.x).toBeLessThan(0)
    expect(third!.x).toBeLessThan(second!.x)
    expect(third!.z).toBeLessThan(first!.z)
  })

  it("goes the other way round when it is told to", () => {
    const [first, second] = loopSpaces(12, { radiusX: 4, radiusZ: 2, clockwise: false })
    expect(first!.z).toBeCloseTo(2, 9)
    expect(second!.x).toBeGreaterThan(0)
  })

  it("starts where it is told to: 0 is the right, a quarter turn the front", () => {
    expect(loopSpaces(8, { radiusX: 3, start: 0 })[0]).toMatchObject({ x: 3 })
    const back = loopSpaces(8, { radiusX: 3, start: -Math.PI / 2 })[0]!
    expect(back.x).toBeCloseTo(0, 9)
    expect(back.z).toBeCloseTo(-3, 9)
  })

  it("spaces them evenly along the curve, which is not an even angle on a long ellipse", () => {
    for (const [radiusX, radiusZ, count] of [
      [6, 2, 40],
      [3, 3, 24],
      [5, 3, 17],
    ] as const) {
      for (const clockwise of [true, false]) {
        const around = arcs(loopSpaces(count, { radiusX, radiusZ, clockwise }), radiusX, radiusZ, clockwise ? 1 : -1, true)
        expect(around).toHaveLength(count)
        const mean = around.reduce((sum, length) => sum + length, 0) / around.length
        for (const length of around) expect(Math.abs(length - mean) / mean, `${radiusX} by ${radiusZ}, ${count}`).toBeLessThan(0.002)
      }
    }
  })

  it("makes the chord of an even spacing equal on a circle", () => {
    const around = gaps(loopSpaces(24, { radiusX: 3 }), true)
    const mean = around.reduce((sum, gap) => sum + gap, 0) / around.length
    for (const gap of around) expect(Math.abs(gap - mean) / mean).toBeLessThan(1e-6)
  })

  it("faces each space the way the track goes: toward the next one, give or take half a step of the turn", () => {
    for (const clockwise of [true, false]) {
      // On a circle the way the track goes is off the way to the next space by half the angle between two spaces
      const circle = loopSpaces(60, { radiusX: 5, clockwise })
      circle.forEach((space, i) => expect(angleBetween(heading(space.yaw), towards(space, circle[(i + 1) % circle.length]!))).toBeCloseTo(Math.PI / 60, 6))
      const oval = loopSpaces(60, { radiusX: 5, radiusZ: 3, clockwise })
      oval.forEach((space, i) => expect(angleBetween(heading(space.yaw), towards(space, oval[(i + 1) % oval.length]!))).toBeLessThan(0.15))
    }
  })

  it("makes one space, or none", () => {
    expect(loopSpaces(1, { radiusX: 2 })).toHaveLength(1)
    expect(loopSpaces(0, { radiusX: 2 })).toEqual([])
  })

  it("refuses an ellipse with no room", () => {
    expect(() => loopSpaces(8, { radiusX: 0 })).toThrow(RangeError)
    expect(() => loopSpaces(8, { radiusX: 3, radiusZ: -1 })).toThrow(RangeError)
    expect(() => loopSpaces(-1, { radiusX: 3 })).toThrow(RangeError)
  })
})

describe("arcSpaces", () => {
  it("puts the first space at the first angle and the last at the last", () => {
    const spaces = arcSpaces(6, { radiusX: 4, radiusZ: 2, from: Math.PI, to: 2 * Math.PI })
    expect(spaces[0]!.x).toBeCloseTo(-4, 9)
    expect(spaces[0]!.z).toBeCloseTo(0, 9)
    expect(spaces[5]!.x).toBeCloseTo(4, 9)
    expect(spaces[5]!.z).toBeCloseTo(0, 9)
    // The far side of the table, between the two ends
    expect(spaces[2]!.z).toBeLessThan(-1)
  })

  it("spaces them evenly along the curve", () => {
    const spaces = arcSpaces(9, { radiusX: 5, radiusZ: 2, from: Math.PI, to: 2 * Math.PI })
    const around = arcs(spaces, 5, 2, 1, false)
    expect(around).toHaveLength(8)
    const mean = around.reduce((sum, length) => sum + length, 0) / around.length
    for (const length of around) expect(Math.abs(length - mean) / mean).toBeLessThan(0.002)
  })

  it("faces each space the way the track goes: toward the next one, give or take half a step of the turn", () => {
    // Seven spaces over a half circle are 30 degrees apart
    const spaces = arcSpaces(7, { radiusX: 3, from: Math.PI, to: 2 * Math.PI })
    spaces.slice(0, -1).forEach((space, i) => expect(angleBetween(heading(space.yaw), towards(space, spaces[i + 1]!))).toBeCloseTo(Math.PI / 12, 6))
  })

  it("goes the other way when the last angle is below the first, the track still going from the first space to the last", () => {
    const spaces = arcSpaces(5, { radiusX: 3, from: 2 * Math.PI, to: Math.PI })
    expect(spaces[0]!.x).toBeCloseTo(3, 9)
    expect(spaces[4]!.x).toBeCloseTo(-3, 9)
    // Five spaces over a half circle are 45 degrees apart
    spaces.slice(0, -1).forEach((space, i) => expect(angleBetween(heading(space.yaw), towards(space, spaces[i + 1]!))).toBeCloseTo(Math.PI / 8, 6))
  })

  it("makes one space, at the first angle, or none", () => {
    const [only] = arcSpaces(1, { radiusX: 3, from: 0, to: 1 })
    expect(only).toMatchObject({ x: 3, z: 0 })
    expect(arcSpaces(0, { radiusX: 3, from: 0, to: 1 })).toEqual([])
  })
})

describe("snakeSpaces", () => {
  const spaces = snakeSpaces(10, { columns: 4, gapX: 1, gapZ: 2 })

  it("goes along the first line from left to right, then back along the next, and so on", () => {
    expect(spaces.slice(0, 4).map((space) => space.x)).toEqual([-1.5, -0.5, 0.5, 1.5])
    expect(spaces.slice(4, 8).map((space) => space.x)).toEqual([1.5, 0.5, -0.5, -1.5])
    expect(spaces.slice(8).map((space) => space.x)).toEqual([-1.5, -0.5])
  })

  it("faces the way the track goes on each line", () => {
    expect(spaces.slice(0, 4).every((space) => space.yaw === 0)).toBe(true)
    expect(spaces.slice(4, 8).every((space) => space.yaw === Math.PI)).toBe(true)
  })

  it("starts with the line nearest the viewer by default, so the track climbs away from them, or with the farthest", () => {
    expect(spaces.map((space) => space.z)).toEqual([2, 2, 2, 2, 0, 0, 0, 0, -2, -2])
    expect(snakeSpaces(10, { columns: 4, gapX: 1, gapZ: 2, start: "far" }).map((space) => space.z)).toEqual([-2, -2, -2, -2, 0, 0, 0, 0, 2, 2])
  })

  it("keeps neighbours together: one space to the next is a gap along a line, a gap between lines at the end of one", () => {
    const steps = gaps(spaces)
    expect(steps.filter((gap) => Math.abs(gap - 1) < 1e-9)).toHaveLength(7)
    expect(steps.filter((gap) => Math.abs(gap - 2) < 1e-9)).toHaveLength(2)
  })

  it("starts a last line that goes leftward at its right", () => {
    expect(snakeSpaces(7, { columns: 4, gapX: 1, gapZ: 1 }).slice(4).map((space) => space.x)).toEqual([1.5, 0.5, -0.5])
  })

  it("refuses a line that holds no space", () => {
    expect(() => snakeSpaces(5, { columns: 0, gapX: 1, gapZ: 1 })).toThrow(RangeError)
    expect(() => snakeSpaces(5, { columns: 2.5, gapX: 1, gapZ: 1 })).toThrow(RangeError)
  })
})

describe("pathSpaces", () => {
  it("puts the spaces at the points and turns each toward the next", () => {
    const spaces = pathSpaces([
      { x: 0, z: 0 },
      { x: 2, z: 0 },
      { x: 2, z: -2 },
    ])
    expect(spaces.map(({ x, z }) => [x, z])).toEqual([
      [0, 0],
      [2, 0],
      [2, -2],
    ])
    expect(heading(spaces[0]!.yaw)[0]).toBeCloseTo(1, 12)
    expect(heading(spaces[1]!.yaw)[1]).toBeCloseTo(-1, 12)
  })

  it("turns the last toward where the one before it faces", () => {
    const spaces = pathSpaces([
      { x: 0, z: 0 },
      { x: 0, z: -3 },
    ])
    expect(spaces[1]!.yaw).toBe(spaces[0]!.yaw)
  })

  it("keeps the way it faced when two points are the same", () => {
    const spaces = pathSpaces([
      { x: 0, z: 0 },
      { x: 2, z: 0 },
      { x: 2, z: 0 },
      { x: 4, z: 0 },
    ])
    expect(spaces[2]!.yaw).toBeCloseTo(0, 12)
  })

  it("makes nothing from nothing, and a space that faces right from one point", () => {
    expect(pathSpaces([])).toEqual([])
    expect(pathSpaces([{ x: 1, z: 2 }])).toEqual([{ x: 1, z: 2, yaw: 0 }])
  })
})

describe("spacesIn", () => {
  it("moves the spaces where the frame is", () => {
    expect(spacesIn({ x: 5, z: -2 }, lineSpaces(3, { gap: 1 })).map(({ x, z }) => [x, z])).toEqual([
      [4, -2],
      [5, -2],
      [6, -2],
    ])
  })

  it("puts them where inFrame puts a card of the same frame", () => {
    const frame = { x: 3, z: 1.5, yaw: 0.7 }
    for (const space of loopSpaces(9, { radiusX: 3, radiusZ: 2 })) {
      const [placed] = spacesIn(frame, [space])
      const pose = inFrame(frame, onTable(space.x, space.z, { y: 0 }))
      expect(placed!.x).toBeCloseTo(pose.position.x, 12)
      expect(placed!.z).toBeCloseTo(pose.position.z, 12)
    }
  })

  it("turns the way the track goes with the frame: a line turned a quarter turn goes away from the viewer", () => {
    const spaces = spacesIn({ x: 0, z: 0, yaw: Math.PI / 2 }, lineSpaces(3, { gap: 1 }))
    expect(spaces[0]!.z).toBeCloseTo(1, 12)
    expect(spaces[2]!.z).toBeCloseTo(-1, 12)
    spaces.slice(0, -1).forEach((space, i) => expect(dot(heading(space.yaw), towards(space, spaces[i + 1]!))).toBeCloseTo(1, 12))
  })

  it("leaves the spaces it was given alone", () => {
    const spaces = lineSpaces(2, { gap: 1 })
    const before = JSON.stringify(spaces)
    spacesIn({ x: 4, z: 4, yaw: 1 }, spaces)
    expect(JSON.stringify(spaces)).toBe(before)
  })
})
