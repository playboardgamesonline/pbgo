import { describe, expect, it } from "vitest"
import { changeText, countSteps } from "./count"

const options = { seconds: 0.8, tick: 0.09, maxSteps: 30 }

describe("countSteps", () => {
  it("shows every number on the way, one by one, the last being the one the engine gave", () => {
    expect(countSteps(10, 14, options).map((step) => step.value)).toEqual([11, 12, 13, 14])
    expect(countSteps(14, 10, options).map((step) => step.value)).toEqual([13, 12, 11, 10])
  })

  it("has nothing to show for a change that is nothing", () => {
    expect(countSteps(7, 7, options)).toEqual([])
  })

  it("shows a change of one count at once, nearly: it does not wait for the whole time", () => {
    const [only] = countSteps(7, 8, options)
    expect(only).toEqual({ value: 8, at: 0.09 })
  })

  it("takes longer for a longer change, and never longer than the time it has", () => {
    const last = (from: number, to: number) => countSteps(from, to, options).at(-1)!.at
    expect(last(0, 2)).toBeLessThan(last(0, 6))
    expect(last(0, 6)).toBeLessThan(last(0, 30))
    expect(last(0, 30)).toBeCloseTo(0.8, 12)
    expect(last(0, 500)).toBeCloseTo(0.8, 12)
  })

  it("comes quickly at first and slows down: the gaps between the numbers grow", () => {
    const times = countSteps(0, 20, options).map((step) => step.at)
    const gaps = times.map((time, i) => time - (times[i - 1] ?? 0))
    for (let i = 1; i < gaps.length; i++) expect(gaps[i]!).toBeGreaterThan(gaps[i - 1]! - 1e-12)
  })

  it("thins a long change out to the most numbers it may show, the first and the last included", () => {
    const steps = countSteps(100, 500, options)
    expect(steps).toHaveLength(30)
    expect(steps.at(-1)!.value).toBe(500)
    const values = steps.map((step) => step.value)
    for (let i = 1; i < values.length; i++) expect(values[i]!).toBeGreaterThan(values[i - 1]!)
    expect(values[0]!).toBeGreaterThan(100)
  })

  it("thins a long change going down the same way", () => {
    const steps = countSteps(500, 100, options)
    expect(steps).toHaveLength(30)
    expect(steps.at(-1)!.value).toBe(100)
    const values = steps.map((step) => step.value)
    for (let i = 1; i < values.length; i++) expect(values[i]!).toBeLessThan(values[i - 1]!)
  })

  it("shows numbers that differ, never the same twice in a row, however it is thinned", () => {
    for (const [from, to] of [
      [0, 31],
      [0, 59],
      [-45, 47],
      [12, 11],
      [3, 0],
    ] as const) {
      const values = [from, ...countSteps(from, to, options).map((step) => step.value)]
      for (let i = 1; i < values.length; i++) expect(values[i], `${from} to ${to}`).not.toBe(values[i - 1])
    }
  })

  it("puts the times in order, none before the change and none after the end", () => {
    const steps = countSteps(0, 40, options)
    for (let i = 0; i < steps.length; i++) {
      expect(steps[i]!.at).toBeGreaterThan(0)
      expect(steps[i]!.at).toBeLessThanOrEqual(0.8 + 1e-12)
      if (i > 0) expect(steps[i]!.at).toBeGreaterThan(steps[i - 1]!.at)
    }
  })

  it("counts through zero and below it", () => {
    expect(countSteps(-2, 2, options).map((step) => step.value)).toEqual([-1, 0, 1, 2])
  })

  it("jumps to a number that is not whole, and to one that is not a number", () => {
    expect(countSteps(1, 2.5, options)).toEqual([{ value: 2.5, at: 0 }])
    expect(countSteps(0.5, 3, options)).toEqual([{ value: 3, at: 0 }])
    expect(countSteps(1, Number.POSITIVE_INFINITY, options)).toEqual([{ value: Number.POSITIVE_INFINITY, at: 0 }])
  })

  it("shows at least one number when it is told it may show none", () => {
    expect(countSteps(0, 9, { ...options, maxSteps: 0 })).toEqual([{ value: 9, at: 0.09 }])
  })
})

describe("changeText", () => {
  it("writes a gain with a plus and a loss with a true minus sign", () => {
    expect(changeText(3)).toBe("+3")
    expect(changeText(-2)).toBe("−2")
    expect(changeText(-2).charCodeAt(0)).toBe(0x2212)
  })

  it("writes nothing for a change that is nothing or is not a number", () => {
    expect(changeText(0)).toBe("")
    expect(changeText(Number.NaN)).toBe("")
    expect(changeText(Number.POSITIVE_INFINITY)).toBe("")
  })

  it("writes a part of a count as it is", () => {
    expect(changeText(0.5)).toBe("+0.5")
  })
})
