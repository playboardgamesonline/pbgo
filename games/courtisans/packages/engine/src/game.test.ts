import { describe, expect, it } from "vitest"
import { GAME } from "./game"
import { testMissions } from "./test-utils"

const players = [
  { id: "a", nickname: "Alice" },
  { id: "b", nickname: "Bob" },
  { id: "c", nickname: "Chloé" },
]

describe("GAME (@pbgo/engine-kit contract)", () => {
  it("sets up a game from the lobby players and the loaded missions", () => {
    const state = GAME.setup({ players, options: {}, seed: 42, data: testMissions() })
    expect(state.players.map((j) => [j.id, j.nickname])).toEqual([["a", "Alice"], ["b", "Bob"], ["c", "Chloé"]])
    expect(state.players.every((j) => j.missions.length === 2)).toBe(true)
    expect(GAME.isOver(state)).toBe(false)
  })

  it("is deterministic with a seed", () => {
    const a = GAME.setup({ players, options: {}, seed: 7, data: testMissions() })
    const b = GAME.setup({ players, options: {}, seed: 7, data: testMissions() })
    expect(a).toEqual(b)
  })

  it("applies an action", () => {
    const state = GAME.setup({ players, options: {}, seed: 1, data: testMissions() })
    const next = GAME.apply(state, { type: "readMissions", playerId: "b" })
    expect(next.players.find((j) => j.id === "b")!.missionsRead).toBe(true)
  })

  it("plays a game to the end with the debug commands", () => {
    const state = GAME.setup({ players, options: {}, seed: 3, data: testMissions() })
    const over = GAME.debug!.over!(state)
    expect(GAME.isOver(over)).toBe(true)
    expect(GAME.view(over, "a").players).toHaveLength(3)
  })
})

describe("GAME.autoPlay (joueur absent)", () => {
  it("plays the whole turn of the active player once the banquet has started", () => {
    const state = GAME.debug!.missions!(GAME.setup({ players, options: {}, seed: 5, data: testMissions() }))
    const active = GAME.activePlayer!(state)
    expect(active).not.toBeNull()
    const next = GAME.autoPlay!(state)
    expect(GAME.activePlayer!(next)).not.toBe(active)
  })

  it("also works on a brand new game (admin preview): missions are read for everyone, then a turn is played", () => {
    const next = GAME.autoPlay!(GAME.setup({ players, options: {}, seed: 8, data: testMissions() }))
    expect(next.phase).toBe("playing")
    expect(next.players.every((j) => j.missionsRead)).toBe(true)
    expect(next.log.length).toBeGreaterThan(0)
  })

  it("has nobody to wait for while the missions are being read", () => {
    const state = GAME.setup({ players, options: {}, seed: 5, data: testMissions() })
    expect(GAME.activePlayer!(state)).toBeNull()
  })
})

describe("GAME.debug.missions (tout le monde a lu)", () => {
  it("marks every player as ready, which starts the banquet", () => {
    const state = GAME.setup({ players, options: {}, seed: 2, data: testMissions() })
    expect(state.phase).toBe("missions")
    const started = GAME.debug!.missions!(state)
    expect(started.phase).toBe("playing")
    expect(started.players.every((j) => j.missionsRead)).toBe(true)
  })
})
