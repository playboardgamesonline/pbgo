import { createRng } from "@pbgo/engine-kit"
import { deepFreeze, reorderKeys } from "@pbgo/engine-kit/testing"
import { describe, expect, it } from "vitest"
import { step } from "./actions"
import { GAME } from "./game"
import { areaNames, cardIn, deckNames, handNames, kinds, layout, newState, playCard, problems, randomAction, refusal, seedOf, viewOf, waiting } from "./test-utils"

// Rulebook, p. 4: on your turn, draw one card from the deck, then choose and play one of your two cards. The card played stays face up in your play area,
// and you keep the other card in your hand. Turns go clockwise (p. 4); a player who is out of the round is skipped (p. 5).
//
// The cards played here are the Spy and the Countess, which do nothing when played (pp. 9, 13), so that these tests are about the turn and not about an effect.

describe("a turn", () => {
  it("is played with two cards in hand: the one kept and the one drawn (p. 4)", () => {
    const state = layout({ hands: { ana: ["spy", "king"] }, deck: ["baron"] })
    expect(handNames(state, "ana")).toEqual(["spy", "king"])
    expect(handNames(state, "bob")).toHaveLength(1)
  })

  it("puts the card played face up in the player's play area and keeps the other in hand (p. 4)", () => {
    const state = playCard(layout({ hands: { ana: ["spy", "king"] }, deck: ["baron"] }), "ana", "spy")
    expect(areaNames(state, "ana")).toEqual(["spy"])
    expect(handNames(state, "ana")).toEqual(["king"])
  })

  it("lets the player choose either of their two cards (p. 4)", () => {
    const state = layout({ hands: { ana: ["spy", "king"] }, deck: ["baron"] })
    expect(handNames(playCard(state, "ana", "king"), "ana")).toEqual(["spy"])
    expect(areaNames(playCard(state, "ana", "king"), "ana")).toEqual(["king"])
  })

  it("passes to the next player clockwise, who draws the top card of the deck (p. 4)", () => {
    const state = playCard(layout({ hands: { ana: ["spy", "king"], bob: ["guard"] }, deck: ["baron", "priest"] }), "ana", "spy")
    expect(waiting(state)).toEqual(["bob"])
    expect(handNames(state, "bob")).toEqual(["guard", "baron"])
    expect(deckNames(state).slice(0, 1)).toEqual(["priest"])
  })

  it("goes round the table and comes back to the first player (p. 4)", () => {
    let state = layout({ players: 3, hands: { ana: ["spy", "king"], bob: ["guard"], cleo: ["guard"] }, deck: ["countess", "spy", "baron"] })
    const order: string[] = []
    for (const card of ["spy", "countess", "spy"] as const) {
      const [who] = waiting(state)
      order.push(who!)
      state = playCard(state, who!, card)
    }
    expect(order).toEqual(["ana", "bob", "cleo"])
    expect(waiting(state)).toEqual(["ana"])
  })

  it("skips a player who is out of the round (p. 5)", () => {
    const state = playCard(layout({ players: 4, hands: { ana: ["spy", "king"] }, deck: ["baron", "priest"], out: ["bob", "cleo"] }), "ana", "spy")
    expect(waiting(state)).toEqual(["dan"])
  })

  it("draws for the next player and leaves one card less in the deck (p. 4)", () => {
    const before = layout({ hands: { ana: ["spy", "king"] }, deck: ["baron", "priest", "spy"] })
    const after = playCard(before, "ana", "spy")
    expect(after.deck).toHaveLength(before.deck.length - 1)
    expect(problems(after)).toEqual([])
  })

  it("ends the turn of a player, so that the same player cannot play twice (p. 4)", () => {
    const state = playCard(layout({ hands: { ana: ["spy", "king"] }, deck: ["baron", "priest"] }), "ana", "spy")
    expect(refusal(() => step(state, { type: "play", playerId: "ana", card: cardIn(state, "ana", "king") }))).toBe("NOT_YOUR_TURN")
  })
})

