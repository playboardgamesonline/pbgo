import { describe, expect, it } from "vitest"
import { assertPlayers } from "./players"

const seat = (id: string) => ({ id, nickname: `Nick ${id}` })

describe("assertPlayers", () => {
  it("lets a table of the right size with different ids sit down", () => {
    expect(() => assertPlayers([seat("a"), seat("b"), seat("c")], { min: 2, max: 4 })).not.toThrow()
  })

  it.each([
    ["nobody", []],
    ["too few", [seat("a")]],
    ["too many", ["a", "b", "c", "d", "e"].map(seat)],
    ["the same id twice", [seat("a"), seat("b"), seat("a")]],
    ["an empty id", [seat("a"), seat("")]],
  ])("refuses a table of %s with INVALID_PLAYERS", (_, players) => {
    expect(() => assertPlayers(players, { min: 2, max: 4 })).toThrow(expect.objectContaining({ code: "INVALID_PLAYERS" }))
  })
})
