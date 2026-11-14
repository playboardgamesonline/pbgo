import { describe, expect, it } from "vitest"
import { GAME } from "./game"
import { setupGame, setupStep, MAX_PLAYERS, MIN_PLAYERS } from "./setup"
import { CATALOGUE } from "./catalogue"
import { gridUp, kinds, newState, players, problems, refusal, seatOf, seedOf, valueOfId } from "./test-utils"

// Rulebook, page 1: preparing a round. 12 cards face down to each player in four columns of three, one card face up starts the discard, the rest is the draw pile.

describe("setting a game up, at every table size", () => {
  for (let n = MIN_PLAYERS; n <= MAX_PLAYERS; n++) {
    it(`deals ${n} players 12 face-down cards each, one card to the discard, and leaves the rest in the pile`, () => {
      const state = newState(n, seedOf(n))
      expect(state.seats).toHaveLength(n)
      expect(state.grids).toHaveLength(n)
      for (const grid of state.grids) {
        expect(grid).toHaveLength(12)
        expect(grid.every((cell) => cell !== null && !cell.up)).toBe(true)
      }
      expect(state.discard).toHaveLength(1)
      expect(state.deck).toHaveLength(150 - 12 * n - 1)
      expect(problems(state)).toEqual([])
      expect(GAME.waitingFor!(state)).toEqual(state.seats)
      expect(state.stage).toEqual({ kind: "reveal" })
      expect(state.rounds).toEqual([])
      expect(state.ender).toBeNull()
    })
  }

  it("seats 2 to 8 players", () => {
    expect([MIN_PLAYERS, MAX_PLAYERS]).toEqual([2, 8])
    expect([GAME.minPlayers, GAME.maxPlayers]).toEqual([2, 8])
  })

  it("holds every one of the 150 cards in one place", () => {
    const state = newState(8, seedOf(1))
    const ids = [...state.deck, ...state.discard, ...state.grids.flat().map((cell) => cell!.card)]
    expect(new Set(ids).size).toBe(150)
    expect(ids.map((id) => valueOfId(state, id)).sort((a, b) => a - b)).toEqual(CATALOGUE.map((key) => Number(key.replace("card-minus-", "-").replace("card-", ""))).sort((a, b) => a - b))
  })

  it("names the first dealer from the seed, one of the seats", () => {
    const dealers = new Set(Array.from({ length: 40 }, (_, i) => newState(5, seedOf(i)).dealer))
    expect(dealers.size).toBeGreaterThan(2)
    for (const dealer of dealers) expect(dealer).toBeGreaterThanOrEqual(0)
    for (const dealer of dealers) expect(dealer).toBeLessThan(5)
  })

  it("is the same game for the same seed, and another game for another", () => {
    expect(newState(4, seedOf(3))).toEqual(newState(4, seedOf(3)))
    expect(newState(4, seedOf(3))).not.toEqual(newState(4, seedOf(4)))
  })

  it("does not read Math.random once it has a seed", () => {
    const real = Math.random
    Math.random = () => {
      throw new Error("Math.random was called")
    }
    try {
      expect(() => newState(6, seedOf(5))).not.toThrow()
    } finally {
      Math.random = real
    }
  })

  it("issues ids that say nothing of the cards: different ids, none in catalogue order by value", () => {
    const state = newState(3, seedOf(6))
    expect(new Set(state.ids).size).toBe(150)
    expect([...state.ids].sort((a, b) => a - b)).not.toEqual(state.ids)
  })

  it("starts with every card face down: nobody has turned one over yet", () => {
    const state = newState(3, seedOf(2))
    for (const id of state.seats) expect(gridUp(state, id).every((up) => up === false)).toBe(true)
  })

  it("opens the log with the round", () => {
    const opened = setupStep({ players: players(4), seed: seedOf(2) })
    expect(opened.state).toEqual(GAME.setup({ players: players(4), options: {}, seed: seedOf(2) }))
    expect(kinds(opened)).toEqual(["round"])
    expect(opened.events[0]!.event).toMatchObject({ kind: "round", number: 1, dealer: opened.state.seats[opened.state.dealer] })
  })

  it("refuses a table it cannot play, with INVALID_PLAYERS", () => {
    const refused = (list: unknown) => refusal(() => setupGame({ players: list as never, seed: seedOf(0) }))
    expect(refused(players(1))).toBe("INVALID_PLAYERS")
    expect(refused([])).toBe("INVALID_PLAYERS")
    expect(refused(players(9))).toBe("INVALID_PLAYERS")
    expect(refused([{ id: "a", nickname: "A" }, { id: "a", nickname: "B" }])).toBe("INVALID_PLAYERS")
    expect(refused([{ id: "a", nickname: "A" }, { id: "", nickname: "B" }])).toBe("INVALID_PLAYERS")
    expect(refused([{ id: "a", nickname: "A" }, { id: 4, nickname: "B" }])).toBe("INVALID_PLAYERS")
    expect(refused("ana,bob")).toBe("INVALID_PLAYERS")
    expect(refused(undefined)).toBe("INVALID_PLAYERS")
  })

  it("takes the seats in the order it is given", () => {
    const state = newState(4)
    expect(state.seats).toEqual(["ana", "bob", "cleo", "dan"])
    expect(seatOf(state, "cleo")).toBe(2)
  })

  it("has no option", () => {
    expect(GAME.options).toEqual({})
    expect(newState(3).options).toEqual({})
  })
})
