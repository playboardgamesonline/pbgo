import { EngineError, type AnyGameDefinition } from "@pbgo/engine-kit"
import { describe, expect, it, vi } from "vitest"
import type { PublicPlayer } from "../lib/game-types"
import type { GameRow } from "./games"
import { MAX_SETTLE_STEPS, departureOf, hasLeft, isSeated, leavePatch, sameSeats, seatedPlayers, settleLeavers } from "./table-rules"

const ann: PublicPlayer = { id: "p1", nickname: "Ann" }
const bob: PublicPlayer = { id: "p2", nickname: "Bob" }
const cy: PublicPlayer = { id: "p3", nickname: "Cy" }

const row = (partial: Partial<GameRow> = {}): Pick<GameRow, "status" | "players" | "host_id" | "ready_at" | "ready_deadline"> => ({
  status: "playing",
  players: [ann, bob, cy],
  host_id: "p1",
  ready_at: {},
  ready_deadline: null,
  ...partial,
})

describe("who is at a table", () => {
  it("counts a player who did not leave as seated, and nobody who is not at the table", () => {
    const table = { players: [ann, { ...bob, left: true }] }
    expect(isSeated(table, "p1")).toBe(true)
    expect(isSeated(table, "p2")).toBe(false)
    expect(isSeated(table, "nobody")).toBe(false)
    expect(isSeated(table, null)).toBe(false)
    expect(isSeated(table, undefined)).toBe(false)
  })

  it("keeps the players who did not leave, in their order", () => {
    expect(hasLeft({ left: true })).toBe(true)
    expect(hasLeft({})).toBe(false)
    expect(seatedPlayers([ann, { ...bob, left: true }, cy])).toEqual([ann, cy])
  })

  it("tells a table that changed from one that did not", () => {
    expect(sameSeats([ann, bob], [ann, bob])).toBe(true)
    expect(sameSeats([ann, bob], [bob, ann])).toBe(false)
    expect(sameSeats([ann, bob], [ann])).toBe(false)
    expect(sameSeats([], [])).toBe(true)
  })
})

describe("leavePatch", () => {
  it("unseats a player who leaves the lobby, and gives the table to the next one when the host goes", () => {
    expect(leavePatch(row({ status: "lobby" }), "p2")).toEqual({ players: [ann, cy], host_id: "p1" })
    expect(leavePatch(row({ status: "lobby" }), "p1")).toEqual({ players: [bob, cy], host_id: "p2" })
  })

  it("keeps the host of a lobby that its last player leaves", () => {
    expect(leavePatch(row({ status: "lobby", players: [ann] }), "p1")).toEqual({ players: [], host_id: "p1" })
  })

  it("ends the ready check of a table that is starting: the player is unseated and the others are back in the lobby", () => {
    const starting = row({ status: "starting", ready_at: { p1: "2026-11-10T10:00:00.000Z" }, ready_deadline: "2026-11-10T10:01:00.000Z" })
    expect(leavePatch(starting, "p2")).toMatchObject({ status: "lobby", players: [ann, cy], host_id: "p1", state: null, ready_at: {}, ready_deadline: null })
  })

  it("marks the seat of a player who leaves a game in progress, and keeps it where it was", () => {
    expect(leavePatch(row(), "p2")).toEqual({ players: [ann, { ...bob, left: true }, cy] })
  })

  it("marks the seat of a player who leaves a table that is over, so that the others' rematch does not wait for them", () => {
    expect(leavePatch(row({ status: "over" }), "p1")).toEqual({ players: [{ ...ann, left: true }, bob, cy] })
  })

  it("changes nothing for a player who is not at the table, or one who left already", () => {
    for (const status of ["lobby", "starting", "playing", "over"] as const) {
      expect(leavePatch(row({ status }), "nobody")).toBeNull()
      expect(leavePatch(row({ status, players: [ann, { ...bob, left: true }] }), "p2")).toBeNull()
    }
  })
})

