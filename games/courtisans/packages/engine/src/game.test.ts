import { SHARED_ERROR_CODES, stepOf } from "@pbgo/engine-kit"
import { thrownErrorCodes } from "@pbgo/engine-kit/testing"
import { describe, expect, it } from "vitest"
import { GAME } from "./game"
import { handOfPlayer, layout, newState, players, card } from "./test-utils"
import { CLIENT_ACTIONS, COURTISANS_ERROR_CODES } from "./types"

describe("GAME (the @pbgo/engine-kit contract)", () => {
  it("is the definition of a game of two to five players with no option and two lines of score", () => {
    expect(GAME.id).toBe("courtisans")
    expect([GAME.minPlayers, GAME.maxPlayers]).toEqual([2, 5])
    expect(GAME.options).toEqual({})
    expect(GAME.scoreLines).toEqual(["domain", "missions"])
    expect(GAME.clientActions).toEqual(CLIENT_ACTIONS)
    expect(CLIENT_ACTIONS).toEqual(["readMissions", "playCard"])
  })

  it("sets up a game from the lobby players: the seats are their ids, in order, and nothing else of them", () => {
    const state = GAME.setup({ players: players(3), options: {}, seed: 42 })
    expect(state.seats).toEqual(["ana", "bob", "cleo"])
    expect(state.missions.every((own) => own.length === 2)).toBe(true)
    expect(GAME.isOver(state)).toBe(false)
  })

  it("applies an action: `apply` is the state of `step`", () => {
    const state = newState(3)
    const action = { type: "readMissions", playerId: "bob" } as const
    expect(GAME.apply(state, action)).toEqual(GAME.step!(state, action).state)
    expect(GAME.apply(state, action).read).toEqual([false, true, false])
  })

  it("says what a move did, through `stepOf` as the platform asks for it", () => {
    const state = layout({ players: 2, hands: { ana: [card("hare"), card("stag"), card("carp")], bob: [card("butterfly")] } })
    const [mine] = handOfPlayer(state, "ana")
    const played = stepOf(GAME, state, { type: "playCard", playerId: "ana", cardId: mine!, target: { zone: "table", level: "up" } })
    expect(played.events).toEqual([{ event: { type: "cardPlayed", playerId: "ana", card: { id: mine, family: "hare", role: null }, target: { zone: "table", level: "up" } } }])
  })

  it("plays a game to the end with the debug commands", () => {
    const over = GAME.debug!.over!(GAME.setup({ players: players(3), options: {}, seed: 3 }))
    expect(GAME.isOver(over)).toBe(true)
    expect(GAME.view(over, "ana").players).toHaveLength(3)
    expect(GAME.view(over, "ana").results?.winners.length).toBeGreaterThan(0)
  })

  it("says how far the game has come: nothing at the start, all of it at the end, more with every card played", () => {
    let state = GAME.debug!.missions!(newState(4))
    expect(GAME.progress!(state)).toBe(0)
    const seen: number[] = []
    while (!GAME.isOver(state)) {
      state = GAME.autoPlayFor!(state, GAME.waitingFor!(state)[0]!)
      seen.push(GAME.progress!(state))
    }
    expect(seen).toEqual([...seen].sort((a, b) => a - b))
    expect(seen.at(-1)).toBe(100)
    expect(seen[0]).toBeGreaterThan(0)
  })
})

describe("the error codes", () => {
  it("are listed once, and each is thrown by the engine or is a shared code the engine may throw", () => {
    expect(new Set(COURTISANS_ERROR_CODES).size).toBe(COURTISANS_ERROR_CODES.length)
    const { codes, dynamic } = thrownErrorCodes(new URL(".", import.meta.url))
    expect(dynamic).toEqual([])
    for (const code of codes.keys()) expect(COURTISANS_ERROR_CODES as readonly string[], `${code} is thrown and not listed`).toContain(code)
    // the game's own codes are the ones that are not shared: the binding lists them for their messages to be written in Sanity
    const own = COURTISANS_ERROR_CODES.filter((code) => !(SHARED_ERROR_CODES as readonly string[]).includes(code))
    expect(own).toEqual(["ZONE_ALREADY_PLAYED", "INVALID_ASSASSINATION"])
  })
})
