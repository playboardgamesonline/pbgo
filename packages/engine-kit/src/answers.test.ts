import { describe, expect, it } from "vitest"
import { cleanChoice, cleanChoices, cleanNumber } from "./answers"
import { isEngineError, isSharedErrorCode } from "./errors"

const refusal = (run: () => unknown) => {
  try {
    run()
  } catch (error) {
    return isEngineError(error) ? error.code : `not an engine error: ${String(error)}`
  }
  return "accepted"
}

describe("cleanNumber", () => {
  it("returns a number that meets the rules as it is", () => {
    expect(cleanNumber(7)).toBe(7)
    expect(cleanNumber(0, { min: 0, max: 10 })).toBe(0)
    expect(cleanNumber(10, { min: 0, max: 10 })).toBe(10)
    expect(cleanNumber(-3, { min: -5, max: 5 })).toBe(-3)
  })

  it("refuses a number outside the range, the ends being in it", () => {
    expect(refusal(() => cleanNumber(-1, { min: 0, max: 10 }))).toBe("INVALID_NUMBER")
    expect(refusal(() => cleanNumber(11, { min: 0, max: 10 }))).toBe("INVALID_NUMBER")
    expect(refusal(() => cleanNumber(4, { min: 5 }))).toBe("INVALID_NUMBER")
    expect(refusal(() => cleanNumber(6, { max: 5 }))).toBe("INVALID_NUMBER")
  })

  it("wants a whole number unless the game says otherwise", () => {
    expect(refusal(() => cleanNumber(2.5))).toBe("INVALID_NUMBER")
    expect(cleanNumber(2.5, { integer: false })).toBe(2.5)
  })

  it("wants a number on the steps, counted from the least", () => {
    expect(cleanNumber(15, { min: 5, max: 50, step: 5 })).toBe(15)
    expect(refusal(() => cleanNumber(16, { min: 5, max: 50, step: 5 }))).toBe("INVALID_NUMBER")
    expect(cleanNumber(10, { step: 5 })).toBe(10)
    expect(cleanNumber(1.5, { min: 0.5, step: 0.5, integer: false })).toBe(1.5)
    expect(cleanNumber(0.3, { step: 0.1, integer: false })).toBeCloseTo(0.3, 12)
  })

  it("refuses anything that is not a finite number: a string, NaN, infinity, nothing", () => {
    for (const value of ["3", "", null, undefined, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, {}, [], [3], true]) {
      expect(refusal(() => cleanNumber(value)), String(value)).toBe("INVALID_NUMBER")
    }
  })

  it("never returns a negative zero", () => {
    expect(Object.is(cleanNumber(-0), 0)).toBe(true)
  })

  it("throws a plain error for rules no number could meet, which is a bug of the game", () => {
    expect(() => cleanNumber(1, { min: 5, max: 1 })).toThrow(RangeError)
    expect(() => cleanNumber(1, { step: 0 })).toThrow(RangeError)
    expect(() => cleanNumber(1, { step: -2 })).toThrow(RangeError)
  })

  it("refuses with a code that every game shares, so that the platform words it", () => {
    expect(isSharedErrorCode("INVALID_NUMBER")).toBe(true)
  })
})

describe("cleanChoice", () => {
  const colours = ["red", "green", "blue"] as const

  it("returns the option the player chose", () => {
    expect(cleanChoice("green", colours)).toBe("green")
    expect(cleanChoice(3, [1, 2, 3])).toBe(3)
  })

  it("refuses anything that is not an option, a string where a number is wanted included", () => {
    expect(refusal(() => cleanChoice("yellow", colours))).toBe("INVALID_CHOICE")
    expect(refusal(() => cleanChoice("2", [1, 2, 3]))).toBe("INVALID_CHOICE")
    expect(refusal(() => cleanChoice(2, ["1", "2"]))).toBe("INVALID_CHOICE")
    for (const value of [undefined, null, {}, [], ["red"]]) expect(refusal(() => cleanChoice(value, colours)), String(value)).toBe("INVALID_CHOICE")
  })

  it("accepts the option 0, which is a value like any other", () => {
    expect(cleanChoice(0, [0, 1])).toBe(0)
  })

  it("refuses with a code that every game shares", () => {
    expect(isSharedErrorCode("INVALID_CHOICE")).toBe(true)
  })
})

describe("cleanChoices", () => {
  const options = ["a", "b", "c", "d"] as const

  it("returns the options chosen in the order of the options, whatever the order they were sent in", () => {
    expect(cleanChoices(["c", "a"], options)).toEqual(["a", "c"])
    expect(cleanChoices([], options)).toEqual([])
  })

  it("refuses an option twice, an option that is not one, and what is not a list", () => {
    expect(refusal(() => cleanChoices(["a", "a"], options))).toBe("INVALID_CHOICE")
    expect(refusal(() => cleanChoices(["a", "z"], options))).toBe("INVALID_CHOICE")
    for (const value of ["a", undefined, null, {}, 3]) expect(refusal(() => cleanChoices(value, options)), String(value)).toBe("INVALID_CHOICE")
  })

  it("refuses a list longer than the options at once", () => {
    expect(refusal(() => cleanChoices(Array.from({ length: 5000 }, () => "a"), options))).toBe("INVALID_CHOICE")
  })

  it("keeps to the number of options asked for", () => {
    expect(cleanChoices(["a", "b"], options, { min: 2, max: 3 })).toEqual(["a", "b"])
    expect(refusal(() => cleanChoices(["a"], options, { min: 2 }))).toBe("INVALID_CHOICE")
    expect(refusal(() => cleanChoices(["a", "b", "c"], options, { max: 2 }))).toBe("INVALID_CHOICE")
    expect(refusal(() => cleanChoices([], options, { min: 1 }))).toBe("INVALID_CHOICE")
  })

  it("throws a plain error for rules no choice could meet", () => {
    expect(() => cleanChoices([], options, { min: 3, max: 1 })).toThrow(RangeError)
  })
})