describe("settleLeavers", () => {
  /** Players move in turn and the game is over after `length` moves; `autoPlayFor` is a move. */
  type Turns = { players: string[]; turn: number; length: number }
  const turns = (overrides: Partial<AnyGameDefinition> = {}): AnyGameDefinition =>
    ({
      isOver: (state: Turns) => state.turn >= state.length,
      waitingFor: (state: Turns) => (state.turn >= state.length ? [] : [state.players[state.turn % state.players.length]!]),
      autoPlayFor: (state: Turns) => ({ ...state, turn: state.turn + 1 }),
      ...overrides,
    }) as unknown as AnyGameDefinition
  const start: Turns = { players: ["p1", "p2", "p3"], turn: 0, length: 30 }
  const at = (turn: number): Turns => ({ ...start, turn })

  it("plays nothing while nobody left", () => {
    expect(settleLeavers(turns(), at(1), [ann, bob, cy])).toEqual({ state: at(1), played: [] })
  })

  it("plays for the player who left when it is their turn, and stops at the next one who is there", () => {
    expect(settleLeavers(turns(), at(1), [ann, { ...bob, left: true }, cy])).toEqual({ state: at(2), played: ["p2"] })
  })

  it("plays every turn in a row that belongs to players who left", () => {
    const result = settleLeavers(turns(), at(1), [ann, { ...bob, left: true }, { ...cy, left: true }])
    expect(result).toEqual({ state: at(3), played: ["p2", "p3"] })
  })

  it("leaves the game alone when it waits for somebody who is there", () => {
    expect(settleLeavers(turns(), at(0), [ann, { ...bob, left: true }, cy])).toEqual({ state: at(0), played: [] })
  })

  it("does not play a game out alone when everybody left", () => {
    expect(settleLeavers(turns(), at(0), [{ ...ann, left: true }, { ...bob, left: true }])).toEqual({ state: at(0), played: [] })
  })

  it("plays up to the end of the game when the last moves are theirs", () => {
    const result = settleLeavers(turns(), { ...start, turn: 28, length: 30 }, [ann, { ...bob, left: true }, { ...cy, left: true }])
    // turn 28 is p2's (28 % 3 = 1), 29 is p3's, then the game is over
    expect(result).toEqual({ state: { ...start, turn: 30, length: 30 }, played: ["p2", "p3"] })
  })

  it("plays only for the players who left on a step several players owe", () => {
    type Step = { pending: string[] }
    const simultaneous = {
      isOver: () => false,
      waitingFor: (state: Step) => state.pending,
      autoPlayFor: (state: Step, playerId: string) => ({ pending: state.pending.filter((id) => id !== playerId) }),
    } as unknown as AnyGameDefinition
    const result = settleLeavers(simultaneous, { pending: ["p1", "p2", "p3"] }, [ann, { ...bob, left: true }, cy])
    expect(result).toEqual({ state: { pending: ["p1", "p3"] }, played: ["p2"] })
  })

  it("plays nothing in a game that cannot be played for a player", () => {
    const stuck = turns({ autoPlayFor: undefined })
    expect(settleLeavers(stuck, at(1), [ann, { ...bob, left: true }, cy])).toEqual({ state: at(1), played: [] })
  })

  it("stops quietly when the engine refuses, and the state stays as it was", () => {
    const refusing = turns({
      autoPlayFor: () => {
        throw new EngineError("NOT_WAITING")
      },
    })
    expect(settleLeavers(refusing, at(1), [ann, { ...bob, left: true }, cy])).toEqual({ state: at(1), played: [] })
  })

  it("does not hide a bug of the engine", () => {
    const broken = turns({
      autoPlayFor: () => {
        throw new TypeError("boom")
      },
    })
    expect(() => settleLeavers(broken, at(1), [ann, { ...bob, left: true }, cy])).toThrow("boom")
  })

  it("stops an engine that never moves on", () => {
    const autoPlayFor = vi.fn((state: Turns) => state)
    const result = settleLeavers(turns({ autoPlayFor }), at(1), [ann, { ...bob, left: true }, cy])
    expect(autoPlayFor).toHaveBeenCalledTimes(MAX_SETTLE_STEPS)
    expect(result.played).toEqual(["p2"])
  })
})

describe("departureOf", () => {
  it("says where a player was when they left a table that had begun, and nothing for a lobby", () => {
    expect(departureOf("starting")).toBe("starting")
    expect(departureOf("playing")).toBe("playing")
    expect(departureOf("over")).toBe("over")
    expect(departureOf("lobby")).toBeNull()
  })
})
