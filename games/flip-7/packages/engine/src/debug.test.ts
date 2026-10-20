import { describe, expect, it } from "vitest"
import { GAME } from "./game"
import { numbersOf } from "./machine"
import { deckTitles, discardTitles, hit, layout, lineTitles, newState, problems, seedOf, stay, waiting } from "./test-utils"
import type { State } from "./types"

// The debug panel is for development: `turn` and `over` play for the players the game waits for, the others rig the draw pile or the
// line of the player whose turn it is, between two plays only.

const commands = GAME.debug!
const run = (name: string, state: State): State => commands[name]!(state)

describe("the debug commands", () => {
  it("offers the shared commands and its own", () => {
    expect(Object.keys(commands).sort()).toEqual(["bustOnTop", "flip7", "flipThreeOnTop", "freezeOnTop", "over", "secondChanceOnTop", "turn"])
  })

  describe("turn", () => {
    it("plays the current turn out: the player stays, and the next player is waited for", () => {
      const state = run("turn", layout({ lines: { ana: ["number-9"] } }))
      expect(state.status[0]).toBe("stayed")
      expect(waiting(state)).toBe("bob")
    })

    it("plays through the choice of a card the player just drew", () => {
      const drawn = hit(layout({ lines: { ana: ["number-9"] }, deck: ["freeze"] }), "ana")
      const state = run("turn", drawn)
      expect(state.status[0]).toBe("frozen")
      expect(waiting(state)).toBe("bob")
    })

    it("stops when the round is over, and does not deal the next one", () => {
      const last = layout({ lines: { ana: ["number-9"], bob: ["number-4"], cleo: ["number-3"] }, status: { bob: "stayed", cleo: "stayed" } })
      const state = run("turn", last)
      expect(state.rounds).toEqual([[9, 4, 3]])
      expect(waiting(state)).toBe("ana")
    })

    it("changes nothing once the game is over", () => {
      const over = run("over", newState(3, seedOf(2)))
      expect(run("turn", over)).toEqual(over)
    })
  })

  describe("over", () => {
    it("plays the game to the end", () => {
      const state = run("over", newState(5, seedOf(3)))
      expect(GAME.isOver(state)).toBe(true)
      expect(problems(state)).toEqual([])
    })
  })

  describe("the cards put on top of the draw pile", () => {
    it("bustOnTop: a number the player holds, so that a hit busts", () => {
      const state = run("bustOnTop", layout({ lines: { ana: ["number-4", "number-8"] }, deck: ["number-1", "number-2"] }))
      expect(["number-4", "number-8"]).toContain(deckTitles(state)[0])
      expect(problems(state)).toEqual([])
      expect(hit(state, "ana").status[0]).toBe("busted")
    })

    it("bustOnTop: does nothing for a player with no number", () => {
      const state = layout({ lines: { ana: ["plus-2"] }, deck: ["number-1", "number-2"] })
      expect(run("bustOnTop", state)).toEqual(state)
    })

    it.each([
      ["freezeOnTop", "freeze"],
      ["flipThreeOnTop", "flip-three"],
      ["secondChanceOnTop", "second-chance"],
    ])("%s: the next card is a %s, taken from the pile", (command, face) => {
      const state = run(command, layout({ deck: ["number-1", "number-2"] }))
      expect(deckTitles(state)[0]).toBe(face)
      expect(deckTitles(state)).toHaveLength(deckTitles(layout({ deck: ["number-1", "number-2"] })).length)
      expect(problems(state)).toEqual([])
    })

    it("takes the card from the discard when the pile has none", () => {
      const state = layout({ deck: ["number-1"], discard: ["freeze", "number-2"], rest: "away" })
      const rigged = run("freezeOnTop", state)
      expect(deckTitles(rigged)).toEqual(["freeze", "number-1"])
      expect(discardTitles(rigged)).toEqual(["number-2"])
    })

    it("changes nothing when there is no such card anywhere to move", () => {
      const state = layout({ deck: ["number-1"], rest: "away" })
      expect(run("freezeOnTop", state)).toEqual(state)
    })
  })

  describe("flip7", () => {
    it("gives the player six different numbers and puts a seventh on top: a hit makes the Flip 7", () => {
      const state = run("flip7", layout({ lines: { ana: ["number-3"] }, deck: ["number-1"] }))
      expect(new Set(numbersOf(state, 0)).size).toBe(6)
      expect(new Set(numbersOf(state, 0)).has(3)).toBe(true)
      expect(problems(state)).toEqual([])
      const done = hit(state, "ana")
      expect(done.stats[0]).toEqual({ busts: 0, flip7: 1 })
      expect(done.rounds[0]![0]).toBeGreaterThanOrEqual(15)
    })

    it("only needs the top card when the player holds six different numbers already", () => {
      const state = layout({ lines: { ana: ["number-1", "number-2", "number-3", "number-4", "number-5", "number-6"] }, deck: ["number-7"] })
      const rigged = run("flip7", state)
      expect(lineTitles(rigged, "ana")).toEqual(lineTitles(state, "ana"))
      expect(deckTitles(rigged)[0]).not.toMatch(/^number-[1-6]$/)
    })
  })

  describe("a rigging command", () => {
    it.each(["bustOnTop", "freezeOnTop", "flipThreeOnTop", "secondChanceOnTop", "flip7"])("%s changes nothing while a player is choosing a target", (command) => {
      const drawn = hit(layout({ lines: { ana: ["number-3"] }, deck: ["freeze"] }), "ana")
      expect(run(command, drawn)).toEqual(drawn)
    })

    it.each(["bustOnTop", "freezeOnTop", "flipThreeOnTop", "secondChanceOnTop", "flip7"])("%s changes nothing between two rounds", (command) => {
      const between = stay(stay(stay(layout({ lines: { ana: ["number-5"], bob: ["number-6"], cleo: ["number-7"] } }), "ana"), "bob"), "cleo")
      expect(run(command, between)).toEqual(between)
    })
  })
})
