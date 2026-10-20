import { describe, expect, it } from "vitest"
import { step } from "./actions"
import { deepFreeze, deckTitles, deal, discardTitles, hit, kinds, layout, lineTitles, problems, refusal, statusOf, stay, viewOf, waiting } from "./test-utils"

// "How to play" (booklet pages 4 and 5): the dealer offers each player in turn the option to Hit (get dealt another card) or Stay (exit the
// round and bank their points). You may Stay as long as you have a card in front of you. A busted or staying player is out of the round.

describe("a hit", () => {
  it("turns the top card over in front of the player, and passes the turn to the next player", () => {
    const state = layout({ deck: ["number-4", "number-9"] })
    expect(waiting(state)).toBe("ana")
    const result = step(state, { type: "hit", playerId: "ana" })
    expect(lineTitles(result.state, "ana")).toEqual(["number-4"])
    expect(deckTitles(result.state)[0]).toBe("number-9")
    expect(waiting(result.state)).toBe("bob")
    expect(kinds(result)).toEqual(["draw"])
    expect(result.events[0]!.event).toMatchObject({ kind: "draw", by: "ana", how: "hit", card: { type: "number-4" } })
    expect(problems(result.state)).toEqual([])
  })

  it("puts the Number cards in a single row with the Score Modifier cards beside them, in the order they came", () => {
    let state = layout({ deck: ["number-4", "plus-2", "number-9", "number-7"] })
    state = hit(hit(hit(state, "ana"), "bob"), "cleo")
    state = hit(state, "ana")
    expect(lineTitles(state, "ana")).toEqual(["number-4", "number-7"])
    expect(lineTitles(state, "bob")).toEqual(["plus-2"])
    expect(lineTitles(state, "cleo")).toEqual(["number-9"])
  })

  it("lets a modifier join the line: it never busts, however many a player holds", () => {
    let state = layout({ lines: { ana: ["plus-2"] }, deck: ["plus-4"] })
    state = hit(state, "ana")
    expect(lineTitles(state, "ana")).toEqual(["plus-2", "plus-4"])
    expect(statusOf(state, "ana")).toBe("active")
  })

  it("busts a player who draws a second card with a number they already hold (page 1)", () => {
    const state = layout({ lines: { ana: ["number-4", "number-8"] }, deck: ["number-4", "number-9"] })
    const result = step(state, { type: "hit", playerId: "ana" })
    expect(statusOf(result.state, "ana")).toBe("busted")
    // the card that busted them stays in their line, face up
    expect(lineTitles(result.state, "ana")).toEqual(["number-4", "number-8", "number-4"])
    expect(kinds(result)).toEqual(["draw", "bust"])
    expect(result.state.stats[0]).toEqual({ busts: 1, flip7: 0 })
    expect(viewOf(result.state, null).players[0]).toMatchObject({ status: "busted", score: 0 })
    expect(waiting(result.state)).toBe("bob")
    expect(problems(result.state)).toEqual([])
  })

  it("busts on a duplicate whatever the number is: a 12 on a 12 (there is a single 0, which can never be doubled)", () => {
    const twelve = hit(layout({ lines: { ana: ["number-12"] }, deck: ["number-12"] }), "ana")
    expect(statusOf(twelve, "ana")).toBe("busted")
    const one = hit(layout({ lines: { ana: ["number-1"] }, deck: ["number-2"] }), "ana")
    expect(statusOf(one, "ana")).toBe("active")
  })

  it("skips a busted player from then on", () => {
    let state = layout({ lines: { ana: ["number-4"] }, deck: ["number-4", "number-1", "number-2", "number-3"] })
    state = hit(state, "ana")
    expect(waiting(state)).toBe("bob")
    state = hit(state, "bob")
    state = hit(state, "cleo")
    // cleo was the last: the turn goes back to the first player still in, bob
    expect(waiting(state)).toBe("bob")
    expect(statusOf(state, "ana")).toBe("busted")
  })

  it("lets a player with nothing in front of them hit as many times as they like, one hit per turn", () => {
    let state = layout({
      status: { ana: "stayed", bob: "stayed" },
      lines: { ana: ["number-1"], bob: ["number-2"] },
      stack: [{ kind: "turn", player: "cleo" }],
      deck: ["number-5", "number-6", "number-7"],
    })
    expect(waiting(state)).toBe("cleo")
    state = hit(state, "cleo")
    expect(waiting(state)).toBe("cleo")
    state = hit(state, "cleo")
    expect(lineTitles(state, "cleo")).toEqual(["number-5", "number-6"])
  })
})

