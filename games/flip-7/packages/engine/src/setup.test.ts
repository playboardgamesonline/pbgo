import { isEngineError } from "@pbgo/engine-kit"
import { describe, expect, it } from "vitest"
import { CATALOGUE } from "./catalogue"
import { DEFAULT_TARGET } from "./options"
import { MAX_PLAYERS, MIN_PLAYERS, setupGame } from "./setup"
import { PLAYER_IDS, newState, players, problems, refusal, seedOf, waiting } from "./test-utils"

describe("setting up a table", () => {
  it("seats 3 to 8 players (the booklet says 3+; the web edition stops at the 8 a screen can show)", () => {
    expect([MIN_PLAYERS, MAX_PLAYERS]).toEqual([3, 8])
    for (let n = MIN_PLAYERS; n <= MAX_PLAYERS; n++) {
      const state = newState(n, seedOf(n))
      expect(state.seats, `${n} players`).toEqual(PLAYER_IDS.slice(0, n))
      expect(problems(state), `${n} players`).toEqual([])
    }
  })

  it.each<[string, unknown]>([
    ["two players", players(2)],
    ["nobody", []],
    ["nine players", [...players(8), { id: "sam", nickname: "SAM" }]],
    ["the same player twice", [...players(2), { id: "ana", nickname: "ANA" }]],
    ["an empty id", [...players(2), { id: "", nickname: "?" }]],
    ["an id that is not a text", [...players(2), { id: 7, nickname: "?" }]],
    ["no list", undefined],
    ["a list of nothing", [null, null, null]],
  ])("refuses %s with INVALID_PLAYERS", (_name, list) => {
    expect(refusal(() => setupGame({ players: list as never }))).toBe("INVALID_PLAYERS")
  })

  it("throws an EngineError the platform can read", () => {
    try {
      setupGame({ players: players(2) })
      expect.unreachable()
    } catch (error) {
      expect(isEngineError(error)).toBe(true)
    }
  })

  it("gives the 94 cards 94 different ids that say nothing of the face (opaque ids)", () => {
    const state = newState(4)
    expect(state.ids).toHaveLength(CATALOGUE.length)
    expect(new Set(state.ids).size).toBe(94)
    expect(state.ids.some((id, index) => id !== index)).toBe(true)
  })

  it("deals the first round: nothing is banked yet, and the game waits for one player", () => {
    const state = newState(5)
    expect(state.rounds).toEqual([])
    expect(state.status.every((status) => status !== "busted")).toBe(true)
    expect(PLAYER_IDS).toContain(waiting(state))
    expect(problems(state)).toEqual([])
  })

  it("is the same game for the same seed and a different one for another", () => {
    expect(newState(4, seedOf(3))).toEqual(newState(4, seedOf(3)))
    expect(newState(4, seedOf(3)).deck).not.toEqual(newState(4, seedOf(4)).deck)
  })

  it("draws a seed of its own when it is given none", () => {
    expect(problems(setupGame({ players: players(3) }))).toEqual([])
  })

  it("makes every seat a first dealer, depending on the seed", () => {
    // `dealer` is the dealer of the round being played: in the first round, the one the seed chose
    const dealers = new Set<number>()
    for (let i = 0; i < 60; i++) dealers.add(newState(3, seedOf(i)).dealer)
    expect([...dealers].sort()).toEqual([0, 1, 2])
  })

  it("starts from the options: 200 points by default, the others normalized", () => {
    expect(newState(3).options).toEqual({ targetScore: DEFAULT_TARGET })
    expect(newState(3, seedOf(0), { targetScore: 100 }).options).toEqual({ targetScore: 100 })
    expect(newState(3, seedOf(0), { targetScore: 120 }).options).toEqual({ targetScore: 100 })
    expect(newState(3, seedOf(0), { targetScore: 9999 }).options).toEqual({ targetScore: 500 })
    expect(newState(3, seedOf(0), { targetScore: "lots" }).options).toEqual({ targetScore: 200 })
    expect(newState(3, seedOf(0), { frobnicate: true }).options).toEqual({ targetScore: 200 })
  })
})
