import { describe, expect, it } from "vitest"
import { changeCounter } from "./counters"

describe("changeCounter", () => {
  const life = { min: 0, max: 20 }

  it("changes a counter by what it is told and says so", () => {
    expect(changeCounter(life, 12, 5)).toEqual({ from: 12, to: 17, applied: 5, stopped: null })
    expect(changeCounter(life, 12, -7)).toEqual({ from: 12, to: 5, applied: -7, stopped: null })
  })

  it("cuts a change short at the most, and says how much of it was really applied", () => {
    expect(changeCounter(life, 18, 5)).toEqual({ from: 18, to: 20, applied: 2, stopped: "max" })
    expect(changeCounter(life, 20, 3)).toEqual({ from: 20, to: 20, applied: 0, stopped: "max" })
  })

  it("cuts a change short at the least: damage that is more than the life left", () => {
    expect(changeCounter(life, 3, -5)).toEqual({ from: 3, to: 0, applied: -3, stopped: "min" })
    expect(changeCounter(life, 0, -1)).toEqual({ from: 0, to: 0, applied: 0, stopped: "min" })
  })

  it("does not call it being cut short to reach an end exactly", () => {
    expect(changeCounter(life, 15, 5)).toEqual({ from: 15, to: 20, applied: 5, stopped: null })
    expect(changeCounter(life, 5, -5)).toEqual({ from: 5, to: 0, applied: -5, stopped: null })
  })

  it("has a counter with one end, or none: coins have a least and no most", () => {
    expect(changeCounter({ min: 0 }, 4, 1_000_000)).toEqual({ from: 4, to: 1_000_004, applied: 1_000_000, stopped: null })
    expect(changeCounter({ min: 0 }, 4, -10)).toEqual({ from: 4, to: 0, applied: -4, stopped: "min" })
    expect(changeCounter({ max: 3 }, 2, 9)).toEqual({ from: 2, to: 3, applied: 1, stopped: "max" })
    expect(changeCounter({}, 5, -100)).toEqual({ from: 5, to: -95, applied: -100, stopped: null })
  })

  it("changes a counter by a part of a point when the game counts halves", () => {
    expect(changeCounter({ min: 0, max: 3 }, 1.5, 0.25)).toEqual({ from: 1.5, to: 1.75, applied: 0.25, stopped: null })
  })

  it("never lets a negative zero into the state, which JSON would not keep apart from a zero", () => {
    for (const change of [changeCounter(life, 0, -0), changeCounter(life, -0, 0), changeCounter(life, 4, -4), changeCounter(life, 0, -3)]) {
      expect(Object.is(change.from, -0)).toBe(false)
      expect(Object.is(change.to, -0)).toBe(false)
      expect(Object.is(change.applied, -0)).toBe(false)
    }
  })

  it("answers with plain data that keeps its shape through JSON", () => {
    const change = changeCounter(life, 18, 5)
    expect(JSON.parse(JSON.stringify(change))).toEqual(change)
  })

  it("refuses ends that no number is between", () => {
    expect(() => changeCounter({ min: 5, max: 4 }, 4, 1)).toThrow(RangeError)
  })

  it("refuses a value or a change that is not a finite number", () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(() => changeCounter(life, bad, 1), String(bad)).toThrow(RangeError)
      expect(() => changeCounter(life, 1, bad), String(bad)).toThrow(RangeError)
    }
  })

  it("refuses a counter that is not between its ends to begin with: the game lost track of it", () => {
    expect(() => changeCounter(life, 21, -1)).toThrow(RangeError)
    expect(() => changeCounter(life, -1, 1)).toThrow(RangeError)
  })
})
