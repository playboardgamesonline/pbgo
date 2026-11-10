import { describe, expect, it } from "vitest"
import { createRng } from "./rng"
import { MAX_WALK, moveAlong, type TrackRules } from "./track"

describe("moveAlong on a track that does not loop", () => {
  const line: TrackRules = { max: 10 }

  it("goes forward and says the spaces it went through, the last being where it stopped", () => {
    expect(moveAlong(line, 2, 3)).toEqual({ from: 2, to: 5, moved: 3, passed: [3, 4, 5], laps: 0, stopped: null })
  })

  it("goes back", () => {
    expect(moveAlong(line, 5, -2)).toEqual({ from: 5, to: 3, moved: -2, passed: [4, 3], laps: 0, stopped: null })
  })

  it("stops at the last space, and says it was cut short and by how much", () => {
    expect(moveAlong(line, 8, 5)).toEqual({ from: 8, to: 10, moved: 2, passed: [9, 10], laps: 0, stopped: "max" })
  })

  it("stops at the first space", () => {
    expect(moveAlong(line, 1, -4)).toEqual({ from: 1, to: 0, moved: -1, passed: [0], laps: 0, stopped: "min" })
  })

  it("does not call it being cut short to reach an end exactly", () => {
    expect(moveAlong(line, 7, 3)).toMatchObject({ to: 10, moved: 3, stopped: null })
    expect(moveAlong(line, 3, -3)).toMatchObject({ to: 0, moved: -3, stopped: null })
  })

  it("does not move a marker that is told not to, or that is at the end it is sent toward", () => {
    expect(moveAlong(line, 4, 0)).toEqual({ from: 4, to: 4, moved: 0, passed: [], laps: 0, stopped: null })
    expect(moveAlong(line, 10, 2)).toEqual({ from: 10, to: 10, moved: 0, passed: [], laps: 0, stopped: "max" })
    expect(moveAlong(line, 0, -1)).toEqual({ from: 0, to: 0, moved: 0, passed: [], laps: 0, stopped: "min" })
  })

  it("starts at the first space of the track, whatever its number", () => {
    const climb: TrackRules = { min: 5, max: 8 }
    expect(moveAlong(climb, 5, -1)).toMatchObject({ to: 5, stopped: "min" })
    expect(moveAlong(climb, 6, 9)).toMatchObject({ to: 8, passed: [7, 8], stopped: "max" })
  })

  it("is a track of one space when the ends are the same: nothing to go to", () => {
    expect(moveAlong({ min: 3, max: 3 }, 3, 2)).toMatchObject({ to: 3, moved: 0, passed: [], stopped: "max" })
  })
})

describe("moveAlong on a track that loops", () => {
  const round: TrackRules = { max: 9, loop: true }

  it("goes round past the last space, and counts the crossing", () => {
    expect(moveAlong(round, 8, 3)).toEqual({ from: 8, to: 1, moved: 3, passed: [9, 0, 1], laps: 1, stopped: null })
  })

  it("goes back past the first space, and counts the crossing the other way", () => {
    expect(moveAlong(round, 1, -3)).toEqual({ from: 1, to: 8, moved: -3, passed: [0, 9, 8], laps: -1, stopped: null })
  })

  it("counts no lap for a move that stays on the near side of the start", () => {
    expect(moveAlong(round, 3, 4)).toMatchObject({ to: 7, laps: 0 })
    expect(moveAlong(round, 3, -3)).toMatchObject({ to: 0, laps: 0 })
  })

  it("crosses the start by landing on it from the last space, or leaving it for the last", () => {
    expect(moveAlong(round, 9, 1)).toMatchObject({ to: 0, passed: [0], laps: 1 })
    expect(moveAlong(round, 0, -1)).toMatchObject({ to: 9, passed: [9], laps: -1 })
  })

  it("goes all the way round and comes back to the space it left, one lap on", () => {
    const walk = moveAlong(round, 4, 10)
    expect(walk).toMatchObject({ to: 4, moved: 10, laps: 1 })
    expect(walk.passed).toEqual([5, 6, 7, 8, 9, 0, 1, 2, 3, 4])
  })

  it("counts every crossing of the start in a long move: forward from the last space to the first, back from the first to the last", () => {
    // From space 4 the start is crossed after 6 steps, 16 and so on; going back it is crossed after 5, 15 and 25
    expect(moveAlong(round, 4, 25)).toMatchObject({ to: 9, laps: 2 })
    expect(moveAlong(round, 4, -25)).toMatchObject({ to: 9, laps: -3 })
  })

  it("loops over the spaces of a track that does not start at zero: the squares of a board", () => {
    const board: TrackRules = { min: 1, max: 40, loop: true }
    expect(moveAlong(board, 38, 5)).toEqual({ from: 38, to: 3, moved: 5, passed: [39, 40, 1, 2, 3], laps: 1, stopped: null })
    expect(moveAlong(board, 1, -1)).toMatchObject({ to: 40, passed: [40], laps: -1 })
  })

  it("does not move for no steps", () => {
    expect(moveAlong(round, 6, 0)).toEqual({ from: 6, to: 6, moved: 0, passed: [], laps: 0, stopped: null })
  })

  it("is a track of one space when the ends are the same: every step crosses the start", () => {
    expect(moveAlong({ min: 2, max: 2, loop: true }, 2, 3)).toMatchObject({ to: 2, passed: [2, 2, 2], laps: 3 })
  })

  it("never stops: a loop has no end to cut a move short", () => {
    expect(moveAlong(round, 5, 1000).stopped).toBeNull()
  })
})

