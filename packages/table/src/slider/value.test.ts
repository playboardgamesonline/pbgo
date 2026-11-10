import { describe, expect, it } from "vitest"
import { cleanNumber } from "../../../engine-kit/src/answers"
import { rangeOf } from "../stepper/steps"
import { alongRail, fractionOf, marksOf, valueAt } from "./value"

describe("how far along the rail a number is", () => {
  it("runs from 0 at the least to 1 at the most", () => {
    expect(fractionOf(0, { min: 0, max: 100 })).toBe(0)
    expect(fractionOf(50, { min: 0, max: 100 })).toBe(0.5)
    expect(fractionOf(100, { min: 0, max: 100 })).toBe(1)
    expect(fractionOf(15, { min: 5, max: 25 })).toBe(0.5)
  })

  it("puts a number outside the range at the nearer end, and a range of one number at the start", () => {
    expect(fractionOf(-4, { min: 0, max: 10 })).toBe(0)
    expect(fractionOf(400, { min: 0, max: 10 })).toBe(1)
    expect(fractionOf(3, { min: 3, max: 3 })).toBe(0)
    expect(fractionOf(Number.NaN, { min: 0, max: 10 })).toBe(0)
  })
})

describe("the number a place on the rail means", () => {
  it("is the least at the start and the most at the end", () => {
    expect(valueAt(0, { min: 0, max: 100 })).toBe(0)
    expect(valueAt(1, { min: 0, max: 100 })).toBe(100)
    expect(valueAt(0.5, { min: 0, max: 100 })).toBe(50)
  })

  it("is the nearest of the steps, never one that is not on them", () => {
    const range = { min: 5, max: 50, step: 5 }
    expect(valueAt(0.12, range)).toBe(10)
    expect(valueAt(0.1, range)).toBe(10)
    // Closer to the least than to the next step, which is a step above it
    expect(valueAt(0.05, range)).toBe(5)
    expect(valueAt(0.07, range)).toBe(10)
    expect(valueAt(0.99, range)).toBe(50)
    expect(valueAt(0.5, { min: 0, max: 10, step: 3 })).toBe(6)
  })

  it("stops at the last of the steps when the most is not on them", () => {
    // 2, 5, 8: the most, 9, is not one of them
    expect(valueAt(1, { min: 2, max: 9, step: 3 })).toBe(8)
    expect(valueAt(0.95, { min: 2, max: 9, step: 3 })).toBe(8)
  })

  it("keeps to the rail whatever the place", () => {
    expect(valueAt(-3, { min: 0, max: 10 })).toBe(0)
    expect(valueAt(7, { min: 0, max: 10 })).toBe(10)
    expect(valueAt(Number.NaN, { min: 4, max: 10 })).toBe(4)
    expect(valueAt(0.4, { min: 7, max: 7 })).toBe(7)
  })

  it("is the inverse of where a number is, for every number the steps give", () => {
    for (const range of [{ min: 0, max: 100 }, { min: 5, max: 50, step: 5 }, { min: 0, max: 1, step: 0.1 }, { min: -10, max: 10, step: 2 }]) {
      const rules = rangeOf(range)
      for (let value = rules.min; value <= rules.max + 1e-9; value = Math.round((value + rules.step) * 1e9) / 1e9) expect(valueAt(fractionOf(value, range), range)).toBeCloseTo(value, 9)
    }
  })

  it("always gives a number that the engine accepts with the same rules", () => {
    // The contract between the two packages: what a slider asks for is what `cleanNumber` lets through
    for (const rules of [{}, { min: 5, max: 50, step: 5 }, { min: 2, max: 9, step: 3 }, { min: -3, max: 3 }, { min: 0, max: 1, step: 0.25 }]) {
      const range = rangeOf(rules)
      const whole = Number.isInteger(range.step) && Number.isInteger(range.min)
      for (let k = 0; k <= 200; k++) expect(() => cleanNumber(valueAt(k / 200, rules), { ...rules, integer: whole })).not.toThrow()
    }
  })
})

describe("where a point of the table is on the rail", () => {
  it("is its distance from the middle along the rail, negative toward the least", () => {
    expect(alongRail({ x: 3, z: 0 }, { x: 0, z: 0 })).toBe(3)
    expect(alongRail({ x: -2, z: 5 }, { x: 0, z: 0 })).toBe(-2)
    expect(alongRail({ x: 4, z: 7 }, { x: 1, z: 7 })).toBe(3)
  })

  it("follows the way the rail is turned: a rail turned by a quarter runs along the z axis, its least toward the viewer", () => {
    // Three's yaw: a quarter turn takes +x to -z
    expect(alongRail({ x: 0, z: -3 }, { x: 0, z: 0 }, Math.PI / 2)).toBeCloseTo(3, 9)
    expect(alongRail({ x: 0, z: 3 }, { x: 0, z: 0 }, Math.PI / 2)).toBeCloseTo(-3, 9)
    expect(alongRail({ x: 5, z: 0 }, { x: 0, z: 0 }, Math.PI / 2)).toBeCloseTo(0, 9)
    expect(alongRail({ x: -3, z: 0 }, { x: 0, z: 0 }, Math.PI)).toBeCloseTo(3, 9)
  })
})

describe("the marks along the rail", () => {
  it("are every number when there are few", () => {
    expect(marksOf({ min: 0, max: 5 })).toEqual([0, 1, 2, 3, 4, 5])
    expect(marksOf({ min: 5, max: 50, step: 5 })).toEqual([5, 10, 15, 20, 25, 30, 35, 40, 45, 50])
  })

  it("are a handful spread evenly, each on a step, when there are many", () => {
    const marks = marksOf({ min: 0, max: 100 }, 11)
    expect(marks).toEqual([0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100])
    expect(marksOf({ min: 0, max: 1000, step: 10 }, 5)).toEqual([0, 250, 500, 750, 1000])
  })

  it("always hold the least and the highest the steps reach, in order, with no number twice", () => {
    for (const rules of [{ min: 0, max: 100 }, { min: 3, max: 77, step: 4 }, { min: 0, max: 7 }, { min: 0, max: 1, step: 0.01 }]) {
      for (const most of [2, 3, 7, 11, 30]) {
        const marks = marksOf(rules, most)
        const range = rangeOf(rules)
        expect(marks[0]).toBe(range.min)
        expect(marks.length).toBeLessThanOrEqual(Math.max(most, 2))
        expect([...marks].sort((a, b) => a - b)).toEqual(marks)
        expect(new Set(marks).size).toBe(marks.length)
        expect(valueAt(1, rules)).toBe(marks[marks.length - 1])
      }
    }
  })

  it("is one mark for a range of one number", () => {
    expect(marksOf({ min: 4, max: 4 })).toEqual([4])
  })
})
