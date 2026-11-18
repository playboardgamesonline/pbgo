import { viewLog } from "@pbgo/engine-kit"
import { deepFreeze } from "@pbgo/engine-kit/testing"
import { describe, expect, it } from "vitest"
import { step } from "./actions"
import { autoPlayFor } from "./autoplay"
import { GAME } from "./game"
import { areaNames, cardIn, deckNames, handNames, keepCards, keepStep, kinds, layout, names, playCard, playStep, problems, refusal, viewOf, waiting } from "./test-utils"
import type { LoveLetterLogEntry } from "./types"

// Rulebook, p. 10: the Chancellor. Draw two cards from the deck into your hand, choose and keep one of the three cards now in your hand, and secretly place the
// other two face down on the bottom of the deck in any order, without revealing them to anyone else. If there is only one card in the deck, draw it and return one
// card. If there are no cards left, the card is played with no effect. The turn is two actions: the Chancellor is played (`play`), then the player keeps a card (`keep`).

/** What a viewer reads of the log of a move. */
const read = (events: readonly LoveLetterLogEntry[], viewer: string | null) => viewLog(events, viewer)

/** Three players: ana plays a Chancellor and holds a Spy, and the deck starts with a Priest and a King. */
const table = () => layout({ players: 3, hands: { ana: ["chancellor", "spy"], bob: ["guard"], cleo: ["handmaid"] }, deck: ["priest", "king", "baron", "guard"] })

/** The same table once the Chancellor is played: ana holds a Spy, a Priest and a King and keeps one. */
const played = () => playCard(table(), "ana", "chancellor")

describe("playing the Chancellor (p. 10)", () => {
  it("draws two cards from the deck into the hand: three in all, and the turn waits for the player to keep one", () => {
    const state = played()
    expect(state.stage).toEqual({ kind: "keep" })
    expect(handNames(state, "ana")).toEqual(["spy", "priest", "king"])
    expect(deckNames(state).slice(0, 2)).toEqual(["baron", "guard"])
    expect(areaNames(state, "ana")).toEqual(["chancellor"])
    expect(waiting(state)).toEqual(["ana"])
    expect(problems(state)).toEqual([])
  })

  it("does not end the turn: nobody else has drawn, and the others see that a card is to be kept", () => {
    const { state, events } = playStep(table(), "ana", "chancellor")
    expect(kinds({ events })).toEqual(["play", "chancellor"])
    for (const viewer of ["ana", "bob", "cleo", "stranger", null]) expect(viewOf(state, viewer).phase, String(viewer)).toEqual({ kind: "keep", player: "ana" })
    expect(handNames(state, "bob")).toEqual(["guard"])
  })

  it("shows the two cards drawn to the player alone: the others read that two were drawn (p. 10)", () => {
    const { events } = playStep(table(), "ana", "chancellor")
    expect(read(events, "ana").find((event) => event.kind === "chancellor")).toMatchObject({ kind: "chancellor", by: "ana", drew: 2, cards: [{ type: "priest" }, { type: "king" }] })
    for (const viewer of ["bob", "cleo", "stranger", null]) {
      expect(read(events, viewer).find((event) => event.kind === "chancellor"), String(viewer)).toEqual({ kind: "chancellor", by: "ana", drew: 2 })
    }
  })

  it("shows the three cards to their player in their view, and only a count to the others", () => {
    const state = played()
    expect(viewOf(state, "ana").me!.hand.map((face) => face.type)).toEqual(["spy", "priest", "king"])
    expect(viewOf(state, "ana").me!.playable).toEqual([])
    expect(viewOf(state, "bob").players[0]!.cards).toBe(3)
    expect(JSON.stringify(viewOf(state, "bob").players)).not.toContain("priest")
  })

  it("is the Countess's rule's exception: the three cards are free, whatever they are (p. 9)", () => {
    // ana holds a Chancellor and a Guard and draws the Countess and the King: keeping the King is allowed, though she would have had to play the Countess before
    const state = playCard(layout({ players: 3, hands: { ana: ["chancellor", "guard"], bob: ["priest"], cleo: ["baron"] }, deck: ["countess", "king", "spy"] }), "ana", "chancellor")
    expect(handNames(state, "ana")).toEqual(["guard", "countess", "king"])
    expect(() => keepCards(state, "ana", "king", ["guard", "countess"])).not.toThrow()
    expect(() => keepCards(state, "ana", "countess", ["guard", "king"])).not.toThrow()
  })
})

