import { describe, expect, it } from "vitest"
import { cardType, type CardKey } from "./catalogue"
import { FLIP_7, FLIP_7_BONUS, isFlip7, lineScore, numberValues } from "./scoring"
import { scoreOf } from "./test-utils"

// "Calculate scores as follows" (booklet pages 10 and 11): add the number cards, double the sum with the x2, add the +N modifiers, then
// 15 more for a Flip 7. The examples of the booklet are the first tests.

const numbers = (...values: number[]): CardKey[] => values.map((value) => `number-${value}` as CardKey)

describe("the examples of the booklet", () => {
  it("scores 28 for 11 + 5 + 12, and 32 with the +4 (page 5)", () => {
    expect(scoreOf(numbers(11, 5, 12))).toBe(28)
    expect(scoreOf(["plus-4", ...numbers(11, 5, 12)])).toBe(32)
  })

  it("1. adds the value of the number cards: 3 + 11 + 5 + 7 + 10 = 36", () => {
    expect(scoreOf(numbers(3, 11, 5, 7, 10))).toBe(36)
  })

  it("2. doubles it with the x2: 72", () => {
    expect(scoreOf([...numbers(3, 11, 5, 7, 10), "times-2"])).toBe(72)
  })

  it("3. adds the bonus points: 36 + 10 = 46", () => {
    expect(scoreOf([...numbers(3, 11, 5, 7, 10), "plus-10"])).toBe(46)
  })

  it("4. adds 15 for a Flip 7: 3 + 11 + 5 + 7 + 10 + 9 + 4 = 49, and 64", () => {
    expect(scoreOf(numbers(3, 11, 5, 7, 10, 9, 4))).toBe(49 + FLIP_7_BONUS)
    expect(scoreOf(numbers(3, 11, 5, 7, 10, 9, 4))).toBe(64)
  })
})

describe("the order of the operations", () => {
  it("multiplies the number cards first, then adds the modifiers (page 8)", () => {
    // 10 x 2 = 20, then +4: 24, not (10 + 4) x 2 = 28
    expect(scoreOf(["number-10", "times-2", "plus-4"])).toBe(24)
    expect(scoreOf(["plus-4", "times-2", "number-10"])).toBe(24)
  })

  it("adds every modifier it holds", () => {
    expect(scoreOf(["number-1", "plus-2", "plus-4", "plus-6", "plus-8", "plus-10"])).toBe(1 + 30)
  })

  it("does not double the 15 of a Flip 7, nor the modifiers", () => {
    // 0 + 1 + … + 6 = 21, doubled 42, + 6, + 15
    expect(scoreOf([...numbers(0, 1, 2, 3, 4, 5, 6), "times-2", "plus-6"])).toBe(42 + 6 + 15)
  })

  it("scores a modifier on its own, except the x2 (page 8)", () => {
    expect(scoreOf(["plus-6"])).toBe(6)
    expect(scoreOf(["times-2"])).toBe(0)
    expect(scoreOf(["times-2", "plus-2"])).toBe(2)
    expect(scoreOf([])).toBe(0)
  })

  it("counts no action card", () => {
    expect(scoreOf(["freeze", "flip-three", "second-chance", "number-5"])).toBe(5)
  })

  it("lets the zero be a card worth nothing", () => {
    expect(scoreOf(["number-0"])).toBe(0)
    expect(scoreOf(["number-0", "number-4"])).toBe(4)
  })
})

describe("the Flip 7", () => {
  const types = (faces: readonly CardKey[]) => faces.map(cardType)

  it("takes seven different numbers", () => {
    expect(FLIP_7).toBe(7)
    expect(isFlip7(types(numbers(1, 2, 3, 4, 5, 6, 7)))).toBe(true)
    expect(isFlip7(types(numbers(1, 2, 3, 4, 5, 6)))).toBe(false)
  })

  it("counts the zero, which only gives the chance of the bonus (page 2)", () => {
    expect(isFlip7(types(numbers(0, 1, 2, 3, 4, 5, 6)))).toBe(true)
    expect(scoreOf(numbers(0, 1, 2, 3, 4, 5, 6))).toBe(21 + 15)
  })

  it("is made of number cards only: modifiers and action cards never count (page 5)", () => {
    expect(isFlip7(types([...numbers(1, 2, 3, 4, 5, 6), "plus-2", "times-2", "second-chance", "freeze"]))).toBe(false)
  })

  it("reads the values of the number cards, in the order they came", () => {
    expect(numberValues(types(["number-9", "plus-2", "number-3", "freeze"]))).toEqual([9, 3])
    expect(lineScore([])).toBe(0)
  })
})
