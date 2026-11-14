import { createRng, defaultOptions, playStepFor, progressOf, stepOf, viewLog } from "@pbgo/engine-kit"
import { reorderKeys } from "@pbgo/engine-kit/testing"
import { describe, expect, it } from "vitest"
import { step } from "./actions"
import { GAME } from "./game"
import { OPTIONS } from "./options"
import { setupGame } from "./setup"
import { CLIENT_ACTIONS, SKYJO_ERROR_CODES } from "./types"
import { kinds, layout, newState, playRandomly, players, problems, randomAction, seedOf, waiting } from "./test-utils"
import { playerView } from "./view"

// The game as the platform reads it: the `GameDefinition` of @pbgo/engine-kit.

describe("the game definition", () => {
  it("says who it is: Skyjo, 2 to 8 players, no option", () => {
    expect(GAME.id).toBe("skyjo")
    expect(GAME.name).toBe("Skyjo")
    expect([GAME.minPlayers, GAME.maxPlayers]).toEqual([2, 8])
    expect(Object.keys(GAME.options)).toEqual([])
    expect(defaultOptions(GAME.options)).toEqual({})
    expect(GAME.options).toBe(OPTIONS)
  })

  it("names no text: the lines of the score are keys the platform words", () => {
    expect(GAME.scoreLines).toEqual(["rounds", "bestRound", "columns", "ended", "doubled"])
    const finished = playRandomly(newState(3, seedOf(2)), 2).at(-1)!
    const rows = GAME.view(finished, null).results!.players.flatMap((player) => player.detail ?? [])
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) {
      expect(GAME.scoreLines).toContain(row.key)
      expect(row).not.toHaveProperty("label")
    }
  })

  it("says how far the game has come: the highest total over 100, 99 at the most until it is over, then 100", () => {
    expect(progressOf(GAME, layout({}))).toBe(0)
    expect(progressOf(GAME, layout({ rounds: [[50, 20, 10]] }))).toBe(50)
    expect(progressOf(GAME, layout({ rounds: [[-20, -5, -3]] }))).toBe(0)
    expect(progressOf(GAME, layout({ rounds: [[99, 20, 10]] }))).toBe(99)
    const over = layout({ rounds: [[100, 20, 10]], stage: { kind: "between" } })
    expect(GAME.isOver(over)).toBe(true)
    expect(progressOf(GAME, over)).toBe(100)
  })

  it("accepts the actions of its clients", () => {
    expect([...GAME.clientActions]).toEqual(["reveal", "take", "draw", "place", "discard", "flip", "deal"])
    expect(GAME.clientActions).toBe(CLIENT_ACTIONS)
  })

  it("sets up, applies and views as the engine does", () => {
    const state = GAME.setup({ players: players(4), options: {}, seed: seedOf(1) })
    expect(state).toEqual(setupGame({ players: players(4), seed: seedOf(1) }))
    const action = randomAction(state, createRng(1))
    expect(GAME.apply(state, action)).toEqual(step(state, action).state)
    expect(GAME.view(state, "ana")).toEqual(playerView(state, "ana"))
    expect(GAME.view(state, null).me).toBeNull()
    expect(GAME.isOver(state)).toBe(false)
  })

  it("waits for everybody during the opening, for one player at a time after, and for nobody once it is over", () => {
    const rng = createRng(seedOf(4))
    let state = newState(5, seedOf(4))
    for (let i = 0; i < 20_000 && !GAME.isOver(state); i++) {
      const waits = GAME.waitingFor!(state)
      expect(waits, `move ${i}`).toHaveLength(state.stage.kind === "reveal" ? waits.length : 1)
      expect(new Set(waits).size).toBe(waits.length)
      state = step(state, randomAction(state, rng)).state
    }
    expect(GAME.isOver(state)).toBe(true)
    expect(GAME.waitingFor!(state)).toEqual([])
    expect(waiting(state)).toEqual([])
  })

  it("lists the waiting players in seat order", () => {
    const state = newState(4)
    expect(GAME.waitingFor!(state)).toEqual(state.seats)
    const two = step(state, { type: "reveal", playerId: "cleo", position: 0 }).state
    expect(GAME.waitingFor!(two)).toEqual(["ana", "bob", "cleo", "dan"])
  })

  it("keeps its error codes in one list", () => {
    expect(SKYJO_ERROR_CODES).toContain("NOT_YOUR_TURN")
    expect(SKYJO_ERROR_CODES).toContain("NOT_WAITING")
    expect(new Set(SKYJO_ERROR_CODES).size).toBe(SKYJO_ERROR_CODES.length)
  })
})