describe("keeping a card (p. 10)", () => {
  it("keeps one of the cards and puts the other two under the deck, in the order the player picks: the first one first, so the last is the last card of the deck", () => {
    const first = keepCards(played(), "ana", "spy", ["priest", "king"])
    expect(handNames(first, "ana")).toEqual(["spy"])
    // the deck was [baron, guard, ...the rest of the box...]: the two cards go under all of it
    expect(deckNames(first).slice(-2)).toEqual(["priest", "king"])
    const second = keepCards(played(), "ana", "spy", ["king", "priest"])
    expect(deckNames(second).slice(-2)).toEqual(["king", "priest"])
  })

  it("may keep any of the three cards: the one drawn first, the one in hand or the one drawn last", () => {
    expect(handNames(keepCards(played(), "ana", "priest", ["spy", "king"]), "ana")).toEqual(["priest"])
    expect(handNames(keepCards(played(), "ana", "king", ["spy", "priest"]), "ana")).toEqual(["king"])
  })

  it("leaves the rest of the deck as it was: the cards that were in it keep their order and their ids (p. 10)", () => {
    const before = played()
    const after = keepCards(before, "ana", "spy", ["priest", "king"])
    // bob draws the top of the deck, the rest is as before, then the cards put back
    expect(after.deck.slice(0, before.deck.length - 1)).toEqual(before.deck.slice(1))
    expect(after.deck).toHaveLength(before.deck.length - 1 + 2)
  })

  it("then passes the turn: the next player draws the top card of the deck (p. 4)", () => {
    const after = keepCards(played(), "ana", "spy", ["priest", "king"])
    expect(after.stage).toEqual({ kind: "play" })
    expect(waiting(after)).toEqual(["bob"])
    expect(handNames(after, "bob")).toEqual(["guard", "baron"])
    expect(problems(after)).toEqual([])
  })

  it("gives the cards put back new ids, which nobody has seen: they went back into hiding after their player saw them", () => {
    const before = played()
    const [priest, king, spy] = [cardIn(before, "ana", "priest"), cardIn(before, "ana", "king"), cardIn(before, "ana", "spy")]
    const after = keepCards(before, "ana", "spy", ["priest", "king"])
    expect(after.ids).not.toContain(priest)
    expect(after.ids).not.toContain(king)
    // the kept card and every other card keep their ids
    expect(after.ids).toContain(spy)
    expect(before.ids.filter((id) => id !== priest && id !== king).every((id) => after.ids.includes(id))).toBe(true)
    expect(new Set(after.ids).size).toBe(21)
    // the cards under the deck are the same characters, under their new ids
    expect(after.deck.slice(-2).every((id) => after.ids.includes(id))).toBe(true)
    expect(names(after, after.deck.slice(-2))).toEqual(["priest", "king"])
  })

  it("draws the new ids from a stream of their own: the shuffles of the next round do not move", () => {
    const a = keepCards(played(), "ana", "spy", ["priest", "king"])
    const b = keepCards(played(), "ana", "spy", ["king", "priest"])
    expect(a.rng).toBe(b.rng)
    expect(a.idsRng).not.toBe(played().idsRng)
  })

  it("puts the cards back neither played nor discarded: a Princess knocks nobody out and a Spy counts for nothing (the reading validated for p. 10)", () => {
    const state = playCard(layout({ players: 3, hands: { ana: ["chancellor", "countess"], bob: ["priest"], cleo: ["baron"] }, deck: ["princess", "spy", "guard"] }), "ana", "chancellor")
    expect(handNames(state, "ana")).toEqual(["countess", "princess", "spy"])
    const after = keepCards(state, "ana", "countess", ["princess", "spy"])
    expect(after.out).toEqual([false, false, false])
    expect(areaNames(after, "ana")).toEqual(["chancellor"])
    expect(after.spies).toEqual([0, 0, 0])
  })

  it("tells its player alone what they kept and what they put back, under the ids they had, and the others that cards were put back", () => {
    const before = played()
    const { events } = keepStep(before, "ana", "spy", ["priest", "king"])
    const priest = cardIn(before, "ana", "priest")
    const king = cardIn(before, "ana", "king")
    expect(read(events, "ana").find((event) => event.kind === "bottom")).toMatchObject({
      kind: "bottom",
      by: "ana",
      count: 2,
      kept: { type: "spy" },
      cards: [
        { id: priest, type: "priest" },
        { id: king, type: "king" },
      ],
    })
    for (const viewer of ["bob", "cleo", "stranger", null]) {
      expect(read(events, viewer).find((event) => event.kind === "bottom"), String(viewer)).toEqual({ kind: "bottom", by: "ana", count: 2 })
    }
  })

  it("never shows the others what the cards were: their logs hold no card of the Chancellor's, nor an id of one", () => {
    const before = played()
    const { events, state } = keepStep(before, "ana", "spy", ["priest", "king"])
    const everything = [cardIn(before, "ana", "priest"), cardIn(before, "ana", "king"), cardIn(before, "ana", "spy"), ...state.deck.slice(-2)]
    for (const viewer of ["bob", "cleo", "stranger", null]) {
      const json = JSON.stringify(read(events, viewer))
      expect(json, String(viewer)).not.toMatch(/priest|king/)
      for (const id of everything) expect(json, `${viewer} ${id}`).not.toContain(String(id))
    }
  })

  it("never shows its player the new ids of the cards under the deck: the entry holds the old ones, which no card holds any more", () => {
    const before = played()
    const { events, state } = keepStep(before, "ana", "spy", ["priest", "king"])
    const json = JSON.stringify(read(events, "ana"))
    for (const id of state.deck.slice(-2)) expect(json).not.toContain(String(id))
  })

  it("is a move of the Chancellor's player alone, once their Chancellor is played (NOT_YOUR_TURN for anybody else)", () => {
    const state = played()
    expect(refusal(() => step(state, { type: "keep", playerId: "bob", card: cardIn(state, "bob", "guard"), bottom: [] }))).toBe("NOT_YOUR_TURN")
  })
})

