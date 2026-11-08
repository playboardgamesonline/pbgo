import { describe, expect, it } from "vitest"
import { seatStateOf, type SeatTable } from "./state"

const table = (patch: Partial<SeatTable> = {}): SeatTable => ({ status: "playing", waitingFor: ["a"], present: ["a", "b", "c"], winners: [], ...patch })

describe("seatStateOf", () => {
  it("makes the only player the game waits for the player of the turn", () => {
    expect(seatStateOf(table(), "a")).toMatchObject({ active: true, waiting: false })
  })

  it("makes each of several players the game waits for an expected player, and nobody the player of the turn", () => {
    const simultaneous = table({ waitingFor: ["a", "b"] })
    expect(seatStateOf(simultaneous, "a")).toMatchObject({ active: false, waiting: true })
    expect(seatStateOf(simultaneous, "b")).toMatchObject({ active: false, waiting: true })
  })

  it("makes the others neither the turn nor expected", () => {
    expect(seatStateOf(table(), "b")).toMatchObject({ active: false, waiting: false })
    expect(seatStateOf(table({ waitingFor: [] }), "a")).toMatchObject({ active: false, waiting: false })
  })

  it("makes a player away only while the game goes on and the table has not seen them", () => {
    expect(seatStateOf(table({ present: ["a"] }), "b").away).toBe(true)
    expect(seatStateOf(table({ present: ["a"] }), "a").away).toBe(false)
    expect(seatStateOf(table({ status: "lobby", present: [] }), "b").away).toBe(false)
    expect(seatStateOf(table({ status: "starting", present: [] }), "b").away).toBe(false)
  })

  it("does not fade anybody at the end of the game, whoever has left by then", () => {
    expect(seatStateOf(table({ status: "over", waitingFor: [], present: [] }), "b").away).toBe(false)
  })

  it("keeps the turn of a player who is away", () => {
    expect(seatStateOf(table({ present: ["b"] }), "a")).toMatchObject({ active: true, away: true })
  })

  it("makes the winners winners once the game is over, and not before", () => {
    expect(seatStateOf(table({ status: "over", waitingFor: [], winners: ["b"] }), "b").winner).toBe(true)
    expect(seatStateOf(table({ status: "over", waitingFor: [], winners: ["b"] }), "a").winner).toBe(false)
    expect(seatStateOf(table({ winners: ["b"] }), "b").winner).toBe(false)
  })
})
