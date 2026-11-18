import type { CharacterKey, Face, PlayerView, PublicPhase } from "@love-letter/engine"
import { describe, expect, it } from "vitest"
import { type Choice, keepAction, NO_CHOICE, playAction, pressable, pressCard, pressTarget, type Step, stepOf, swapOrder, validChoice } from "./turn"

const face = (id: number, type: CharacterKey): Face => ({ id, type })

/** A view of a table of `others` opponents as the viewer `ada` reads it, with what a test changes */
function viewOf({ hand, playable, phase, targets = ["ben", "cleo"] }: { hand: Face[]; playable?: number[]; phase?: PublicPhase; targets?: string[] }): PlayerView {
  return {
    options: {},
    me: { id: "ada", hand, playable: playable ?? hand.map((card) => card.id) },
    players: [],
    standings: [],
    deck: { size: 10 },
    aside: 1,
    faceUp: [],
    round: 1,
    target: 4,
    phase: phase ?? { kind: "turn", player: "ada", targets },
    results: null,
  }
}

const turn = (hand: Face[], extra: { playable?: number[]; targets?: string[] } = {}) => viewOf({ hand, ...extra })

describe("what the board offers on the viewer's turn", () => {
  it("asks for a card first, and says when only the Countess can be played", () => {
    expect(stepOf(turn([face(1, "guard"), face(2, "priest")]), NO_CHOICE)).toEqual({ kind: "pick", forced: false })
    expect(stepOf(turn([face(1, "countess"), face(2, "king")], { playable: [1] }), NO_CHOICE)).toEqual({ kind: "pick", forced: true })
  })

  it("offers a Play pad for a card that picks nobody, however many players could be picked", () => {
    for (const type of ["spy", "handmaid", "countess", "princess", "chancellor"] as const) {
      const hand = [face(1, type), face(2, "guard")]
      expect(stepOf(turn(hand), pressCard(NO_CHOICE, 1)), type).toEqual({ kind: "pad", card: hand[0], empty: false })
    }
  })

  it("lights the players that can be picked for a Guard, a Priest, a Baron or a King, never the viewer", () => {
    for (const type of ["guard", "priest", "baron", "king"] as const) {
      const hand = [face(1, type), face(2, "spy")]
      expect(stepOf(turn(hand), pressCard(NO_CHOICE, 1)), type).toEqual({ kind: "target", card: hand[0], targets: ["ben", "cleo"], self: false })
    }
  })

  it("lights the viewer as well for a Prince, who can pick any player, and only the viewer when the others are out or protected", () => {
    const hand = [face(1, "prince"), face(2, "spy")]
    expect(stepOf(turn(hand), pressCard(NO_CHOICE, 1))).toEqual({ kind: "target", card: hand[0], targets: ["ada", "ben", "cleo"], self: true })
    expect(stepOf(turn(hand, { targets: [] }), pressCard(NO_CHOICE, 1))).toEqual({ kind: "target", card: hand[0], targets: ["ada"], self: true })
  })

  it("offers the Play pad with no player when nobody can be picked, for the cards that pick another player", () => {
    for (const type of ["guard", "priest", "baron", "king"] as const) {
      const hand = [face(1, type), face(2, "spy")]
      expect(stepOf(turn(hand, { targets: [] }), pressCard(NO_CHOICE, 1)), type).toEqual({ kind: "pad", card: hand[0], empty: true })
    }
  })

  it("goes on to the nine characters once a Guard has a player, and back to the players when that player can no longer be picked", () => {
    const hand = [face(1, "guard"), face(2, "spy")]
    const picked = pressTarget(pressCard(NO_CHOICE, 1), "ben")
    expect(stepOf(turn(hand), picked)).toEqual({ kind: "guess", card: hand[0], target: "ben", targets: ["ben", "cleo"] })
    expect(stepOf(turn(hand, { targets: ["cleo"] }), picked)).toEqual({ kind: "target", card: hand[0], targets: ["cleo"], self: false })
  })

  it("never offers a card the Countess rule forbids, even when it is the one that was picked", () => {
    const hand = [face(1, "countess"), face(2, "king")]
    const view = turn(hand, { playable: [1] })
    expect(stepOf(view, pressCard(NO_CHOICE, 2))).toEqual({ kind: "pick", forced: true })
    expect(stepOf(view, pressCard(NO_CHOICE, 1))).toEqual({ kind: "pad", card: hand[0], empty: false })
    expect(pressable(view, hand[0]!)).toBe(true)
    expect(pressable(view, hand[1]!)).toBe(false)
  })

  it("offers nothing to a spectator, to another player's turn, or to the viewer once the game is over", () => {
    const hand = [face(1, "guard"), face(2, "spy")]
    expect(stepOf({ ...turn(hand), me: null }, NO_CHOICE)).toEqual({ kind: "none" })
    expect(stepOf(viewOf({ hand, phase: { kind: "turn", player: "ben", targets: ["ada", "cleo"] } }), NO_CHOICE)).toEqual({ kind: "none" })
    expect(stepOf(viewOf({ hand, phase: { kind: "over" } }), NO_CHOICE)).toEqual({ kind: "none" })
    expect(pressable(viewOf({ hand, phase: { kind: "turn", player: "ben", targets: [] } }), hand[0]!)).toBe(false)
  })
})