describe("what any move says", () => {
  it("adds up: the spaces gone, the laps and the length of the track make the steps (a loop), and the last space passed is where it ended", () => {
    const rng = createRng(2024)
    for (let i = 0; i < 400; i++) {
      const min = Math.floor(rng() * 5) - 2
      const max = min + Math.floor(rng() * 12)
      const length = max - min + 1
      const from = min + Math.floor(rng() * length)
      const steps = Math.floor(rng() * 61) - 30
      const walk = moveAlong({ min, max, loop: true }, from, steps)
      expect(walk.to - walk.from + walk.laps * length, `${min}..${max} from ${from} by ${steps}`).toBe(steps)
      expect(walk.passed).toHaveLength(Math.abs(steps))
      expect(walk.passed[walk.passed.length - 1] ?? from).toBe(walk.to)
      for (const space of walk.passed) expect(space >= min && space <= max).toBe(true)
    }
  })

  it("adds up on a track that does not loop: where it ended is where it began and what it went", () => {
    const rng = createRng(77)
    for (let i = 0; i < 400; i++) {
      const max = Math.floor(rng() * 15)
      const from = Math.floor(rng() * (max + 1))
      const steps = Math.floor(rng() * 41) - 20
      const walk = moveAlong({ max }, from, steps)
      expect(walk.from + walk.moved).toBe(walk.to)
      expect(walk.passed).toHaveLength(Math.abs(walk.moved))
      expect(walk.passed[walk.passed.length - 1] ?? from).toBe(walk.to)
      expect(walk.to >= 0 && walk.to <= max).toBe(true)
      // A cut-short move is a move that would have left the track
      expect(walk.stopped !== null).toBe(from + steps > max || from + steps < 0)
    }
  })

  it("walks back to where it began when it is told to walk back what it walked, on a loop", () => {
    const rng = createRng(5)
    for (let i = 0; i < 100; i++) {
      const track: TrackRules = { max: 5 + Math.floor(rng() * 20), loop: true }
      const from = Math.floor(rng() * (track.max + 1))
      const steps = Math.floor(rng() * 40) - 20
      const there = moveAlong(track, from, steps)
      const back = moveAlong(track, there.to, -steps)
      expect(back.to).toBe(from)
      expect(back.laps + there.laps).toBe(0)
    }
  })

  it("never lets a negative zero into the answer, which JSON would not keep apart from a zero", () => {
    for (const walk of [moveAlong({ max: 5 }, 0, -0), moveAlong({ max: 5 }, 0, -3), moveAlong({ max: 5, loop: true }, 2, -0), moveAlong({ max: 5, loop: true }, 0, -6)]) {
      for (const value of [walk.from, walk.to, walk.moved, walk.laps]) expect(Object.is(value, -0)).toBe(false)
    }
  })

  it("answers with plain data that keeps its shape through JSON", () => {
    const walk = moveAlong({ max: 9, loop: true }, 8, 3)
    expect(JSON.parse(JSON.stringify(walk))).toEqual(walk)
  })
})

describe("what moveAlong refuses", () => {
  it("a track that has no space, or whose ends are not whole numbers", () => {
    expect(() => moveAlong({ min: 4, max: 3 }, 3, 1)).toThrow(RangeError)
    expect(() => moveAlong({ max: 2.5 }, 0, 1)).toThrow(RangeError)
    expect(() => moveAlong({ min: 0.5, max: 4 }, 1, 1)).toThrow(RangeError)
    expect(() => moveAlong({ max: Number.NaN }, 0, 1)).toThrow(RangeError)
  })

  it("a marker that is not on a space of the track: the game lost track of it", () => {
    for (const from of [-1, 11, 1.5, Number.NaN]) expect(() => moveAlong({ max: 10 }, from, 1), String(from)).toThrow(RangeError)
  })

  it("a number of steps that is not a whole number", () => {
    for (const steps of [1.5, Number.NaN, Number.POSITIVE_INFINITY]) expect(() => moveAlong({ max: 10 }, 0, steps), String(steps)).toThrow(RangeError)
  })

  it("a move of more spaces than the game could mean", () => {
    expect(() => moveAlong({ max: 9, loop: true }, 0, MAX_WALK + 1)).toThrow(RangeError)
    expect(() => moveAlong({ max: 9, loop: true }, 0, -MAX_WALK - 1)).toThrow(RangeError)
    expect(moveAlong({ max: 9, loop: true }, 0, MAX_WALK).passed).toHaveLength(MAX_WALK)
  })
})
