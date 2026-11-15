import { CARDS, FLIP_7, isFlip7 } from "@flip-7/engine"
import { describe, expect, it } from "vitest"
import { madeFlip7 } from "./flip7-line"

const face = (type: string, id: number) => ({ id, type })
const numbers = (values: number[]) => values.map((value, i) => face(`number-${value}`, i))

describe("a Flip 7 on the board", () => {
  it("is seven different numbers, the number cards of a line counting once for a figure", () => {
    expect(madeFlip7(numbers([1, 2, 3, 4, 5, 6]))).toBe(false)
    expect(madeFlip7(numbers([1, 2, 3, 4, 5, 6, 7]))).toBe(true)
    expect(madeFlip7(numbers([1, 2, 3, 4, 5, 6, 6, 6]))).toBe(false)
    expect(madeFlip7(numbers([0, 12, 3, 4, 5, 6, 7, 8]))).toBe(true)
  })

  it("never counts an action card or a modifier", () => {
    expect(madeFlip7([...numbers([1, 2, 3, 4, 5, 6]), face("plus-4", 10), face("freeze", 11), face("second-chance", 12)])).toBe(false)
  })

  it("says what the engine says of the same cards", () => {
    const keys = Object.keys(CARDS).filter((key) => key.startsWith("number-"))
    for (const size of [3, FLIP_7 - 1, FLIP_7, FLIP_7 + 2]) {
      const line = keys.slice(0, size)
      expect(madeFlip7(line.map((key, i) => face(key, i))), `${size} different numbers`).toBe(isFlip7(line.map((key) => CARDS[key as keyof typeof CARDS])))
    }
  })
})