describe("what a turn refuses", () => {
  const state = layout({ hands: { ana: ["spy", "king"], bob: ["guard"] }, deck: ["baron"] })

  it("a play by a player whose turn it is not (NOT_YOUR_TURN)", () => {
    expect(refusal(() => step(state, { type: "play", playerId: "bob", card: cardIn(state, "bob", "guard") }))).toBe("NOT_YOUR_TURN")
  })

  it("a play by somebody who is not at the table (NOT_YOUR_TURN)", () => {
    expect(refusal(() => step(state, { type: "play", playerId: "zed", card: 1 }))).toBe("NOT_YOUR_TURN")
  })

  it("a card that is not in the player's hand, however it came by its id: another player's card, a card in the deck, an id nobody holds (UNKNOWN_CARD)", () => {
    expect(refusal(() => step(state, { type: "play", playerId: "ana", card: cardIn(state, "bob", "guard") }))).toBe("UNKNOWN_CARD")
    expect(refusal(() => step(state, { type: "play", playerId: "ana", card: state.deck[0]! }))).toBe("UNKNOWN_CARD")
    expect(refusal(() => step(state, { type: "play", playerId: "ana", card: -1 }))).toBe("UNKNOWN_CARD")
  })

  it("a card the player already played, which lies in their play area (UNKNOWN_CARD)", () => {
    const played = layout({ hands: { ana: ["spy", "king"] }, areas: { ana: ["countess"] }, deck: ["baron"] })
    expect(refusal(() => step(played, { type: "play", playerId: "ana", card: played.areas[0]![0]! }))).toBe("UNKNOWN_CARD")
  })

  it("a card that is not an id: nothing, a name, a fraction, null (INVALID_ACTION)", () => {
    for (const card of [undefined, "spy", 1.5, null, Number.NaN, {}]) {
      expect(refusal(() => step(state, { type: "play", playerId: "ana", card } as never)), String(card)).toBe("INVALID_ACTION")
    }
  })

  it("an action that is not one of the game's, or not an action at all (INVALID_ACTION)", () => {
    for (const action of [null, undefined, 3, "play", [], {}, { type: "fly", playerId: "ana" }, { type: "play" }, { type: 7, playerId: "ana" }]) {
      expect(refusal(() => step(state, action as never)), JSON.stringify(action)).toBe("INVALID_ACTION")
    }
  })

  it("a deal in the middle of a round (INVALID_PHASE)", () => {
    expect(refusal(() => step(state, { type: "deal", playerId: "ana" }))).toBe("INVALID_PHASE")
  })
})

describe("a step", () => {
  it("never writes to the state it is given, and a refusal leaves it as it was", () => {
    const state = deepFreeze(layout({ hands: { ana: ["spy", "king"], bob: ["guard"] }, deck: ["baron", "spy"] }))
    const snapshot = structuredClone(state)
    expect(() => playCard(state, "ana", "spy")).not.toThrow()
    expect(() => step(state, { type: "play", playerId: "bob", card: 1 })).toThrow()
    expect(state).toEqual(snapshot)
  })

  it("plays the same from a state stored with its keys in another order (jsonb)", () => {
    const rng = createRng(seedOf(3))
    let state = newState(4, seedOf(3))
    for (let i = 0; i < 30 && !GAME.isOver(state); i++) {
      const action = randomAction(state, rng)
      expect(step(reorderKeys(state), action).state, `move ${i}`).toEqual(step(state, action).state)
      state = step(state, action).state
    }
  })

  it("says what it did: the card played, in front of everybody, then the draw of the next player, private to them", () => {
    const state = layout({ hands: { ana: ["spy", "king"], bob: ["guard"] }, deck: ["baron", "spy"] })
    const stepped = GAME.step!(state, { type: "play", playerId: "ana", card: cardIn(state, "ana", "spy") })
    expect(kinds(stepped)).toEqual(["play", "draw"])
    const [play, draw] = stepped.events
    expect(play!.to).toBeUndefined()
    expect(play!.event).toEqual({ kind: "play", by: "ana", card: { id: cardIn(state, "ana", "spy"), type: "spy" } })
    expect(draw!.to).toEqual(["bob"])
    expect(draw!.masked).toEqual({ kind: "draw", by: "bob" })
  })

  it("shows the next player the card they drew, last of their hand, and nobody else", () => {
    const state = playCard(layout({ hands: { ana: ["spy", "king"], bob: ["guard"] }, deck: ["baron", "spy"] }), "ana", "spy")
    expect(viewOf(state, "bob").me?.hand.map((face) => face.type)).toEqual(["guard", "baron"])
    expect(viewOf(state, "ana").me?.hand.map((face) => face.type)).toEqual(["king"])
  })
})
