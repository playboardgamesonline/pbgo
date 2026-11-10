import { createRng, defaultOptions, playStepFor, stepOf, viewLog } from "@pbgo/engine-kit"
import { describe, expect, it } from "vitest"
import { step } from "./actions"
import { GAME } from "./game"
import { OPTIONS } from "./options"
import { setupGame } from "./setup"
import { CLIENT_ACTIONS, FLIP7_ERROR_CODES } from "./types"
import { kinds, newState, players, problems, randomAction, reorderKeys, seedOf, waiting } from "./test-utils"
import { playerView } from "./view"

// The game as the platform reads it: the `GameDefinition` of @pbgo/engine-kit.

describe("the game definition", () => {
  it("says who it is: Flip 7, 3 to 8 players, one option", () => {
    expect(GAME.id).toBe("flip-7")
    expect(GAME.name).toBe("Flip 7")
    expect([GAME.minPlayers, GAME.maxPlayers]).toEqual([3, 8])
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

describe("what the game says happened", () => {
  it("plays through step and autoPlayStep as it does through apply and autoPlayFor, whatever the move", () => {
    const rng = createRng(seedOf(7))
    let state = newState(4, seedOf(7))
    for (let i = 0; i < 400 && !GAME.isOver(state); i++) {
      const action = randomAction(state, rng)
      const stepped = stepOf(GAME, state, action)
      expect(stepped.state, `move ${i}`).toEqual(GAME.apply(state, action))
      const [absent] = GAME.waitingFor!(state)
      expect(playStepFor(GAME, state, absent!).state, `move ${i}`).toEqual(GAME.autoPlayFor!(state, absent!))
      state = stepped.state
    }
    expect(GAME.isOver(state)).toBe(true)
  })

  it("says a game from its first round to the winners, in plain data that names only the players of the table", () => {
    const rng = createRng(seedOf(9))
    const seated = players(5)
    let state = newState(5, seedOf(9))
    const log = []
    for (let i = 0; i < 2000 && !GAME.isOver(state); i++) {
      const stepped = GAME.step!(state, randomAction(state, rng))
      log.push(...stepped.events)
      state = stepped.state
    }
    const kindsSaid = new Set(log.map(({ event }) => event.kind))
    expect(kindsSaid).toContain("round")
    expect(kindsSaid).toContain("draw")
    expect(kindsSaid).toContain("end")
    expect(log.at(-1)?.event).toMatchObject({ kind: "over" })
    // Nothing is hidden in Flip 7: every entry is public, and the same for everybody
    expect(log.every((entry) => entry.to === undefined && entry.masked === undefined)).toBe(true)
    expect(viewLog(log, "ana")).toEqual(viewLog(log, null))
    // Plain data: it goes through jsonb and comes back the same, and it names ids, never the nicknames of the table
    expect(JSON.parse(JSON.stringify(log))).toEqual(log)
    expect(JSON.stringify(log)).not.toContain(seated[0]!.nickname)
  })

  it("opens the log with the first round, dealt while the game is set up", () => {
    const table = { players: players(4), options: {}, seed: seedOf(2) }
    const opened = GAME.setupStep!(table)
    expect(opened.state).toEqual(GAME.setup(table))
    expect(kinds(opened)[0]).toBe("round")
    expect(kinds(opened).filter((kind) => kind === "draw").length).toBeGreaterThanOrEqual(4)
  })

  it("says something whenever a game plays for an absent player", () => {
    const rng = createRng(seedOf(5))
    let state = newState(5, seedOf(5))
    for (let i = 0; i < 400 && !GAME.isOver(state); i++) {
      const [absent] = GAME.waitingFor!(state)
      expect(playStepFor(GAME, state, absent!).events.length, `move ${i}`).toBeGreaterThan(0)
      state = stepOf(GAME, state, randomAction(state, rng)).state
    }
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