describe("what a keep refuses", () => {
  const state = played()
  const [spy, priest, king] = [cardIn(state, "ana", "spy"), cardIn(state, "ana", "priest"), cardIn(state, "ana", "king")]
  const keep = (card: unknown, bottom: unknown) => refusal(() => step(state, { type: "keep", playerId: "ana", card, bottom } as never))

  it("a card that is not in the hand: another player's, one of the deck, an id nobody holds (UNKNOWN_CARD)", () => {
    expect(keep(state.hands[1]![0], [spy, priest, king])).toBe("UNKNOWN_CARD")
    expect(keep(state.deck[0], [spy, priest])).toBe("UNKNOWN_CARD")
    expect(keep(-1, [spy, priest])).toBe("UNKNOWN_CARD")
  })

  it("cards to put back that are not the other cards of the hand, each once (INVALID_CHOICE): too few, too many, twice, the kept card, a card of another hand", () => {
    expect(keep(spy, [priest])).toBe("INVALID_CHOICE")
    expect(keep(spy, [priest, king, spy])).toBe("INVALID_CHOICE")
    expect(keep(spy, [priest, priest])).toBe("INVALID_CHOICE")
    expect(keep(spy, [spy, king])).toBe("INVALID_CHOICE")
    expect(keep(spy, [priest, state.hands[1]![0]])).toBe("INVALID_CHOICE")
    expect(keep(spy, [])).toBe("INVALID_CHOICE")
  })

  it("a card or a list that is not made of ids (INVALID_ACTION)", () => {
    for (const card of [undefined, "spy", 1.5, null, Number.NaN]) expect(keep(card, [priest, king]), String(card)).toBe("INVALID_ACTION")
    for (const bottom of [undefined, null, "priest", 7, {}, ["priest", "king"], [1.5, king], [null, king]]) expect(keep(spy, bottom), JSON.stringify(bottom)).toBe("INVALID_ACTION")
  })

  it("a play while a card is to be kept, and a keep when nothing is to be kept (INVALID_PHASE)", () => {
    expect(refusal(() => step(state, { type: "play", playerId: "ana", card: spy }))).toBe("INVALID_PHASE")
    const turn = table()
    expect(refusal(() => step(turn, { type: "keep", playerId: "ana", card: cardIn(turn, "ana", "spy"), bottom: [] }))).toBe("INVALID_PHASE")
    expect(refusal(() => step(state, { type: "deal", playerId: "ana" }))).toBe("INVALID_PHASE")
  })

  it("and leaves the state as it was, with the choice still to make", () => {
    const frozen = deepFreeze(played())
    const snapshot = structuredClone(frozen)
    expect(() => step(frozen, { type: "keep", playerId: "ana", card: spy, bottom: [priest] })).toThrow()
    expect(frozen).toEqual(snapshot)
    expect(waiting(frozen)).toEqual(["ana"])
  })
})

