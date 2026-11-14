import { describe, expect, it } from "vitest"
import { GAME } from "./game"
import { debugCommands } from "./debug"
import { gridUp, gridValues, newState, opened, problems, seedOf, values, waiting } from "./test-utils"
import type { State } from "./types"

// The debug panel: development only. Each command acts when a player has to choose where to draw from, and never makes a card up.

const at = (n: number, seed = seedOf(1)): State => opened(newState(n, seed))
const run = (name: string, state: State): State => GAME.debug![name]!(state)

describe("the debug commands", () => {
  it("lists the commands of the panel", () => {
    expect(Object.keys(debugCommands).sort()).toEqual(["columnOnTop", "highOnTop", "lastCard", "lowOnTop", "nearTarget", "over", "round", "turn"])
    expect(GAME.debug).toBe(debugCommands)
  })

  it("turn plays the current turn out, and stops at the next player", () => {
    const state = at(3)
    const who = waiting(state)[0]
    const next = run("turn", state)
    expect(waiting(next)).toHaveLength(1)
    expect(waiting(next)[0]).not.toBe(who)
    expect(problems(next)).toEqual([])
  })

  it("turn plays the opening out for whoever is first waited for, and a deal for the dealer", () => {
    const next = run("turn", newState(3))
    expect(next.grids[0]!.filter((cell) => cell?.up)).toHaveLength(2)
  })

  it("round plays to the count", () => {
    const state = run("round", at(4, seedOf(2)))
    expect(state.rounds.length).toBe(1)
    expect(state.stage.kind === "between" || GAME.isOver(state)).toBe(true)
    expect(problems(state)).toEqual([])
  })

  it("over plays to the end", () => {
    for (const n of [2, 5, 8]) {
      const state = run("over", newState(n, seedOf(n)))
      expect(GAME.isOver(state)).toBe(true)
      expect(waiting(state)).toEqual([])
    }
  })

  it("lastCard leaves the current player with one card face down: turning it ends the round", () => {
    const state = run("lastCard", at(3, seedOf(3)))
    const who = waiting(state)[0]!
    expect(gridUp(state, who).filter((u) => u === false)).toHaveLength(1)
    expect(problems(state)).toEqual([])
  })

  it("columnOnTop gives the current player two equal cards face up over a third, matching the top of the discard", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const state = run("columnOnTop", at(3, seedOf(seed)))
      const who = waiting(state)[0]!
      const grid = gridValues(state, who)
      const top = values(state, state.discard)[0]
      expect(grid[0], `seed ${seed}`).toBe(top)
      expect(grid[1]).toBe(top)
      expect(gridUp(state, who).slice(0, 3)).toEqual([true, true, false])
      expect(problems(state)).toEqual([])
    }
  })

  it("lowOnTop and highOnTop move a card to the top of the pile, from the pile itself", () => {
    const state = at(2, seedOf(4))
    const low = run("lowOnTop", state)
    expect(values(low, low.deck)[0]).toBe(-2)
    const high = run("highOnTop", state)
    expect(values(high, high.deck)[0]).toBe(12)
    expect([...low.deck].sort()).toEqual([...state.deck].sort())
    expect(problems(low)).toEqual([])
  })

  it("nearTarget writes a round where the first seat stands at 94", () => {
    const state = run("nearTarget", at(3))
    expect(state.rounds).toEqual([[94, 27, 34]])
    expect(GAME.isOver(state)).toBe(false)
  })

  it("rigging commands do nothing outside the choice of where to draw from", () => {
    const opening = newState(3)
    for (const name of ["lastCard", "columnOnTop", "lowOnTop", "highOnTop"]) expect(run(name, opening), name).toEqual(opening)
  })

  it("moves cards and never makes one up: every card is still in one place", () => {
    for (const name of ["lastCard", "columnOnTop", "lowOnTop", "highOnTop"]) {
      for (let seed = 1; seed <= 8; seed++) expect(problems(run(name, at(2 + (seed % 7), seedOf(seed)))), `${name} ${seed}`).toEqual([])
    }
  })
})
