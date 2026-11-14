import { createRng, playFor, playStepFor, waitingPlayers } from "@pbgo/engine-kit"
import { describe, expect, it } from "vitest"
import { autoPlayFor } from "./autoplay"
import { GAME } from "./game"
import { deepFreeze } from "@pbgo/engine-kit/testing"
import { discard, draw, gridUp, gridValues, layout, newState, opened, problems, refusal, seatOf, seedOf, up, waiting } from "./test-utils"
import type { State } from "./types"

// Playing for a player who is away: legal, deterministic, complete.

describe("playing for an absent player", () => {
  it("turns the two opening cards over, in two different columns, and no more", () => {
    const state = newState(3, seedOf(1))
    const next = autoPlayFor(state, "bob")
    const up = gridUp(next, "bob")
    expect(up.filter(Boolean)).toHaveLength(2)
    expect(up[0]).toBe(true)
    expect(up[3]).toBe(true)
    expect(waiting(next)).toEqual(["ana", "cleo"])
    // the others have not moved
    expect(next.grids[0]).toEqual(state.grids[0])
  })

  it("finishes the opening when they have already turned one card over", () => {
    let state = newState(2, seedOf(1))
    state = { ...state, grids: state.grids.map((grid, seat) => (seat === 0 ? grid.map((cell, i) => (i === 3 ? { ...cell!, up: true } : cell)) : grid)) }
    const next = autoPlayFor(state, "ana")
    expect(gridUp(next, "ana").filter(Boolean)).toHaveLength(2)
  })

  it("plays a whole turn: it ends with the turn passed on", () => {
    const state = opened(newState(3, seedOf(3)))
    const player = waiting(state)[0]!
    const next = autoPlayFor(state, player)
    expect(waiting(next)).not.toEqual([player])
    expect(waiting(next)).toHaveLength(1)
    expect(problems(next)).toEqual([])
  })

  it("takes a low card from the discard and puts it over the highest card it can see", () => {
    const state = layout({ players: 2, discard: [-1, 9], grids: { ana: [up(11), up(2), 4, up(3)] } })
    const next = autoPlayFor(state, "ana")
    expect(gridValues(next, "ana")[0]).toBe(-1)
    expect(next.discard.length).toBe(state.discard.length)
  })

  it("completes a column when it can", () => {
    const state = layout({ players: 2, discard: [7, 9], grids: { ana: [up(7), up(7), 12, up(1)] } })
    const next = autoPlayFor(state, "ana")
    expect(gridValues(next, "ana").slice(0, 3)).toEqual([null, null, null])
  })

  it("draws when the discard is high, and throws away a high card, turning the first face-down card", () => {
    const state = layout({ players: 2, deck: [12], discard: [10], grids: { ana: [up(1), up(2), 4, up(3)] } })
    const next = autoPlayFor(state, "ana")
    expect(next.discard.map((id) => state.ids.indexOf(id)).length).toBe(2)
    // the 12 was thrown away: it lies on the discard, and the first face-down card (position 2) was turned over
    expect(gridUp(next, "ana")[2]).toBe(true)
    expect(gridValues(next, "ana").slice(0, 2)).toEqual([1, 2])
  })

  it("finishes a turn the player had begun: a card in hand is placed, a flip is made", () => {
    const held = draw(layout({ players: 2, deck: [3], grids: { ana: [up(11), up(2), 4] } }), "ana")
    const placed = autoPlayFor(held, "ana")
    expect(gridValues(placed, "ana")[0]).toBe(3)
    const flipping = discard(draw(layout({ players: 2, deck: [12], grids: { ana: [up(1), up(2), 4] } }), "ana"), "ana")
    const flipped = autoPlayFor(flipping, "ana")
    expect(gridUp(flipped, "ana")[2]).toBe(true)
    expect(waiting(flipped)).toEqual(["bob"])
  })

  it("places a card taken from the discard, which it cannot throw away, even when it is high (it was asked to place it)", () => {
    const state = layout({ players: 2, grids: { ana: [up(1), up(2), 4] }, stage: { kind: "place", player: "ana", card: 12, from: "discard" } })
    const next = autoPlayFor(state, "ana")
    expect(next.stage.kind).toBe("choose")
    // no good place for a 12: it goes over the first card face down
    expect(gridValues(next, "ana")[2]).toBe(12)
    expect(gridUp(next, "ana")[2]).toBe(true)
  })

  it("deals the next round for the dealer who is away", () => {
    const over = playUntil(newState(2, seedOf(2)), (s) => s.stage.kind === "between" && s.rounds.length === 1)
    const dealer = waiting(over)[0]!
    const next = autoPlayFor(over, dealer)
    expect(next.stage.kind).toBe("reveal")
  })

  it("refuses a player the game does not wait for with NOT_WAITING, and so does the kit", () => {
    const state = opened(newState(3, seedOf(3)))
    const other = state.seats.find((id) => id !== waiting(state)[0])!
    expect(refusal(() => autoPlayFor(state, other))).toBe("NOT_WAITING")
    expect(refusal(() => autoPlayFor(state, "zed"))).toBe("NOT_WAITING")
    expect(refusal(() => playFor(GAME, state, other))).toBe("NOT_WAITING")
    expect(refusal(() => playStepFor(GAME, state, other))).toBe("NOT_WAITING")
  })

  it("plays for the players of an opening one after the other, in any order", () => {
    let state = newState(4, seedOf(4))
    for (const id of ["dan", "bob", "ana", "cleo"]) state = autoPlayFor(state, id)
    expect(state.stage.kind).toBe("choose")
  })

  it("is deterministic: the same state gives the same state, and no randomness is read", () => {
    const state = opened(newState(4, seedOf(5)))
    const player = waiting(state)[0]!
    expect(autoPlayFor(state, player)).toEqual(autoPlayFor(state, player))
  })

  it("does not mutate the state it is given", () => {
    const state = deepFreeze(opened(newState(3, seedOf(6))))
    expect(() => autoPlayFor(state, waiting(state)[0]!)).not.toThrow()
  })

  it("says what it did, as a move would", () => {
    const state = opened(newState(3, seedOf(7)))
    const stepped = GAME.autoPlayStep!(state, waiting(state)[0]!)
    expect(stepped.events.length).toBeGreaterThan(0)
    expect(stepped.state).toEqual(GAME.autoPlayFor!(state, waiting(state)[0]!))
  })

  it("plays whole games to the end at every size when all players are away", () => {
    for (let n = 2; n <= 8; n++) {
      let state: State = newState(n, seedOf(10 + n))
      let moves = 0
      while (waitingPlayers(GAME, state).length > 0 && moves++ < 20_000) {
        state = autoPlayFor(state, waitingPlayers(GAME, state)[0]!)
        expect(problems(state), `${n} players, move ${moves}`).toEqual([])
      }
      expect(GAME.isOver(state), `${n} players`).toBe(true)
      expect(state.rounds.length).toBeGreaterThanOrEqual(1)
    }
  })

  it("keeps a round moving: every round of an all-absent table ends", () => {
    let state: State = newState(5, seedOf(21))
    const rng = createRng(1)
    for (let i = 0; i < 20_000 && !GAME.isOver(state); i++) {
      const waits = waitingPlayers(GAME, state)
      state = autoPlayFor(state, waits[Math.floor(rng() * waits.length)]!)
    }
    expect(GAME.isOver(state)).toBe(true)
    expect(seatOf(state, "ana")).toBe(0)
  })
})

/** Plays for whoever the game waits for until `stop`. */
function playUntil(state: State, stop: (state: State) => boolean): State {
  let s = state
  for (let i = 0; i < 20_000 && !stop(s); i++) s = autoPlayFor(s, waiting(s)[0]!)
  return s
}
