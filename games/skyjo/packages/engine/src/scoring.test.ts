import { describe, expect, it } from "vitest"
import { columnCells, columnOf, isPosition, isTriple, roundScores, sum } from "./scoring"

// Rulebook, page 3: the count of a round, and the doubling of the player who ended it.

describe("the cells of a grid", () => {
  it("are numbered column by column: three cells per column, four columns", () => {
    expect(columnCells(0)).toEqual([0, 1, 2])
    expect(columnCells(3)).toEqual([9, 10, 11])
    expect([0, 2, 3, 11].map(columnOf)).toEqual([0, 0, 1, 3])
  })

  it("only name cells 0 to 11", () => {
    expect([0, 11].every(isPosition)).toBe(true)
    for (const bad of [-1, 12, 1.5, "3", null, undefined, NaN, {}]) expect(isPosition(bad), String(bad)).toBe(false)
  })
})

describe("a column to throw away (page 2)", () => {
  it("is three equal cards, whatever they are worth", () => {
    expect(isTriple([4, 4, 4])).toBe(true)
    expect(isTriple([-2, -2, -2])).toBe(true)
    expect(isTriple([12, 12, 12])).toBe(true)
    expect(isTriple([0, 0, 0])).toBe(true)
    expect(isTriple([4, 4, 5])).toBe(false)
    expect(isTriple([4, 4])).toBe(false)
  })
})

describe("the count of a round (page 3)", () => {
  it("adds the cards, the negative ones taking points off", () => {
    expect(sum([12, -2, 0, 7, -1])).toBe(16)
  })

  it("does not change what the other players score", () => {
    expect(roundScores([20, 24, 31], 0)).toEqual({ scores: [20, 24, 31], doubled: false })
  })

  it("doubles the player who ended the round when they do not have strictly the lowest count", () => {
    // the rulebook's example: A ends with 10, B has 24, C has 10: A is not strictly lowest, so 20
    expect(roundScores([10, 24, 10], 0)).toEqual({ scores: [20, 24, 10], doubled: true })
    expect(roundScores([30, 24, 31], 0)).toEqual({ scores: [60, 24, 31], doubled: true })
  })

  it("leaves the ender's count alone when it is strictly the lowest", () => {
    expect(roundScores([9, 24, 10], 0)).toEqual({ scores: [9, 24, 10], doubled: false })
    expect(roundScores([24, 9, 10, 11], 1)).toEqual({ scores: [24, 9, 10, 11], doubled: false })
  })

  it("only doubles positive points: a zero or a negative count stays as it is", () => {
    expect(roundScores([0, -3, 4], 0)).toEqual({ scores: [0, -3, 4], doubled: false })
    expect(roundScores([-2, -2, 5], 0)).toEqual({ scores: [-2, -2, 5], doubled: false })
    expect(roundScores([-5, 3], 0).doubled).toBe(false)
  })

  it("doubles the ender whichever seat it is, and nobody else", () => {
    expect(roundScores([3, 8, 5, 7], 2)).toEqual({ scores: [3, 8, 10, 7], doubled: true })
  })

  it("knows a round nobody ended: no doubling", () => {
    expect(roundScores([10, 10], null)).toEqual({ scores: [10, 10], doubled: false })
  })

  it("works at two players: the ender doubles unless strictly below the other", () => {
    expect(roundScores([8, 8], 1)).toEqual({ scores: [8, 16], doubled: true })
    expect(roundScores([8, 9], 0)).toEqual({ scores: [8, 9], doubled: false })
  })
})