describe("with only one card left in the deck (p. 10)", () => {
  // the Chancellor is played with a Priest as the last card of the deck: ana draws it and returns one card; a Baron is set aside, which nobody sees
  const lastCard = () => layout({ players: 3, hands: { ana: ["chancellor", "spy"], bob: ["guard"], cleo: ["handmaid"] }, deck: ["priest"], aside: "baron", rest: "away" })

  it("draws it and keeps one of the two cards in hand, returning the other (p. 10)", () => {
    const state = playCard(lastCard(), "ana", "chancellor")
    expect(state.stage).toEqual({ kind: "keep" })
    expect(handNames(state, "ana")).toEqual(["spy", "priest"])
    expect(state.deck).toEqual([])
    const after = keepCards(state, "ana", "priest", ["spy"])
    expect(handNames(after, "ana")).toEqual(["priest"])
  })

  it("says that one card was drawn, to its player alone", () => {
    const { events } = playStep(lastCard(), "ana", "chancellor")
    expect(read(events, "ana").find((event) => event.kind === "chancellor")).toMatchObject({ drew: 1, cards: [{ type: "priest" }] })
    expect(read(events, "bob").find((event) => event.kind === "chancellor")).toEqual({ kind: "chancellor", by: "ana", drew: 1 })
  })

  it("puts the returned card into the deck, hidden: the deck is not empty after the turn, so the round goes on and ends after the next turn (the reading validated for pp. 6, 10)", () => {
    const state = keepCards(playCard(lastCard(), "ana", "chancellor"), "ana", "priest", ["spy"])
    // the next player has drawn the returned card, which was the only one: the deck is empty again
    expect(state.deck).toHaveLength(0)
    expect(state.stage).toEqual({ kind: "play" })
    expect(handNames(state, "bob")).toEqual(["guard", "spy"])
    // bob plays, the deck is empty after his turn: the round is counted
    const bobs = playCard(state, "bob", "spy")
    expect(bobs.stage).toMatchObject({ kind: "between", revealed: true })
  })

  it("returns the card kept in hand when the player prefers the one they drew", () => {
    const state = keepCards(playCard(lastCard(), "ana", "chancellor"), "ana", "spy", ["priest"])
    expect(handNames(state, "ana")).toEqual(["spy"])
    expect(handNames(state, "bob")).toEqual(["guard", "priest"])
  })
})

