import { playFor, playOn, waitingPlayers } from "@pbgo/engine-kit"
import { describe, expect, it } from "vitest"
import { autoPlayFor, autoPlayStep } from "./autoplay"
import { GAME } from "./game"
import { areaNames, handNames, layout, newState, problems, refusal, seedOf, waiting } from "./test-utils"

// Playing for an absent player: the simplest legal play, always the same for the same state, whole turns and not one click.

describe("what an absent player plays on their turn", () => {
  it("is the card of the lowest value, so the Princess is the last card it would play (pp. 2, 8)", () => {
    const state = layout({ hands: { ana: ["king", "priest"] }, deck: ["baron"] })
    expect(areaNames(autoPlayFor(state, "ana"), "ana")).toEqual(["priest"])
    expect(areaNames(autoPlayFor(layout({ hands: { ana: ["princess", "king"] }, deck: ["baron"] }), "ana"), "ana")).toEqual(["king"])
    expect(areaNames(autoPlayFor(layout({ hands: { ana: ["princess", "spy"] }, deck: ["baron"] }), "ana"), "ana")).toEqual(["spy"])
  })

  it("is the first of their hand when two cards are worth the same", () => {
    const state = layout({ hands: { ana: ["guard", "guard"] }, deck: ["baron"] })
    const first = state.hands[0]![0]!
    expect(autoPlayFor(state, "ana").areas[0]).toEqual([first])
  })

  it("is a whole turn: the card is played and the next player has drawn (p. 4)", () => {
    const state = layout({ hands: { ana: ["king", "priest"], bob: ["guard"] }, deck: ["baron", "spy"] })
    const after = autoPlayFor(state, "ana")
    expect(waiting(after)).toEqual(["bob"])
    expect(handNames(after, "bob")).toEqual(["guard", "baron"])
  })

  it("deals the next round between two rounds, for the player who takes the first turn", () => {
    const ended = layout({ stage: "between", between: { revealed: true, winners: ["bob"] }, turn: "bob", won: { bob: 1 } })
    expect(waiting(ended)).toEqual(["bob"])
    const after = autoPlayFor(ended, "bob")
    expect(after.round).toBe(2)
    expect(after.stage).toEqual({ kind: "play" })
    expect(problems(after)).toEqual([])
  })
})

describe("who can be played for", () => {
  it("the player the game waits for and nobody else (NOT_WAITING), and not the same player once their step is done", () => {
    const state = newState(3, seedOf(3))
    const [who] = waiting(state)
    const other = state.seats.find((id) => id !== who)!
    expect(refusal(() => playFor(GAME, state, other))).toBe("NOT_WAITING")
    expect(refusal(() => autoPlayFor(state, other))).toBe("NOT_WAITING")
    const after = playFor(GAME, state, who!)
    expect(refusal(() => autoPlayFor(after, who!))).toBe("NOT_WAITING")
  })

  it("nobody once the game is over (NOT_WAITING)", () => {
    const over = playOn(GAME, newState(2, seedOf(4)), 5_000)
    expect(GAME.isOver(over)).toBe(true)
    expect(refusal(() => autoPlayFor(over, "ana"))).toBe("NOT_WAITING")
    expect(waitingPlayers(GAME, over)).toEqual([])
  })
})

describe("a game of absent players", () => {
  for (let n = 2; n <= 6; n++) {
    it(`of ${n} players is played to the end by autoPlayFor alone, with every card in one place after every move`, () => {
      let state = newState(n, seedOf(30 + n))
      let moves = 0
      while (!GAME.isOver(state) && moves < 5_000) {
        const [who] = waitingPlayers(GAME, state)
        state = playFor(GAME, state, who!)
        expect(problems(state), `move ${moves}`).toEqual([])
        moves++
      }
      expect(GAME.isOver(state)).toBe(true)
      expect(GAME.view(state, null).results!.winners.length).toBeGreaterThan(0)
    })
  }

  it("plays the same for the same state, with no random number", () => {
    const state = newState(4, seedOf(9))
    const real = Math.random
    Math.random = () => {
      throw new Error("Math.random was called")
    }
    try {
      const [who] = waiting(state)
      expect(autoPlayFor(state, who!)).toEqual(autoPlayFor(state, who!))
      expect(playOn(GAME, state, 40)).toEqual(playOn(GAME, state, 40))
    } finally {
      Math.random = real
    }
  })

  it("says what it did through autoPlayStep, the same state as autoPlayFor", () => {
    const state = layout({ hands: { ana: ["king", "priest"], bob: ["guard"] }, deck: ["baron", "spy"] })
    const stepped = autoPlayStep(state, "ana")
    expect(stepped.state).toEqual(autoPlayFor(state, "ana"))
    // the Priest it plays looks at the hand of the next player, who then draws
    expect(stepped.events.map(({ event }) => event.kind)).toEqual(["play", "look", "draw"])
  })
})
