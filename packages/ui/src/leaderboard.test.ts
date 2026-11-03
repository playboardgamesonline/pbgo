import { describe, expect, it } from "vitest"
import { boardOf, type LeaderboardRow } from "./leaderboard"

const row = (id: string, place: number | null): LeaderboardRow => ({ id, place, name: id, rank: { tier: "Gold", division: 2 } })
const top = (count: number) => Array.from({ length: count }, (_, index) => row(`p${index + 1}`, index + 1))

describe("boardOf", () => {
  it("draws the first rows of the top, and nothing of the visitor when they are not given", () => {
    const board = boardOf(top(15), null, 10)
    expect(board.rows.map((one) => one.id)).toEqual(top(10).map((one) => one.id))
    expect(board.own).toBeNull()
    expect(board.gap).toBe(false)
    expect(boardOf(top(15), undefined, 10).own).toBeNull()
  })

  it("does not draw the visitor twice when they are among the rows", () => {
    const board = boardOf(top(15), row("p4", 4), 10)
    expect(board.own).toBeNull()
    expect(board.gap).toBe(false)
  })

  it("adds the visitor's row after the top when they are outside it", () => {
    const board = boardOf(top(15), row("me", 40), 10)
    expect(board.rows).toHaveLength(10)
    expect(board.own?.id).toBe("me")
    expect(board.gap).toBe(true)
  })

  it("runs the visitor's row on from the top, with no gap, when they come right after it", () => {
    expect(boardOf(top(15), row("p11", 11), 10)).toMatchObject({ own: { id: "p11" }, gap: false })
    expect(boardOf(top(10), row("me", 11), 10)).toMatchObject({ own: { id: "me" }, gap: false })
    expect(boardOf(top(10), row("me", 12), 10).gap).toBe(true)
  })

  it("leaves a gap before a visitor who is not ranked yet, but not under an empty board", () => {
    expect(boardOf(top(5), row("me", null), 10)).toMatchObject({ own: { id: "me" }, gap: true })
    expect(boardOf([], row("me", null), 10)).toMatchObject({ rows: [], own: { id: "me" }, gap: false })
  })

  it("draws a short board as it is, and an empty one empty", () => {
    expect(boardOf(top(3), null, 10).rows).toHaveLength(3)
    expect(boardOf([], null, 10)).toEqual({ rows: [], own: null, gap: false })
    expect(boardOf(top(3), null, 0).rows).toEqual([])
  })

  it("does not change the list it is given", () => {
    const list = top(12)
    boardOf(list, row("me", 30), 5)
    expect(list).toHaveLength(12)
  })
})