describe("a Chancellor's keep", () => {
  const hand = [face(1, "guard"), face(2, "chancellor"), face(3, "king")]
  const keep = viewOf({ hand, phase: { kind: "keep", player: "ada" } })

  it("asks for the card to keep first, and every card of the hand can be pressed", () => {
    expect(stepOf(keep, NO_CHOICE)).toEqual({ kind: "keep" })
    for (const card of hand) expect(pressable(keep, card)).toBe(true)
  })

  it("puts the other cards back in the order they lie in the hand, and swaps them on demand", () => {
    const picked = pressCard(NO_CHOICE, 2)
    const step = stepOf(keep, picked) as Extract<Step, { kind: "order" }>
    expect(step.kind).toBe("order")
    expect(step.kept).toEqual(hand[1])
    expect(step.others.map((card) => card.id)).toEqual([1, 3])
    expect(keepAction(step)).toEqual({ type: "keep", card: 2, bottom: [1, 3] })
    const swapped = swapOrder(step, picked)
    const after = stepOf(keep, swapped) as Extract<Step, { kind: "order" }>
    expect(after.others.map((card) => card.id)).toEqual([3, 1])
    expect(keepAction(after)).toEqual({ type: "keep", card: 2, bottom: [3, 1] })
    // and swapped again, it is as it was
    expect((stepOf(keep, swapOrder(after, swapped)) as Extract<Step, { kind: "order" }>).others.map((card) => card.id)).toEqual([1, 3])
  })

  it("takes the other card of a hand of two as it is, with nothing to swap", () => {
    const two = viewOf({ hand: [face(1, "guard"), face(2, "chancellor")], phase: { kind: "keep", player: "ada" } })
    const step = stepOf(two, pressCard(NO_CHOICE, 1)) as Extract<Step, { kind: "order" }>
    expect(step.others).toHaveLength(1)
    expect(keepAction(step)).toEqual({ type: "keep", card: 1, bottom: [2] })
  })

  it("ignores an order that does not name the cards put back", () => {
    const step = stepOf(keep, { card: 2, target: null, order: [1, 9] }) as Extract<Step, { kind: "order" }>
    expect(step.others.map((card) => card.id)).toEqual([1, 3])
  })

  it("is not offered to the other players", () => {
    expect(stepOf(viewOf({ hand, phase: { kind: "keep", player: "ben" } }), NO_CHOICE)).toEqual({ kind: "none" })
  })
})

describe("dealing the next round", () => {
  it("offers the Deal pad to the player who takes the first turn, and nothing to the others", () => {
    const between = (next: string): PublicPhase => ({ kind: "between", next, winners: ["ben"], spy: null, revealed: true })
    expect(stepOf(viewOf({ hand: [], phase: between("ada") }), NO_CHOICE)).toEqual({ kind: "deal" })
    expect(stepOf(viewOf({ hand: [], phase: between("ben") }), NO_CHOICE)).toEqual({ kind: "none" })
  })
})

describe("what was picked", () => {
  it("is put back by pressing the card again, with the player picked after it", () => {
    const picked = pressTarget(pressCard(NO_CHOICE, 1), "ben")
    expect(pressCard(picked, 1)).toEqual(NO_CHOICE)
    expect(pressCard(picked, 2)).toEqual({ card: 2, target: null, order: null })
  })

  it("ends when it no longer fits the view: the card left the hand, the turn passed, the player can no longer be picked or the rule forbids the card", () => {
    const hand = [face(1, "guard"), face(2, "spy")]
    const picked: Choice = { card: 1, target: "ben", order: null }
    expect(validChoice(turn(hand), picked)).toBe(picked)
    expect(validChoice(turn([face(5, "king"), face(2, "spy")]), picked)).toEqual(NO_CHOICE)
    expect(validChoice(viewOf({ hand, phase: { kind: "turn", player: "ben", targets: ["ada"] } }), picked)).toEqual(NO_CHOICE)
    expect(validChoice(turn(hand, { targets: ["cleo"] }), picked)).toEqual({ card: 1, target: null, order: null })
    expect(validChoice(turn(hand, { playable: [2] }), picked)).toEqual(NO_CHOICE)
    expect(validChoice({ ...turn(hand), me: null }, picked)).toEqual(NO_CHOICE)
    expect(validChoice(turn(hand), NO_CHOICE)).toBe(NO_CHOICE)
  })
})

describe("what is sent", () => {
  it("names the card, and the player and the character only when it has them", () => {
    expect(playAction(face(4, "handmaid"))).toEqual({ type: "play", card: 4 })
    expect(playAction(face(4, "priest"), "ben")).toEqual({ type: "play", card: 4, target: "ben" })
    expect(playAction(face(4, "guard"), "ben", "baron")).toEqual({ type: "play", card: 4, target: "ben", guess: "baron" })
  })
})
