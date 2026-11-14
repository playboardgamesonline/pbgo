import { describe, expect, it } from "vitest"
import { step } from "./actions"
import { GAME } from "./game"
import { deepFreeze } from "@pbgo/engine-kit/testing"
import {
  deal, discard, draw, flip, gridUp, gridValues, kinds, layout, newState, opened, place, problems, refusal, reveal, seedOf, take, up, values, viewOf, waiting,
} from "./test-utils"
import type { State } from "./types"

// Rulebook, pages 1 to 3: the opening, and a turn (the choices 1 and 2).

describe("the opening: everybody turns two cards over (page 1)", () => {
  it("waits for every player at once, in seat order", () => {
    const state = newState(4)
    expect(waiting(state)).toEqual(["ana", "bob", "cleo", "dan"])
  })

  it("turns the card a player names face up, and takes them out of the wait after two", () => {
    let state = newState(3)
    state = reveal(state, "bob", 5)
    expect(gridUp(state, "bob")[5]).toBe(true)
    expect(waiting(state)).toEqual(["ana", "bob", "cleo"])
    state = reveal(state, "bob", 6)
    expect(waiting(state)).toEqual(["ana", "cleo"])
    expect(gridUp(state, "bob").filter(Boolean)).toHaveLength(2)
  })

  it("lets the players turn them over in any order", () => {
    let a = newState(3, seedOf(1))
    let b = newState(3, seedOf(1))
    for (const [id, position] of [["ana", 0], ["bob", 0], ["cleo", 0], ["ana", 1], ["bob", 1], ["cleo", 1]] as const) a = reveal(a, id, position)
    for (const [id, position] of [["cleo", 0], ["cleo", 1], ["bob", 0], ["bob", 1], ["ana", 0], ["ana", 1]] as const) b = reveal(b, id, position)
    expect(a.grids).toEqual(b.grids)
    expect(a.stage).toEqual(b.stage)
  })

  it("refuses a third card (the player is no longer waited for), a card already face up, and a cell that is not one", () => {
    let state = newState(3)
    state = reveal(reveal(state, "ana", 0), "ana", 1)
    expect(refusal(() => reveal(state, "ana", 2))).toBe("NOT_YOUR_TURN")
    expect(refusal(() => reveal(state, "bob", 12))).toBe("INVALID_POSITION")
    expect(refusal(() => reveal(state, "bob", -1))).toBe("INVALID_POSITION")
    expect(refusal(() => reveal(state, "bob", 1.5))).toBe("INVALID_POSITION")
    expect(refusal(() => step(state, { type: "reveal", playerId: "bob" } as never))).toBe("INVALID_POSITION")
    const bob = reveal(state, "bob", 4)
    expect(refusal(() => reveal(bob, "bob", 4))).toBe("CARD_FACE_UP")
  })

  it("refuses the other actions during the opening", () => {
    const state = newState(3)
    for (const type of ["take", "draw", "discard", "deal"] as const) expect(refusal(() => step(state, { type, playerId: "ana" })), type).toBe("INVALID_PHASE")
    expect(refusal(() => step(state, { type: "place", playerId: "ana", position: 0 }))).toBe("INVALID_PHASE")
    expect(refusal(() => step(state, { type: "flip", playerId: "ana", position: 0 }))).toBe("INVALID_PHASE")
  })

  it("starts the round when the last card is turned over, and says who begins", () => {
    let state = newState(2, seedOf(2))
    state = reveal(reveal(reveal(state, "ana", 0), "ana", 3), "bob", 0)
    expect(state.stage.kind).toBe("reveal")
    const last = step(state, { type: "reveal", playerId: "bob", position: 3 })
    expect(last.state.stage.kind).toBe("choose")
    expect(kinds(last)).toEqual(["reveal", "start"])
  })
})

describe("who begins (page 2)", () => {
  /** A rigged table at the end of the opening: ana, bob and cleo have turned their two cards over, the last click is dan's. */
  const begin = (sums: Record<string, [number, number]>, dealer?: string) => {
    const names = Object.keys(sums)
    const grids = Object.fromEntries(names.map((id) => [id, [up(sums[id]![0]), undefined, undefined, up(sums[id]![1])]]))
    const closing = layout({ players: names, grids, dealer, stage: { kind: "reveal" } })
    // the last player still has a card to turn: undo one of theirs
    const lastId = names[names.length - 1]!
    const lastSeat = names.length - 1
    const state: State = structuredClone(closing)
    state.grids[lastSeat]![3]!.up = false
    return { state, lastId }
  }

  it("is the player whose two cards add up highest: the rulebook's example (12 and -2 = 10 against 4 and 2 = 6)", () => {
    const { state, lastId } = begin({ ana: [4, 2], bob: [12, -2] })
    const done = reveal(state, lastId, 3)
    expect(done.stage).toEqual({ kind: "choose", seat: 1 })
    expect(waiting(done)).toEqual(["bob"])
  })

  it("counts negative cards", () => {
    const { state, lastId } = begin({ ana: [-2, -1], bob: [0, 0] })
    expect(reveal(state, lastId, 3).stage).toEqual({ kind: "choose", seat: 1 })
  })

  it("goes, in a tie, to the first of the tied players clockwise from the dealer's left (the rulebook is silent)", () => {
    // ana, bob and cleo all show 10; dan deals: the player on his left is ana
    const a = begin({ ana: [4, 6], bob: [5, 5], cleo: [10, 0], dan: [1, 1] }, "dan")
    expect(reveal(a.state, a.lastId, 3).stage).toEqual({ kind: "choose", seat: 0 })
    // bob deals: the first tied player after him is cleo
    const b = begin({ ana: [4, 6], bob: [5, 5], cleo: [10, 0], dan: [1, 1] }, "bob")
    expect(reveal(b.state, b.lastId, 3).stage).toEqual({ kind: "choose", seat: 2 })
  })

  it("is decided by a rigged table at every size, from 2 to 8, with the real deal", () => {
    for (let n = 2; n <= 8; n++) {
      const state = opened(newState(n, seedOf(n)))
      expect(state.stage.kind).toBe("choose")
      const first = (state.stage as { seat: number }).seat
      const sums = state.seats.map((_, seat) => state.grids[seat]!.filter((cell) => cell?.up).reduce((total, cell) => total + values(state, [cell!.card])[0]!, 0))
      expect(sums[first]).toBe(Math.max(...sums))
    }
  })
})

