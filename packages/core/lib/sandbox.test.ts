import { describe, expect, it } from "vitest"
import { SANDBOX_MAX_TURNS, sandboxParams, sandboxPlayers, sandboxSearch } from "./sandbox"

const bounds = { minPlayers: 2, maxPlayers: 6 }

describe("the setup of a made-up table, from the address", () => {
  it("has three players by default, seen from the first seat, with nothing played", () => {
    expect(sandboxParams(new URLSearchParams(""), bounds)).toEqual({ players: 3, turns: 0, scenario: null, seed: null, seat: 0 })
  })

  it("takes the game's least players when it cannot seat three", () => {
    expect(sandboxParams({}, { minPlayers: 4, maxPlayers: 8 }).players).toBe(4)
    expect(sandboxParams({}, { minPlayers: 1, maxPlayers: 2 }).players).toBe(2)
  })

  it("reads every value, and keeps each within what the game takes", () => {
    expect(sandboxParams(new URLSearchParams("players=5&turns=12&scenario=princessInHand&seed=42&seat=4"), bounds)).toEqual({ players: 5, turns: 12, scenario: "princessInHand", seed: 42, seat: 4 })
    expect(sandboxParams({ players: "40", seat: "9", turns: "100000" }, bounds)).toMatchObject({ players: 6, seat: 5, turns: SANDBOX_MAX_TURNS })
    expect(sandboxParams({ players: "0", seat: "-3", turns: "-1" }, bounds)).toMatchObject({ players: 2, seat: 0, turns: 0 })
  })

  it("leaves out a value it cannot read", () => {
    expect(sandboxParams({ players: "many", seed: "abc", scenario: "  " }, bounds)).toMatchObject({ players: 3, seed: null, scenario: null })
    expect(sandboxParams({ players: ["4", "5"] }, bounds).players).toBe(4)
  })

  it("is written back into an address that opens the same table", () => {
    const setup = { players: 4, turns: 6, scenario: "bustOnTop", seed: 7, seat: 2 }
    const search = sandboxSearch(setup)
    expect(search).toBe("?players=4&turns=6&scenario=bustOnTop&seed=7&seat=2")
    expect(sandboxParams(new URLSearchParams(search), bounds)).toEqual(setup)
    expect(sandboxSearch({ players: 3, turns: 0, scenario: null, seed: null, seat: 0 })).toBe("?players=3")
  })

  it("seats made-up players with ids of their own, in order", () => {
    expect(sandboxPlayers(3)).toEqual([
      { id: "preview-1", nickname: "Alix" },
      { id: "preview-2", nickname: "Basile" },
      { id: "preview-3", nickname: "Camille" },
    ])
  })
})