describe("with exactly two cards left in the deck (p. 10)", () => {
  it("draws both, which leaves the deck empty while the card is chosen, and the two cards put back refill it: the round goes on", () => {
    const state = playCard(layout({ players: 3, hands: { ana: ["chancellor", "spy"], bob: ["guard"], cleo: ["handmaid"] }, deck: ["priest", "king"], aside: "baron", rest: "away" }), "ana", "chancellor")
    expect(state.deck).toEqual([])
    expect(state.stage).toEqual({ kind: "keep" })
    const after = keepCards(state, "ana", "spy", ["king", "priest"])
    expect(after.stage).toEqual({ kind: "play" })
    // bob drew the first of the two cards put back, the other is the last card of the deck
    expect(handNames(after, "bob")).toEqual(["guard", "king"])
    expect(deckNames(after)).toEqual(["priest"])
  })
})

describe("with no card left in the deck (p. 10)", () => {
  const empty = () => layout({ players: 3, hands: { ana: ["chancellor", "spy"], bob: ["guard"], cleo: ["handmaid"] }, deck: [], aside: "baron", rest: "away" })

  it("is played with no effect: it lies in front of its player, who keeps their hand, and nothing waits for them", () => {
    const { state, events } = playStep(empty(), "ana", "chancellor")
    expect(areaNames(state, "ana")).toEqual(["chancellor"])
    expect(handNames(state, "ana")).toEqual(["spy"])
    expect(kinds({ events })).toEqual(["play", "fizzled", "reveal", "end"])
    expect(state.stage).not.toEqual({ kind: "keep" })
  })

  it("ends the round after the turn, as any turn that leaves the deck empty does (pp. 6, 10)", () => {
    const { state } = playStep(empty(), "ana", "chancellor")
    expect(state.stage).toMatchObject({ kind: "between", revealed: true })
  })
})

describe("an absent player who plays a Chancellor", () => {
  it("is played for in one go: the Chancellor is played and the card of the highest value is kept, the others put back in the order of the hand", () => {
    // the Chancellor is the lowest card she can play, the Princess the highest of all
    const rigged = layout({ players: 3, hands: { ana: ["chancellor", "princess"], bob: ["priest"], cleo: ["baron"] }, deck: ["king", "spy", "handmaid"] })
    const after = autoPlayFor(rigged, "ana")
    // she drew the King and the Spy and holds the Princess: the Princess (9) is kept, the King and the Spy go back in the order of her hand
    expect(handNames(after, "ana")).toEqual(["princess"])
    expect(deckNames(after).slice(-2)).toEqual(["king", "spy"])
    expect(areaNames(after, "ana")).toEqual(["chancellor"])
    expect(waiting(after)).toEqual(["bob"])
  })

  it("is played for when the player is left waiting to keep a card: the step is the keep alone", () => {
    const waitingState = played()
    expect(waiting(waitingState)).toEqual(["ana"])
    const after = autoPlayFor(waitingState, "ana")
    expect(handNames(after, "ana")).toEqual(["king"])
    expect(deckNames(after).slice(-2)).toEqual(["spy", "priest"])
    expect(waiting(after)).toEqual(["bob"])
  })

  it("says what it did through autoPlayStep: the Chancellor, the cards put back and the draw of the next player", () => {
    const rigged = layout({ players: 3, hands: { ana: ["chancellor", "princess"], bob: ["priest"], cleo: ["baron"] }, deck: ["king", "spy", "handmaid"] })
    const stepped = GAME.autoPlayStep!(rigged, "ana")
    expect(kinds(stepped)).toEqual(["play", "chancellor", "bottom", "draw"])
  })
})