describe("choice 1: take the discard (page 2)", () => {
  const table = () => layout({ players: 3, discard: [3, 9], grids: { ana: [up(8), up(1), 5] } })

  it("takes the top card of the discard: the player must place it, and everybody saw it", () => {
    const result = step(table(), { type: "take", playerId: "ana" })
    expect(result.state.stage).toMatchObject({ kind: "place", seat: 0, from: "discard" })
    expect(values(result.state, result.state.discard)).toEqual([9])
    const phase = viewOf(result.state, "bob").phase
    expect(phase).toMatchObject({ kind: "place", player: "ana", from: "discard", canDiscard: false })
    expect((phase as { card: { type: string } }).card.type).toBe("card-3")
    expect(kinds(result)).toEqual(["take"])
  })

  it("puts it in a face-up cell, and the card that was there goes on the discard", () => {
    let state = take(table(), "ana")
    state = place(state, "ana", 0)
    expect(gridValues(state, "ana")[0]).toBe(3)
    expect(gridUp(state, "ana")[0]).toBe(true)
    expect(values(state, state.discard)).toEqual([8, 9])
    expect(waiting(state)).toEqual(["bob"])
  })

  it("puts it over a face-down card without looking at it: the card comes out face up on the discard, and the new one lies face up", () => {
    let state = take(table(), "ana")
    const hidden = state.grids[0]![2]!.card
    const hiddenValue = values(state, [hidden])[0]
    const result = step(state, { type: "place", playerId: "ana", position: 2 })
    state = result.state
    expect(gridUp(state, "ana")[2]).toBe(true)
    expect(gridValues(state, "ana")[2]).toBe(3)
    expect(values(state, state.discard)[0]).toBe(hiddenValue)
    expect(result.events[0]!.event).toMatchObject({ kind: "place", position: 2, replacedUp: false })
  })

  it("cannot throw the card away: it must be placed", () => {
    const state = take(table(), "ana")
    expect(refusal(() => discard(state, "ana"))).toBe("MUST_PLACE")
    expect(refusal(() => draw(state, "ana"))).toBe("INVALID_PHASE")
    expect(refusal(() => take(state, "ana"))).toBe("INVALID_PHASE")
    expect(refusal(() => flip(state, "ana", 2))).toBe("INVALID_PHASE")
  })
})

