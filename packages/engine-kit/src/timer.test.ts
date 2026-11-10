import { describe, expect, it } from "vitest"
import { extendTimer, restartTimer, startTimer, timeLeft, timerDone, timerFraction } from "./timer"

describe("a timer", () => {
  it("ends the length it was set for after the time it starts at", () => {
    expect(startTimer(1_000, 10)).toEqual({ endsAt: 11_000, seconds: 10 })
    expect(startTimer(0, 0.5)).toEqual({ endsAt: 500, seconds: 0.5 })
  })

  it("refuses a time that is not a number and a length that is not above zero", () => {
    expect(() => startTimer(Number.NaN, 10)).toThrow(RangeError)
    expect(() => startTimer(Number.POSITIVE_INFINITY, 10)).toThrow(RangeError)
    expect(() => startTimer(0, 0)).toThrow(RangeError)
    expect(() => startTimer(0, -3)).toThrow(RangeError)
    expect(() => startTimer(0, Number.NaN)).toThrow(RangeError)
  })

  it("is plain data: two numbers that come back from JSON as they went in", () => {
    const timer = startTimer(1_700_000_000_000, 30)
    expect(JSON.parse(JSON.stringify(timer))).toEqual(timer)
  })

  it("starts again from a new time for as long as it was", () => {
    const timer = startTimer(1_000, 5)
    expect(restartTimer(timer, 4_000)).toEqual({ endsAt: 9_000, seconds: 5 })
    // The one it was made from is left alone
    expect(timer).toEqual({ endsAt: 6_000, seconds: 5 })
  })

  it("takes more time, and the whole it was set for grows with it", () => {
    const timer = startTimer(0, 10)
    expect(extendTimer(timer, 5)).toEqual({ endsAt: 15_000, seconds: 15 })
    expect(extendTimer(timer, 0)).toEqual(timer)
    expect(() => extendTimer(timer, -1)).toThrow(RangeError)
    expect(() => extendTimer(timer, Number.NaN)).toThrow(RangeError)
  })

  it("says how long is left, never below zero", () => {
    const timer = startTimer(0, 10)
    expect(timeLeft(timer, 0)).toBe(10_000)
    expect(timeLeft(timer, 4_000)).toBe(6_000)
    expect(timeLeft(timer, 10_000)).toBe(0)
    expect(timeLeft(timer, 99_000)).toBe(0)
    expect(() => timeLeft(timer, Number.NaN)).toThrow(RangeError)
  })

  it("has run out at the instant it ends and after", () => {
    const timer = startTimer(0, 10)
    expect(timerDone(timer, 9_999)).toBe(false)
    expect(timerDone(timer, 10_000)).toBe(true)
    expect(timerDone(timer, 20_000)).toBe(true)
  })

  it("says how much of it is left, from all of it to none", () => {
    const timer = startTimer(0, 10)
    expect(timerFraction(timer, 0)).toBe(1)
    expect(timerFraction(timer, 2_500)).toBeCloseTo(0.75, 10)
    expect(timerFraction(timer, 10_000)).toBe(0)
    expect(timerFraction(timer, 50_000)).toBe(0)
    // Before it started it is whole, not more than whole
    expect(timerFraction(timer, -5_000)).toBe(1)
  })

  it("keeps what is left of an extended timer within the whole", () => {
    const longer = extendTimer(startTimer(0, 10), 10)
    expect(timerFraction(longer, 10_000)).toBeCloseTo(0.5, 10)
    expect(timerFraction(longer, 0)).toBeLessThanOrEqual(1)
  })
})
