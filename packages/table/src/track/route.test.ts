import { describe, expect, it } from "vitest"
import { routeBetween, slotOffset } from "./route"

describe("routeBetween on a track that does not loop", () => {
  it("goes the straight way, forward or back, space by space", () => {
    expect(routeBetween(2, 5, 12)).toEqual([3, 4, 5])
    expect(routeBetween(5, 2, 12)).toEqual([4, 3, 2])
  })

  it("goes nowhere when it is where it was sent", () => {
    expect(routeBetween(4, 4, 12)).toEqual([])
  })

  it("goes all the way back across a track that was crossed: a marker sent from the last space to the first", () => {
    expect(routeBetween(9, 0, 10)).toEqual([8, 7, 6, 5, 4, 3, 2, 1, 0])
  })
})

describe("routeBetween on a track that loops", () => {
  it("goes forward past the last space when that is the shorter way", () => {
    expect(routeBetween(8, 1, 10, true)).toEqual([9, 0, 1])
  })

  it("goes back past the first space when that is the shorter way", () => {
    expect(routeBetween(1, 8, 10, true)).toEqual([0, 9, 8])
  })

  it("goes the straight way when that is the shorter one", () => {
    expect(routeBetween(2, 5, 10, true)).toEqual([3, 4, 5])
    expect(routeBetween(5, 2, 10, true)).toEqual([4, 3, 2])
  })

  it("goes forward when both ways are as long", () => {
    expect(routeBetween(0, 5, 10, true)).toEqual([1, 2, 3, 4, 5])
    expect(routeBetween(7, 2, 10, true)).toEqual([8, 9, 0, 1, 2])
  })

  it("never takes more than half a round, and ends where it was sent", () => {
    for (let count = 1; count <= 13; count++) {
      for (let from = 0; from < count; from++) {
        for (let to = 0; to < count; to++) {
          const route = routeBetween(from, to, count, true)
          expect(route.length).toBeLessThanOrEqual(Math.floor(count / 2))
          expect(route[route.length - 1] ?? from).toBe(to)
          for (const space of route) expect(space >= 0 && space < count).toBe(true)
        }
      }
    }
  })

  it("makes a track of one space go nowhere", () => {
    expect(routeBetween(0, 0, 1, true)).toEqual([])
  })
})

describe("slotOffset", () => {
  it("puts a lone marker in the middle of the space", () => {
    expect(slotOffset(0, 1, 0.3)).toEqual({ x: 0, z: 0 })
    expect(slotOffset(0, 0, 0.3)).toEqual({ x: 0, z: 0 })
  })

  it("puts two side by side, centred", () => {
    expect(slotOffset(0, 2, 0.4)).toEqual({ x: -0.2, z: 0 })
    expect(slotOffset(1, 2, 0.4)).toEqual({ x: 0.2, z: 0 })
  })

  it("puts four in two lines of two", () => {
    const four = [0, 1, 2, 3].map((slot) => slotOffset(slot, 4, 1))
    expect(four).toEqual([
      { x: -0.5, z: -0.5 },
      { x: 0.5, z: -0.5 },
      { x: -0.5, z: 0.5 },
      { x: 0.5, z: 0.5 },
    ])
  })

  it("centres the group whatever its size, a last line that is not full included in the spread", () => {
    for (let of = 2; of <= 9; of++) {
      const spots = Array.from({ length: of }, (_, slot) => slotOffset(slot, of, 1))
      const xs = spots.map((spot) => spot.x)
      const zs = spots.map((spot) => spot.z)
      expect((Math.max(...xs) + Math.min(...xs)) / 2).toBeCloseTo(0, 12)
      expect((Math.max(...zs) + Math.min(...zs)) / 2).toBeCloseTo(0, 12)
    }
  })

  it("gives every marker of a group a place of its own", () => {
    for (let of = 2; of <= 9; of++) {
      const places = new Set(Array.from({ length: of }, (_, slot) => JSON.stringify(slotOffset(slot, of, 1))))
      expect(places.size).toBe(of)
    }
  })

  it("keeps the markers a spread apart", () => {
    const [a, b] = [slotOffset(0, 3, 0.5), slotOffset(1, 3, 0.5)]
    expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeCloseTo(0.5, 12)
  })
})
