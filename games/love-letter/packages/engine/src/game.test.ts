import { createRng, defaultOptions, playStepFor, progressOf, stepOf, viewLog } from "@pbgo/engine-kit"
import { reorderKeys } from "@pbgo/engine-kit/testing"
import { describe, expect, it } from "vitest"
import { step } from "./actions"
import { GAME } from "./game"
import { OPTIONS } from "./options"
import { setupGame } from "./setup"
import { CLIENT_ACTIONS, LOVE_LETTER_ERROR_CODES } from "./types"
import { kinds, layout, newState, playRandomly, players, randomAction, seedOf, waiting } from "./test-utils"
import { playerView } from "./view"

// The game as the platform reads it: the `GameDefinition` of @pbgo/engine-kit.

describe("the game definition", () => {
  it("says who it is: Love Letter, 2 to 6 players, no option (p. 2)", () => {
    expect(GAME.id).toBe("love-letter")
    expect(GAME.name).toBe("Love Letter")
    expect([GAME.minPlayers, GAME.maxPlayers]).toEqual([2, 6])
    expect(Object.keys(GAME.options)).toEqual([])
    expect(defaultOptions(GAME.options)).toEqual({})
    expect(GAME.options).toBe(OPTIONS)
  })

  it("names no text: the lines of the score are keys the platform words", () => {
    expect(GAME.scoreLines).toEqual(["rounds", "won", "spy"])
    const finished = playRandomly(newState(3, seedOf(2)), 2).at(-1)!
    const rows = GAME.view(finished, null).results!.players.flatMap((player) => player.detail ?? [])
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) {
      expect(GAME.scoreLines).toContain(row.key)
      expect(row).not.toHaveProperty("label")
    }
  })

  it("says how far the game has come: the best player's tokens over the tokens that win, 100 once it is over (p. 7)", () => {
    expect(progressOf(GAME, layout({ players: 3 }))).toBe(0)
    // three players need 5 tokens
    expect(progressOf(GAME, layout({ players: 3, won: { ana: 3 }, spies: { bob: 1 } }))).toBe(60)
    expect(progressOf(GAME, layout({ players: 3, won: { ana: 1, bob: 4 } }))).toBe(80)
    // six players need 3
    expect(progressOf(GAME, layout({ players: 6, won: { cleo: 2 } }))).toBe(67)
    const over = layout({ players: 3, stage: "between", between: { winners: ["ana"] }, won: { ana: 5 } })
    expect(GAME.isOver(over)).toBe(true)
    expect(progressOf(GAME, over)).toBe(100)
  })

  it("accepts the actions of its clients", () => {
    expect([...GAME.clientActions]).toEqual(["play", "deal"])
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

  it("waits for one player at a time, the player of the turn or the one who deals, and for nobody once it is over", () => {
    const rng = createRng(seedOf(4))
    let state = newState(5, seedOf(4))
    for (let i = 0; i < 20_000 && !GAME.isOver(state); i++) {
      const waits = GAME.waitingFor!(state)
      expect(waits, `move ${i}`).toEqual([state.seats[state.turn]])
      state = step(state, randomAction(state, rng)).state
    }
    expect(GAME.isOver(state)).toBe(true)
    expect(GAME.waitingFor!(state)).toEqual([])
    expect(waiting(state)).toEqual([])
  })

  it("lists the player it waits for from the seats, whatever order a stored state keeps its keys in (jsonb)", () => {
    const state = newState(4, seedOf(8))
    expect(GAME.waitingFor!(reorderKeys(state))).toEqual(GAME.waitingFor!(state))
  })

  it("keeps its error codes in one list, without duplicates", () => {
    expect(LOVE_LETTER_ERROR_CODES).toContain("NOT_YOUR_TURN")
    expect(LOVE_LETTER_ERROR_CODES).toContain("NOT_WAITING")
    expect(new Set(LOVE_LETTER_ERROR_CODES).size).toBe(LOVE_LETTER_ERROR_CODES.length)
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
    const seated = players(5).map((player) => player.id)
    let state = newState(5, seedOf(9))
    const events = [...GAME.setupStep!({ players: players(5), options: {}, seed: seedOf(9) }).events]
    for (let i = 0; i < 20_000 && !GAME.isOver(state); i++) {
      const stepped = GAME.step!(state, randomAction(state, rng))
      events.push(...stepped.events)
      state = stepped.state
    }
    // the whole log, read by a spectator: round after round, the plays, the ends of the rounds, and the end of the game
    const read = viewLog(events, null)
    const said = new Set(read.map((event) => event.kind))
    for (const kind of ["round", "draw", "play", "reveal", "end", "over"]) expect(said.has(kind as never), kind).toBe(true)
    // the rounds are numbered one after the other from 1
    const rounds = read.flatMap((event) => (event.kind === "round" ? [event.number] : []))
    expect(rounds).toEqual(rounds.map((_, i) => i + 1))
    // every player named is one of the table, and the log holds no name
    const named = new Set<string>()
    for (const event of read) {
      if ("by" in event) named.add(event.by)
      if ("first" in event) named.add(event.first)
      if ("winners" in event) event.winners.forEach((id) => named.add(id))
      if ("hands" in event) event.hands.forEach((hand) => named.add(hand.player))
    }
    for (const id of named) expect(seated).toContain(id)
    expect(JSON.stringify(events)).not.toMatch(/[A-Z]{3}/)
    // the last line says who won
    expect(read.at(-1)).toMatchObject({ kind: "over", winners: GAME.view(state, null).results!.winners })
  })

  it("keeps the kinds of a step in the order they happened: the card played, then the count, then the next player's draw or the end", () => {
    const state = layout({ hands: { ana: ["countess", "guard"], bob: ["priest"], cleo: ["baron"] }, deck: ["spy"], rest: "away" })
    const first = GAME.step!(state, { type: "play", playerId: "ana", card: state.hands[0]![0]! })
    expect(kinds(first)).toEqual(["play", "draw"])
  })
})
