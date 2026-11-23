import { describe, expect, it } from "vitest"
import { assertPlayers, nextSeat, playerAt, seatOf } from "./players"

const seat = (id: string) => ({ id, nickname: `Nick ${id}` })

describe("assertPlayers", () => {
  it("lets a table of the right size with different ids sit down", () => {
    expect(() => assertPlayers([seat("a"), seat("b"), seat("c")], { min: 2, max: 4 })).not.toThrow()
  })

  it.each([
    ["nobody", []],
    ["too few", [seat("a")]],
    ["too many", ["a", "b", "c", "d", "e"].map(seat)],
    ["the same id twice", [seat("a"), seat("b"), seat("a")]],
    ["an empty id", [seat("a"), seat("")]],
  ])("refuses a table of %s with INVALID_PLAYERS", (_, players) => {
    expect(() => assertPlayers(players, { min: 2, max: 4 })).toThrow(expect.objectContaining({ code: "INVALID_PLAYERS" }))
  })
})

describe("seats", () => {
  const seats = ["ann", "bob", "cy", "di"]

  it("gives a player their place in the array, and -1 when they are not at the table", () => {
    expect(seatOf(seats, "cy")).toBe(2)
    expect(seatOf(seats, "zed")).toBe(-1)
  })

  it("gives the player in a seat back, and refuses a seat that does not exist", () => {
    for (const [i, id] of seats.entries()) expect(playerAt(seats, i)).toBe(id)
    expect(() => playerAt(seats, 4)).toThrow(RangeError)
    expect(() => playerAt(seats, -1)).toThrow(RangeError)
  })

  it("agrees with itself: the player in the seat of a player is that player", () => {
    for (const id of seats) expect(playerAt(seats, seatOf(seats, id))).toBe(id)
  })
})

describe("the next seat", () => {
  it("is the seat on the left, the modulo wrapping the end of the table", () => {
    expect(nextSeat(4, 0)).toBe(1)
    expect(nextSeat(4, 3)).toBe(0)
  })

  it("passes over the seats that are ruled out", () => {
    const out = new Set([1, 2])
    expect(nextSeat(4, 0, (seat) => out.has(seat))).toBe(3)
    expect(nextSeat(4, 3, (seat) => out.has(seat))).toBe(0)
  })

  it("comes back to `from` last: it is the only seat left when every other is ruled out", () => {
    expect(nextSeat(4, 2, (seat) => seat !== 2)).toBe(2)
  })

  it("is none when every seat is ruled out", () => {
    expect(nextSeat(4, 0, () => true)).toBeNull()
    expect(nextSeat(0, 0)).toBeNull()
  })

  it("goes round the whole table of two", () => {
    expect(nextSeat(2, 0)).toBe(1)
    expect(nextSeat(2, 1)).toBe(0)
  })

  it("goes clockwise from any seat, even one the table does not have", () => {
    expect(nextSeat(4, -1)).toBe(0)
    expect(nextSeat(4, 6)).toBe(3)
  })
})
