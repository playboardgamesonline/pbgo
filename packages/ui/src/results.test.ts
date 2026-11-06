import { describe, expect, it } from "vitest"
import { lengthOf, pointsLabel, pointsTone, recordOf, winRate } from "./results"

describe("winRate", () => {
  it("is the share of the games won, in whole percent", () => {
    expect(winRate(14, 24)).toBe(58)
    expect(winRate(1, 3)).toBe(33)
    expect(winRate(2, 3)).toBe(67)
    expect(winRate(0, 5)).toBe(0)
    expect(winRate(5, 5)).toBe(100)
  })

  it("is nothing for a visitor who played no game", () => {
    expect(winRate(0, 0)).toBeNull()
  })
})

describe("recordOf", () => {
  it("says the wins and the games, in the singular where there is one", () => {
    expect(recordOf(14, 24)).toBe("14 wins in 24 games")
    expect(recordOf(1, 1)).toBe("1 win in 1 game")
    expect(recordOf(0, 3)).toBe("0 wins in 3 games")
    expect(recordOf(1, 12)).toBe("1 win in 12 games")
  })
})

describe("pointsLabel", () => {
  it("writes the points a game gave with a plus and the ones it took with a minus", () => {
    expect([32, 1, -11, -1].map(pointsLabel)).toEqual(["+32", "+1", "−11", "−1"])
  })

  it("writes 0 for a game that moved nothing and a dash where no points apply", () => {
    expect(pointsLabel(0)).toBe("0")
    expect(pointsLabel(null)).toBe("—")
  })
})

describe("pointsTone", () => {
  it("is green for a gain, red for a loss and grey for none", () => {
    expect([32, -11, 0, null].map(pointsTone)).toEqual(["success", "destructive", "secondary", "secondary"])
  })
})

describe("lengthOf", () => {
  it("says the minutes of a game of less than an hour", () => {
    expect([34 * 60, 20 * 60 + 29, 59 * 60].map(lengthOf)).toEqual(["34 min", "20 min", "59 min"])
  })

  it("says the hours and the minutes of a longer one, and rounds up to the hour", () => {
    expect([65 * 60, 130 * 60, 59 * 60 + 40].map(lengthOf)).toEqual(["1 h 05", "2 h 10", "1 h 00"])
  })

  it("says at least one minute", () => {
    expect([0, 10].map(lengthOf)).toEqual(["1 min", "1 min"])
  })
})
