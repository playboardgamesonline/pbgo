import { describe, expect, it } from "vitest"
import { cleanNumber } from "../../../engine-kit/src/answers"
import { canStep, rangeOf, repeatAfter, stepped } from "./steps"

describe("a stepper's range", () => {
  it("has the defaults of a count: from 0 to 99 by 1", () => {
    expect(rangeOf()).toEqual({ min: 0, max: 99, step: 1 })
    expect(rangeOf({ max: 10 })).toEqual({ min: 0, max: 10, step: 1 })
  })

  it("is kept sane: a step that is not above zero is 1, and an end before the other is the other", () => {
    expect(rangeOf({ step: 0 }).step).toBe(1)
    expect(rangeOf({ step: -2 }).step).toBe(1)
    expect(rangeOf({ step: Number.NaN }).step).toBe(1)
    expect(rangeOf({ min: 5, max: 2 })).toEqual({ min: 5, max: 5, step: 1 })
    expect(rangeOf({ min: Number.NaN, max: 4 }).min).toBe(0)
  })
})

describe("a press of an arrow", () => {
  it("takes a step up or down", () => {
    expect(stepped(3, 1)).toBe(4)
    expect(stepped(3, -1)).toBe(2)
    expect(stepped(10, 1, { min: 5, max: 50, step: 5 })).toBe(15)
    expect(stepped(10, -1, { min: 5, max: 50, step: 5 })).toBe(5)
  })

  it("stops at the ends of the range", () => {
    expect(stepped(99, 1)).toBe(99)
    expect(stepped(0, -1)).toBe(0)
    expect(stepped(48, 1, { min: 5, max: 50, step: 5 })).toBe(50)
    expect(stepped(50, 1, { min: 5, max: 50, step: 5 })).toBe(50)
  })

  it("puts a number that is off the steps on them first, and brings one outside the range into it", () => {
    expect(stepped(12, 1, { min: 5, max: 50, step: 5 })).toBe(15)
    expect(stepped(13, -1, { min: 5, max: 50, step: 5 })).toBe(10)
    // Outside the range, a press comes into it, at the nearest end
    expect(stepped(-40, 1)).toBe(0)
    expect(stepped(-40, -1)).toBe(0)
    expect(stepped(400, -1)).toBe(99)
    expect(stepped(400, 1)).toBe(99)
    // What is not a number starts from the least
    expect(stepped(Number.NaN, 1)).toBe(1)
  })

  it("counts the steps from the least, whatever it is", () => {
    expect(stepped(2, 1, { min: 2, max: 9, step: 3 })).toBe(5)
    expect(stepped(8, 1, { min: 2, max: 9, step: 3 })).toBe(8)
    // The most the steps reach is 8: 9 is not on them
    expect(stepped(5, 1, { min: 2, max: 9, step: 3 })).toBe(8)
  })

  it("is free of the dust of floating point", () => {
    expect(stepped(0.1, 1, { min: 0, max: 1, step: 0.1 })).toBe(0.2)
    expect(stepped(0.2, 1, { min: 0, max: 1, step: 0.1 })).toBe(0.3)
    let value = 0
    for (let i = 0; i < 10; i++) value = stepped(value, 1, { min: 0, max: 1, step: 0.1 })
    expect(value).toBe(1)
  })

  it("says whether an arrow has anywhere to go", () => {
    expect(canStep(0, -1)).toBe(false)
    expect(canStep(0, 1)).toBe(true)
    expect(canStep(99, 1)).toBe(false)
    expect(canStep(99, -1)).toBe(true)
    expect(canStep(5, 1, { min: 5, max: 5 })).toBe(false)
  })

  it("always gives a number that the engine accepts with the same rules", () => {
    // The contract between the two packages: what a stepper asks for is what `cleanNumber` lets through
    for (const rules of [{}, { min: 5, max: 50, step: 5 }, { min: 2, max: 9, step: 3 }, { min: -3, max: 3 }, { min: 0, max: 1, step: 0.25 }]) {
      const range = rangeOf(rules)
      let value = range.min
      for (let i = 0; i < 40; i++) {
        value = stepped(value, i % 7 === 6 ? -1 : 1, rules)
        expect(() => cleanNumber(value, { ...rules, integer: Number.isInteger(range.step) && Number.isInteger(range.min) })).not.toThrow()
      }
    }
  })
})

describe("a held arrow", () => {
  const hold = { delay: 0.4, every: 0.16, fastest: 0.04, faster: 0.88 }

  it("waits before it repeats, then repeats at a steady beginning", () => {
    expect(repeatAfter(0, hold)).toBe(0.4)
    expect(repeatAfter(1, hold)).toBeCloseTo(0.16, 6)
  })

  it("repeats faster and faster, down to the fastest", () => {
    let last = repeatAfter(1, hold)
    for (let i = 2; i < 60; i++) {
      const wait = repeatAfter(i, hold)
      expect(wait).toBeLessThanOrEqual(last)
      expect(wait).toBeGreaterThanOrEqual(hold.fastest)
      last = wait
    }
    expect(repeatAfter(200, hold)).toBe(hold.fastest)
  })

  it("never has a negative wait", () => {
    expect(repeatAfter(-3, { ...hold, delay: -1 })).toBe(0)
  })
})