describe("choice 2: draw from the pile (page 2)", () => {
  const table = () => layout({ players: 3, deck: [7, 2], discard: [3], grids: { ana: [up(8), up(1), 5] } })

  it("draws the top card: only the player sees it, and they may place it or throw it away", () => {
    const result = step(table(), { type: "draw", playerId: "ana" })
    const { state } = result
    expect(state.stage).toMatchObject({ kind: "place", from: "deck" })
    expect(values(state, state.deck)[0]).toBe(2)
    const mine = viewOf(state, "ana").phase
    expect(mine).toMatchObject({ kind: "place", player: "ana", from: "deck", canDiscard: true })
    expect((mine as { card: { type: string } }).card.type).toBe("card-7")
    for (const viewer of ["bob", "cleo", null]) expect(viewOf(state, viewer).phase).toMatchObject({ kind: "place", card: null })
    // the log tells the others that a card was drawn, and not which
    const [entry] = result.events
    expect(entry!.to).toEqual(["ana"])
    expect(entry!.event).toMatchObject({ kind: "draw", card: { type: "card-7" } })
    expect(entry!.masked).toEqual({ kind: "draw", by: "ana" })
  })

  it("places it like a card taken from the discard", () => {
    const state = place(draw(table(), "ana"), "ana", 0)
    expect(gridValues(state, "ana")[0]).toBe(7)
    expect(values(state, state.discard)).toEqual([8, 3])
  })

  it("throws it away, which puts it on the discard and asks the player to turn a card over", () => {
    const result = step(draw(table(), "ana"), { type: "discard", playerId: "ana" })
    expect(result.state.stage).toMatchObject({ kind: "flip", seat: 0 })
    expect(values(result.state, result.state.discard)).toEqual([7, 3])
    expect(viewOf(result.state, "bob").phase).toEqual({ kind: "flip", player: "ana" })
    expect(waiting(result.state)).toEqual(["ana"])
    expect(kinds(result)).toEqual(["discard"])
  })

  it("then turns a face-down card over, which ends the turn", () => {
    const thrown = discard(draw(table(), "ana"), "ana")
    const result = step(thrown, { type: "flip", playerId: "ana", position: 5 })
    expect(gridUp(result.state, "ana")[5]).toBe(true)
    expect(waiting(result.state)).toEqual(["bob"])
    expect(kinds(result)).toEqual(["reveal"])
    expect(result.events[0]!.event).toMatchObject({ kind: "reveal", how: "flip", position: 5 })
  })

  it("cannot flip a card that is already face up, nor one that is not a cell, nor place while flipping", () => {
    const thrown = discard(draw(table(), "ana"), "ana")
    expect(refusal(() => flip(thrown, "ana", 0))).toBe("CARD_FACE_UP")
    expect(refusal(() => flip(thrown, "ana", 12))).toBe("INVALID_POSITION")
    expect(refusal(() => place(thrown, "ana", 3))).toBe("INVALID_PHASE")
    expect(refusal(() => draw(thrown, "ana"))).toBe("INVALID_PHASE")
    expect(refusal(() => discard(thrown, "ana"))).toBe("INVALID_PHASE")
  })

  it("cannot be placed on a cell that is not one", () => {
    const state = draw(table(), "ana")
    for (const position of [-1, 12, 99, 2.5, "0", null, undefined]) {
      expect(refusal(() => step(state, { type: "place", playerId: "ana", position } as never)), String(position)).toBe("INVALID_POSITION")
    }
  })

  it("cannot be placed in a column that was thrown away", () => {
    const state = draw(layout({ players: 3, deck: [7], grids: { ana: [null, null, null, 5] } }), "ana")
    expect(refusal(() => place(state, "ana", 1))).toBe("INVALID_POSITION")
    expect(refusal(() => place(state, "ana", 2))).toBe("INVALID_POSITION")
  })
})

describe("whose move it is", () => {
  const state = layout({ players: 3, deck: [7], grids: { ana: [up(8), 5] } })

  it("refuses the others with NOT_YOUR_TURN, and a stranger too", () => {
    for (const type of ["take", "draw"] as const) {
      expect(refusal(() => step(state, { type, playerId: "bob" }))).toBe("NOT_YOUR_TURN")
      expect(refusal(() => step(state, { type, playerId: "zed" }))).toBe("NOT_YOUR_TURN")
    }
  })

  it("passes the turn clockwise, from the last seat to the first", () => {
    let s = layout({ players: 3, deck: [7, 7, 7], grids: {}, stage: { kind: "choose", player: "cleo" } })
    s = flip(discard(draw(s, "cleo"), "cleo"), "cleo", 0)
    expect(waiting(s)).toEqual(["ana"])
  })

  it("refuses junk: not an object, no type, a type that is not the game's, no player", () => {
    for (const junk of [null, undefined, 5, "draw", [], {}, { type: "draw" }, { type: "fly", playerId: "ana" }, { type: "draw", playerId: 3 }, { playerId: "ana" }]) {
      expect(refusal(() => step(state, junk as never)), JSON.stringify(junk)).toMatch(/^(INVALID_ACTION|NOT_YOUR_TURN)$/)
    }
    expect(refusal(() => step(state, null as never))).toBe("INVALID_ACTION")
    expect(refusal(() => step(state, { type: "fly", playerId: "ana" } as never))).toBe("INVALID_ACTION")
  })

  it("leaves the state as it was after a refusal, and never mutates what it is given", () => {
    const frozen = deepFreeze(structuredClone(state))
    const copy = structuredClone(frozen)
    expect(() => step(frozen, { type: "draw", playerId: "bob" })).toThrow()
    expect(step(frozen, { type: "draw", playerId: "ana" }).state).not.toBe(frozen)
    expect(frozen).toEqual(copy)
  })
})

describe("a whole turn keeps the cards where they are", () => {
  it("keeps every card in one place through a turn", () => {
    for (const first of ["take", "draw"] as const) {
      let state = opened(newState(4, seedOf(8)))
      const player = waiting(state)[0]!
      state = step(state, { type: first, playerId: player }).state
      expect(problems(state)).toEqual([])
      state = place(state, player, 4)
      expect(problems(state)).toEqual([])
    }
  })

  it("is the engine of the platform too: the definition applies the same actions", () => {
    const state = opened(newState(2, seedOf(9)))
    const player = waiting(state)[0]!
    expect(GAME.apply(state, { type: "draw", playerId: player })).toEqual(step(state, { type: "draw", playerId: player }).state)
    expect(refusal(() => deal(state, player))).toBe("INVALID_PHASE")
  })
})