describe("what the game says happened", () => {
  it("plays through step and autoPlayStep as it does through apply and autoPlayFor, whatever the move", () => {
    const rng = createRng(seedOf(7))
    let state = newState(4, seedOf(7))
    for (let i = 0; i < 300 && !GAME.isOver(state); i++) {
      const action = randomAction(state, rng)
      const stepped = stepOf(GAME, state, action)
      expect(stepped.state, `move ${i}`).toEqual(GAME.apply(state, action))
      const [absent] = GAME.waitingFor!(state)
      expect(playStepFor(GAME, state, absent!).state, `move ${i}`).toEqual(GAME.autoPlayFor!(state, absent!))
      state = stepped.state
    }
  })

  it("says a game from its first round to the winners, in plain data that names only the players of the table", () => {
    const rng = createRng(seedOf(9))
    const seated = players(5)
    let state = newState(5, seedOf(9))
    const log = []
    for (let i = 0; i < 20_000 && !GAME.isOver(state); i++) {
      const stepped = GAME.step!(state, randomAction(state, rng))
      log.push(...stepped.events)
      state = stepped.state
    }
    const said = new Set(log.map(({ event }) => event.kind))
    for (const kind of ["reveal", "take", "draw", "place", "discard", "start", "last", "end"]) expect(said, kind).toContain(kind)
    expect(log.at(-1)?.event).toMatchObject({ kind: "over" })
    // Plain data: it goes through jsonb and comes back the same, and it names ids, never the nicknames of the table
    expect(JSON.parse(JSON.stringify(log))).toEqual(log)
    expect(JSON.stringify(log)).not.toContain(seated[0]!.nickname)
  })

  it("hides the card a player drew from everybody else in the log: the full entry for the player, a masked one for the rest", () => {
    const rng = createRng(seedOf(3))
    let state = newState(3, seedOf(3))
    const log = []
    for (let i = 0; i < 200 && !GAME.isOver(state); i++) {
      const stepped = GAME.step!(state, randomAction(state, rng))
      log.push(...stepped.events)
      state = stepped.state
    }
    const draws = log.filter((entry) => entry.event.kind === "draw")
    expect(draws.length).toBeGreaterThan(3)
    for (const entry of draws) {
      const who = (entry.event as { by: string }).by
      expect(entry.to).toEqual([who])
      expect(entry.masked).toEqual({ kind: "draw", by: who })
    }
    const mine = viewLog(log, "ana").filter((event) => event.kind === "draw")
    const theirs = viewLog(log, "bob").filter((event) => event.kind === "draw")
    expect(mine.some((event) => "card" in event && event.by === "ana")).toBe(true)
    expect(theirs.filter((event) => event.by === "ana").every((event) => !("card" in event))).toBe(true)
    expect(viewLog(log, null).filter((event) => event.kind === "draw").every((event) => !("card" in event))).toBe(true)
  })

  it("opens the log with the first round, dealt while the game is set up", () => {
    const table = { players: players(4), options: {}, seed: seedOf(2) }
    const opened = GAME.setupStep!(table)
    expect(opened.state).toEqual(GAME.setup(table))
    expect(kinds(opened)).toEqual(["round"])
  })

  it("says something whenever a game plays for an absent player", () => {
    const rng = createRng(seedOf(5))
    let state = newState(5, seedOf(5))
    for (let i = 0; i < 200 && !GAME.isOver(state); i++) {
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
    for (let i = 0; i < 20_000 && !GAME.isOver(state); i++) {
      const action = randomAction(state, rng)
      const stored = reorderKeys(state)
      expect(step(stored, action).state, `move ${i}`).toEqual(step(state, action).state)
      expect(GAME.waitingFor!(stored)).toEqual(GAME.waitingFor!(state))
      expect(playerView(stored, "a")).toEqual(playerView(state, "a"))
      state = step(state, action).state
    }
    expect(problems(state)).toEqual([])
    expect(GAME.isOver(state)).toBe(true)
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
    // the options, the stage, the cells and the per-seat stats, whose keys are fixed words and carry no order
    expect(objects.filter((path) => !/^state(\.options|\.stage|\.stats\[\d+\]|\.grids\[\d+\]\[\d+\])?$/.test(path))).toEqual([])
  })
})
