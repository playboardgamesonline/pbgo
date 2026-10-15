import { describe, expect, it } from "vitest"
import { pendingSeats, STRIP_MAX_SEATS } from "./pending-seats"

const players = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, nickname: `Player ${i + 1}` }))
const ids = (n: number) => players(n).map((p) => p.id)

describe("pendingSeats", () => {
  it("has no strip when the game waits for nobody or for a single player: that is a classic turn", () => {
    expect(pendingSeats({ players: players(4), waitingFor: [], present: ids(4), meId: "p1" })).toBeNull()
    expect(pendingSeats({ players: players(4), waitingFor: ["p2"], present: ids(4), meId: "p1" })).toBeNull()
  })

  it("lists every seat in seat order, whatever the order of waitingFor", () => {
    const result = pendingSeats({ players: players(4), waitingFor: ["p4", "p2"], present: ids(4), meId: "p1" })
    expect(result?.seats.map((s) => s.id)).toEqual(["p1", "p2", "p3", "p4"])
    expect(result?.seats.map((s) => s.waiting)).toEqual([false, true, false, true])
  })

  it("keeps the nickname of each seat", () => {
    const result = pendingSeats({ players: players(2), waitingFor: ["p1", "p2"], present: ids(2), meId: null })
    expect(result?.seats.map((s) => s.nickname)).toEqual(["Player 1", "Player 2"])
  })

  it("counts the seats the game no longer waits for as ready", () => {
    const result = pendingSeats({ players: players(5), waitingFor: ["p2", "p3"], present: ids(5), meId: "p1" })
    expect(result).toMatchObject({ ready: 3, total: 5 })
  })

  it("marks the viewer, also when they are done and the others are not", () => {
    const result = pendingSeats({ players: players(3), waitingFor: ["p2", "p3"], present: ids(3), meId: "p1" })
    expect(result?.seats.find((s) => s.me)).toMatchObject({ id: "p1", waiting: false })
    expect(result?.seats.filter((s) => s.me)).toHaveLength(1)
  })

  it("marks no seat as the viewer for a spectator", () => {
    const result = pendingSeats({ players: players(3), waitingFor: ["p1", "p2"], present: ids(3), meId: null })
    expect(result?.seats.some((s) => s.me)).toBe(false)
  })

  it("marks the players not seen in the last 75 s as away, waiting or done", () => {
    const result = pendingSeats({ players: players(4), waitingFor: ["p2", "p3"], present: ["p1", "p3"], meId: "p1" })
    expect(result?.seats.map((s) => s.away)).toEqual([false, true, false, true])
  })

  it(`lists every seat up to ${STRIP_MAX_SEATS} and collapses beyond`, () => {
    const at = (n: number) => pendingSeats({ players: players(n), waitingFor: ids(n).slice(0, 2), present: ids(n), meId: "p1" })
    expect(at(STRIP_MAX_SEATS)?.collapsed).toBe(false)
    expect(at(STRIP_MAX_SEATS + 1)?.collapsed).toBe(true)
    expect(at(100)).toMatchObject({ collapsed: true, total: 100, ready: 98 })
  })
})
