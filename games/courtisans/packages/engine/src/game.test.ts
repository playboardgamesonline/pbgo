import { isEngineError, playFor, playOn, waitingPlayers } from "@pbgo/engine-kit"
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

describe("GAME.waitingFor", () => {
  const newGame = (seed = 5) => GAME.setup({ players, options: {}, seed, data: testMissions() })

  it("waits for everyone to read their missions while the opening lasts", () => {
    expect(waitingPlayers(GAME, newGame())).toEqual(["a", "b", "c"])
  })

  it("stops waiting for a player who has read, and leaves the others in seat order", () => {
    const state = GAME.apply(newGame(), { type: "readMissions", playerId: "b" })
    expect(waitingPlayers(GAME, state)).toEqual(["a", "c"])
  })

  it("waits for the active player alone once the banquet has started", () => {
    const state = GAME.debug!.missions!(newGame())
    expect(waitingPlayers(GAME, state)).toEqual([state.players[state.activePlayer]!.id])
  })

  it("waits for nobody once the game is over", () => {
    expect(waitingPlayers(GAME, GAME.debug!.over!(newGame()))).toEqual([])
  })

  it("is public: it only holds what the players' flags already show", () => {
    const state = GAME.apply(newGame(), { type: "readMissions", playerId: "a" })
    const view = GAME.view(state, "b")
    expect(view.players.filter((j) => !j.missionsRead).map((j) => j.id)).toEqual(waitingPlayers(GAME, state))
  })
})

describe("GAME.autoPlayFor (absent player)", () => {
  const newGame = (seed = 5) => GAME.setup({ players, options: {}, seed, data: testMissions() })

  it("reads the missions of one player while the opening lasts, the others are still waited for", () => {
    const next = playFor(GAME, newGame(), "b")
    expect(next.phase).toBe("missions")
    expect(next.players.map((j) => j.missionsRead)).toEqual([false, true, false])
    expect(waitingPlayers(GAME, next)).toEqual(["a", "c"])
  })

  it("starts the banquet when the last missions are read", () => {
    let state = newGame()
    state = playFor(GAME, state, "a")
    state = playFor(GAME, state, "c")
    expect(state.phase).toBe("missions")
    state = playFor(GAME, state, "b")
    expect(state.phase).toBe("playing")
    expect(waitingPlayers(GAME, state)).toEqual([state.players[state.activePlayer]!.id])
  })

  it("plays the whole turn of the active player once the banquet has started", () => {
    const state = GAME.debug!.missions!(newGame())
    const [active] = waitingPlayers(GAME, state)
    expect(active).toBeDefined()
    const next = playFor(GAME, state, active!)
    expect(waitingPlayers(GAME, next)).not.toContain(active)
    expect(next.turnNumber).toBe(state.turnNumber + 1)
  })

  it("refuses a player the game is not waiting for", () => {
    const refused = (fn: () => unknown) => {
      try {
        fn()
      } catch (error) {
        return isEngineError(error) ? error.code : error
      }
      return null
    }
    const opening = newGame()
    const read = GAME.apply(opening, { type: "readMissions", playerId: "a" })
    expect(refused(() => GAME.autoPlayFor!(read, "a"))).toBe("NOT_WAITING")
    expect(refused(() => playFor(GAME, read, "a"))).toBe("NOT_WAITING")
    expect(refused(() => GAME.autoPlayFor!(opening, "ghost"))).toBe("NOT_WAITING")

    const banquet = GAME.debug!.missions!(opening)
    const waiting = waitingPlayers(GAME, banquet)[0]!
    const other = players.find((j) => j.id !== waiting)!.id
    expect(refused(() => GAME.autoPlayFor!(banquet, other))).toBe("NOT_WAITING")
    expect(refused(() => GAME.autoPlayFor!(GAME.debug!.over!(banquet), waiting))).toBe("NOT_WAITING")
  })

  it("leaves the state it was given untouched", () => {
    const state = newGame()
    const before = structuredClone(state)
    playFor(GAME, state, "c")
    expect(state).toEqual(before)
  })

  it("can play a whole table of absent players to the end, opening included", () => {
    const over = playOn(GAME, newGame(11))
    expect(GAME.isOver(over)).toBe(true)
    expect(over.players.every((j) => j.missionsRead)).toBe(true)
  })
})

describe("GAME.debug.missions (everyone has read)", () => {
  it("marks every player as ready, which starts the banquet", () => {
    const state = GAME.setup({ players, options: {}, seed: 2, data: testMissions() })
    expect(state.phase).toBe("missions")
    const started = GAME.debug!.missions!(state)
    expect(started.phase).toBe("playing")
    expect(started.players.every((j) => j.missionsRead)).toBe(true)
  })
})
