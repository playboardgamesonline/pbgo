import { createRng, defaultOptions } from "@pbgo/engine-kit"
import { describe, expect, it } from "vitest"
import { step } from "./actions"
import { GAME } from "./game"
import { OPTIONS } from "./options"
import { setupGame } from "./setup"
import { CLIENT_ACTIONS, FLIP7_ERROR_CODES } from "./types"
import { newState, players, problems, randomAction, reorderKeys, seedOf, waiting } from "./test-utils"
import { playerView } from "./view"

// The game as the platform reads it: the `GameDefinition` of @pbgo/engine-kit.

describe("the game definition", () => {
  it("says who it is: Flip 7, 3 to 18 players, one option", () => {
    expect(GAME.id).toBe("flip-7")
    expect(GAME.name).toBe("Flip 7")
    expect([GAME.minPlayers, GAME.maxPlayers]).toEqual([3, 18])
    expect(Object.keys(GAME.options)).toEqual(["targetScore"])
    expect(defaultOptions(GAME.options)).toEqual({ targetScore: 200 })
    expect(GAME.options).toBe(OPTIONS)
  })

  it("accepts the actions of its clients: hit, stay, target and deal", () => {
    expect([...GAME.clientActions]).toEqual(["hit", "stay", "target", "deal"])
    expect(GAME.clientActions).toBe(CLIENT_ACTIONS)
  })

  it("sets up, applies and views as the engine does", () => {
    const state = GAME.setup({ players: players(4), options: { targetScore: 100 }, seed: seedOf(1) })
    expect(state).toEqual(setupGame({ players: players(4), options: { targetScore: 100 }, seed: seedOf(1) }))
    const action = randomAction(state, createRng(1))
    expect(GAME.apply(state, action)).toEqual(step(state, action).state)
    expect(GAME.view(state, "ana")).toEqual(playerView(state, "ana"))
    expect(GAME.view(state, null).me).toBeNull()
    expect(GAME.isOver(state)).toBe(false)
  })

  it("waits for one player at a time, whatever the step, and for nobody once it is over", () => {
    const rng = createRng(seedOf(4))
    let state = newState(5, seedOf(4))
    for (let i = 0; i < 2000 && !GAME.isOver(state); i++) {
      expect(GAME.waitingFor!(state), `move ${i}`).toHaveLength(1)
      state = step(state, randomAction(state, rng)).state
    }
    expect(GAME.isOver(state)).toBe(true)
    expect(GAME.waitingFor!(state)).toEqual([])
    expect(waiting(state)).toBeUndefined()
  })

  it("keeps its error codes in one list", () => {
    expect(FLIP7_ERROR_CODES).toContain("NOT_YOUR_TURN")
    expect(FLIP7_ERROR_CODES).toContain("NOT_WAITING")
    expect(new Set(FLIP7_ERROR_CODES).size).toBe(FLIP7_ERROR_CODES.length)
  })
})

describe("a state kept in jsonb", () => {
  it("plays the same after Postgres gave its keys back in another order", () => {
    // `jsonb` returns the keys of an object shortest first, then alphabetically: ids of different lengths on purpose
    const names = ["a", "bobby", "cl", "dan", "eve-the-last"]
    const seed = seedOf(7)
    const rng = createRng(seed)
    let state = setupGame({ players: names.map((id) => ({ id, nickname: id })), seed })
    for (let i = 0; i < 1500 && !GAME.isOver(state); i++) {
      const action = randomAction(state, rng)
      const stored = reorderKeys(state)
      expect(step(stored, action).state, `move ${i}`).toEqual(step(state, action).state)
      expect(GAME.waitingFor!(stored)).toEqual(GAME.waitingFor!(state))
      expect(playerView(stored, "a")).toEqual(playerView(state, "a"))
      state = step(state, action).state
    }
    expect(problems(state)).toEqual([])
  })

  it("holds no object keyed by player: every order is an array of the state", () => {
    const state = newState(4, seedOf(2))
    const objects: string[] = []
    const walk = (value: unknown, path: string) => {
      if (Array.isArray(value)) value.forEach((item, index) => walk(item, `${path}[${index}]`))
      else if (value !== null && typeof value === "object") {
        objects.push(path)
        for (const [key, child] of Object.entries(value)) walk(child, `${path}.${key}`)
      }
    }
    walk(state, "state")
    // the options and the per-seat stats, whose keys are fixed words and carry no order
    expect(objects.filter((path) => !/^state(\.options|\.stats\[\d+\]|\.stack\[\d+\])?$/.test(path))).toEqual([])
  })
})
