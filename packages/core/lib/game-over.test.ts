import type { PlayerResult, Results } from "@pbgo/engine-kit"
import { describe, expect, it } from "vitest"
import { GAME_OVER_TIMING, pointsLine, rowDelay, sectionMotion, signed, splitResults } from "./game-over"
import { REDUCED_FADE } from "./motion-preference"

const result = (playerId: string, total: number, rank: number): PlayerResult => ({ playerId, total, rank, detail: [] })

describe("splitResults", () => {
  it("makes the winner the hero and the others the ranking", () => {
    const results: Results = { winners: ["b"], players: [result("a", 4, 3), result("b", 9, 1), result("c", 6, 2)] }
    const { winners, others } = splitResults(results)
    expect(winners.map((r) => r.playerId)).toEqual(["b"])
    expect(others.map((r) => r.playerId)).toEqual(["c", "a"])
  })

  it("puts every winner of a tie in the hero", () => {
    const results: Results = { winners: ["a", "c"], players: [result("a", 7, 1), result("b", 2, 3), result("c", 7, 1)] }
    const { winners, others } = splitResults(results)
    expect(winners.map((r) => r.playerId)).toEqual(["a", "c"])
    expect(others.map((r) => r.playerId)).toEqual(["b"])
  })

  it("keeps the seat order between players of the same rank", () => {
    const results: Results = { winners: ["a"], players: [result("a", 9, 1), result("b", 3, 2), result("c", 3, 2), result("d", 3, 2)] }
    expect(splitResults(results).others.map((r) => r.playerId)).toEqual(["b", "c", "d"])
  })

  it("leaves the results untouched", () => {
    const players = [result("a", 4, 2), result("b", 9, 1)]
    splitResults({ winners: ["b"], players })
    expect(players.map((r) => r.playerId)).toEqual(["a", "b"])
  })

  it("has no hero when nobody won, and every player in the ranking", () => {
    const { winners, others } = splitResults({ winners: [], players: [result("a", 1, 2), result("b", 1, 1)] })
    expect(winners).toEqual([])
    expect(others.map((r) => r.playerId)).toEqual(["b", "a"])
  })
})

describe("pointsLine", () => {
  const pts = (points: number) => `${points} pts`

  it("writes a gain with a plus sign", () => {
    expect(pointsLine(10, pts)).toBe("+10 pts")
  })

  it("writes zero and a loss as they are", () => {
    expect(pointsLine(0, pts)).toBe("0 pts")
    expect(pointsLine(-3, pts)).toBe("-3 pts")
  })
})

describe("signed", () => {
  it("is the score chip's number", () => {
    expect(signed(3)).toBe("+3")
    expect(signed(0)).toBe("0")
    expect(signed(-2)).toBe("-2")
  })
})

describe("rowDelay", () => {
  it("starts the first row once the panel has settled", () => {
    expect(rowDelay(0)).toBe(GAME_OVER_TIMING.rows)
  })

  it("brings the rows in one after the other", () => {
    expect(rowDelay(1)).toBeCloseTo(GAME_OVER_TIMING.rows + GAME_OVER_TIMING.step)
    expect(rowDelay(2)).toBeGreaterThan(rowDelay(1))
  })

  it("stops waiting for a long table: the rows past the cap come together", () => {
    const cap = rowDelay(GAME_OVER_TIMING.maxSteps)
    expect(rowDelay(GAME_OVER_TIMING.maxSteps + 1)).toBe(cap)
    expect(rowDelay(40)).toBe(cap)
  })

  it("never starts before the panel has settled, whatever the index", () => {
    expect(rowDelay(-1)).toBe(GAME_OVER_TIMING.rows)
  })
})

describe("sectionMotion", () => {
  it("settles the panel with a spring when the game is lively", () => {
    const m = sectionMotion("lively")
    expect(m.transition).toMatchObject({ type: "spring" })
    expect(m.initial).toEqual({ opacity: 0, y: 24, scale: 0.97 })
    expect(m.animate).toEqual({ opacity: 1, y: 0, scale: 1 })
  })

  it("only slides the panel in, with no spring and no scale, when the game is calm", () => {
    const m = sectionMotion("calm")
    expect(m.transition).not.toHaveProperty("type")
    expect(m.initial).toEqual({ opacity: 0, y: 12, scale: 1 })
  })

  it("only fades the panel under reduced motion, for 150 ms at most", () => {
    const m = sectionMotion("reduced")
    expect(m.initial).toEqual({ opacity: 0, y: 0, scale: 1 })
    expect(m.transition).toMatchObject({ duration: REDUCED_FADE })
  })

  it("goes out the way it came in", () => {
    for (const motion of ["reduced", "calm", "lively"] as const) {
      const m = sectionMotion(motion)
      expect(m.exit).toEqual(m.initial)
    }
  })
})