describe("staying", () => {
  it("banks the line and takes the player out of the round, without a card drawn", () => {
    const state = layout({ lines: { ana: ["number-9", "plus-2"] }, deck: ["number-4"] })
    const result = step(state, { type: "stay", playerId: "ana" })
    expect(statusOf(result.state, "ana")).toBe("stayed")
    expect(deckTitles(result.state)[0]).toBe("number-4")
    expect(kinds(result)).toEqual(["stay"])
    expect(result.events[0]!.event).toEqual({ kind: "stay", by: "ana", points: 11 })
    expect(waiting(result.state)).toBe("bob")
    expect(viewOf(result.state, null).players[0]).toMatchObject({ status: "stayed", score: 11 })
  })

  it("leaves the player out for the rest of the round: their turn never comes back", () => {
    let state = layout({ lines: { ana: ["number-9"], bob: ["number-2"] }, deck: ["number-1", "number-3", "number-4"] })
    state = stay(state, "ana")
    state = hit(state, "bob")
    state = hit(state, "cleo")
    expect(waiting(state)).toBe("bob")
    state = hit(state, "bob")
    expect(waiting(state)).toBe("cleo")
  })

  it("is possible with a Modifier card and no Number card, which still scores those points (page 8)", () => {
    const state = stay(layout({ lines: { ana: ["plus-6"] } }), "ana")
    expect(viewOf(state, null).players[0]!.score).toBe(6)
  })

  it("is possible with the x2 alone, which scores nothing", () => {
    const state = stay(layout({ lines: { ana: ["times-2"] } }), "ana")
    expect(viewOf(state, null).players[0]).toMatchObject({ status: "stayed", score: 0 })
  })

  it("needs a card in front of the player: with none they must hit (page 4)", () => {
    const state = layout({ deck: ["number-1"] })
    expect(refusal(() => stay(state, "ana"))).toBe("CANNOT_STAY")
    expect(viewOf(state, "ana").phase).toEqual({ kind: "turn", player: "ana", canStay: false })
    expect(lineTitles(hit(state, "ana"), "ana")).toEqual(["number-1"])
  })
})

describe("the end of a round by hits and stays", () => {
  it("comes when no player is active any more: all of them busted or stayed (page 9)", () => {
    let state = layout({ lines: { ana: ["number-5"], bob: ["number-6"], cleo: ["number-7"] }, deck: ["number-6"] })
    state = stay(state, "ana")
    state = hit(state, "bob")
    expect(statusOf(state, "bob")).toBe("busted")
    const result = step(state, { type: "stay", playerId: "cleo" })
    expect(kinds(result)).toEqual(["stay", "end"])
    expect(result.state.rounds).toEqual([[5, 0, 7]])
    expect(result.state.stack).toEqual([])
    // the deck is handed to the left of cleo, who dealt: ana deals next
    expect(result.state.dealer).toBe(0)
    expect(waiting(result.state)).toBe("ana")
    expect(problems(result.state)).toEqual([])
  })

  it("keeps the cards in front of the players until the next deal, for the board to show", () => {
    const state = stay(stay(stay(layout({ lines: { ana: ["number-5"], bob: ["number-6"], cleo: ["number-7"] } }), "ana"), "bob"), "cleo")
    expect(lineTitles(state, "ana")).toEqual(["number-5"])
    expect(discardTitles(state)).toEqual([])
    // every player is out: a round that is over has no active player
    expect(state.status).toEqual(["stayed", "stayed", "stayed"])
  })

  it("ends a round in which everybody busts, with nothing for anybody", () => {
    let state = layout({ lines: { ana: ["number-5"], bob: ["number-6"], cleo: ["number-7"] }, deck: ["number-5", "number-6", "number-7"] })
    state = hit(hit(hit(state, "ana"), "bob"), "cleo")
    expect(state.rounds).toEqual([[0, 0, 0]])
    expect(state.status).toEqual(["busted", "busted", "busted"])
  })
})

describe("what an action must be", () => {
  const state = layout({ lines: { ana: ["number-5"] }, deck: ["number-1", "number-2"] })

  it("the move of the player the game waits for", () => {
    expect(refusal(() => hit(state, "bob"))).toBe("NOT_YOUR_TURN")
    expect(refusal(() => stay(state, "stranger"))).toBe("NOT_YOUR_TURN")
  })

  it("of a type that the step allows", () => {
    expect(refusal(() => step(state, { type: "target", playerId: "ana", target: "bob" }))).toBe("INVALID_ACTION")
    expect(refusal(() => step(state, { type: "deal", playerId: "ana" }))).toBe("INVALID_ACTION")
  })

  it.each<[string, unknown]>([
    ["nothing", undefined],
    ["null", null],
    ["a text", "hit"],
    ["an object with no type", { playerId: "ana" }],
    ["an object with no player", { type: "hit" }],
    ["a type that does not exist", { type: "fold", playerId: "ana" }],
    ["a type of the wrong kind", { type: 7, playerId: "ana" }],
    ["a player that is not a text", { type: "hit", playerId: 3 }],
    ["a name every object has", { type: "toString", playerId: "ana" }],
  ])("is refused as INVALID_ACTION when it is %s", (_name, junk) => {
    expect(refusal(() => step(state, junk as never))).toBe("INVALID_ACTION")
  })

  it("is never applied to the state it came from", () => {
    const frozen = deepFreeze(structuredClone(state))
    const moved = step(frozen, { type: "hit", playerId: "ana" }).state
    expect(lineTitles(moved, "ana")).toEqual(["number-5", "number-1"])
    expect(lineTitles(frozen, "ana")).toEqual(["number-5"])
  })

  it("leaves the state as it was when it is refused", () => {
    const before = structuredClone(state)
    expect(() => step(state, { type: "stay", playerId: "bob" })).toThrow()
    expect(state).toEqual(before)
  })

  it("is not the same as a deal: a round in progress is not dealt again", () => {
    const dealt = deal(layout({ stack: [], dealer: "cleo" }), "cleo")
    expect(refusal(() => deal(dealt, "cleo"))).toBe("NOT_YOUR_TURN")
  })
})
