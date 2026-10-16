import { describe, expect, it } from "vitest"
import { step } from "./actions"
import { deal, deckTitles, decisionOf, give, kinds, layout, lineTitles, problems, refusal, statusOf, viewOf, waiting } from "./test-utils"

// "How to play" (booklet page 4): the Dealer deals one card face up to each player including themself. If an Action card comes up,
// dealing pauses to resolve it. Once any Action cards are resolved, dealing goes on until everyone has been dealt a card.
// Not everyone will have a Number card at this point: some have none, others three or four cards, depending on the Action cards dealt.

/** A table between two rounds, the dealer ready to deal `deck`. */
const table = (deck: Parameters<typeof layout>[0] extends infer L ? (L extends { deck?: infer D } ? D : never) : never, dealer = "cleo", players: number | string[] = 3) =>
  layout({ players, dealer, stack: [], deck })

describe("the opening deal", () => {
  it("deals one card to each player, the player on the left of the dealer first and the dealer last", () => {
    const state = deal(table(["number-5", "number-7", "number-9", "number-3"]), "cleo")
    expect(lineTitles(state, "ana")).toEqual(["number-5"])
    expect(lineTitles(state, "bob")).toEqual(["number-7"])
    expect(lineTitles(state, "cleo")).toEqual(["number-9"])
    expect(deckTitles(state)[0]).toBe("number-3")
    expect(problems(state)).toEqual([])
  })

  it("starts from the dealer's left, whoever it is", () => {
    const second = deal(table(["number-5", "number-7", "number-9", "number-3"], "ana"), "ana")
    expect([lineTitles(second, "bob"), lineTitles(second, "cleo"), lineTitles(second, "ana")]).toEqual([["number-5"], ["number-7"], ["number-9"]])
    const four = deal(table(["number-1", "number-2", "number-3", "number-4", "number-6"], "bob", 4), "bob")
    expect([lineTitles(four, "cleo"), lineTitles(four, "dan"), lineTitles(four, "ana"), lineTitles(four, "bob")]).toEqual([["number-1"], ["number-2"], ["number-3"], ["number-4"]])
  })

  it("opens the first turn with the player on the left of the dealer", () => {
    expect(waiting(deal(table(["number-5", "number-7", "number-9"]), "cleo"))).toBe("ana")
    expect(waiting(deal(table(["number-5", "number-7", "number-9"], "ana"), "ana"))).toBe("bob")
    expect(waiting(deal(table(["number-5", "number-7", "number-9"], "bob"), "bob"))).toBe("cleo")
  })

  it("says what happened: a round, then a card turned over in front of each player", () => {
    const result = step(table(["number-5", "number-7", "number-9"]), { type: "deal", playerId: "cleo" })
    expect(kinds(result)).toEqual(["round", "draw", "draw", "draw"])
    expect(result.events[0]!.event).toEqual({ kind: "round", number: 1, dealer: "cleo" })
    expect(result.events.slice(1).map(({ event }) => (event.kind === "draw" ? [event.by, event.how, event.card.type] : null))).toEqual([
      ["ana", "deal", "number-5"],
      ["bob", "deal", "number-7"],
      ["cleo", "deal", "number-9"],
    ])
  })

  it("lets a number or a modifier join the line like any card", () => {
    const state = deal(table(["plus-4", "times-2", "number-9", "number-1"]), "cleo")
    expect(lineTitles(state, "ana")).toEqual(["plus-4"])
    expect(lineTitles(state, "bob")).toEqual(["times-2"])
    expect(statusOf(state, "ana")).toBe("active")
  })

  it("keeps a Second Chance for the player it is dealt to: nothing to decide", () => {
    const state = deal(table(["second-chance", "number-7", "number-9"]), "cleo")
    expect(lineTitles(state, "ana")).toEqual(["second-chance"])
    expect(waiting(state)).toBe("ana")
    expect(viewOf(state, "ana").phase).toEqual({ kind: "turn", player: "ana", canStay: true })
  })

  it("leaves nobody out of the round: everybody is active after a deal of plain cards", () => {
    const state = deal(table(["number-5", "number-7", "number-9"]), "cleo")
    expect(state.status).toEqual(["active", "active", "active"])
  })

  it("is only the dealer's to do, and only between two rounds", () => {
    const between = table(["number-5", "number-7", "number-9"])
    expect(refusal(() => deal(between, "ana"))).toBe("NOT_YOUR_TURN")
    expect(refusal(() => deal(between, "stranger"))).toBe("NOT_YOUR_TURN")
    const round = deal(between, "cleo")
    expect(refusal(() => deal(round, "cleo"))).toBe("NOT_YOUR_TURN")
    expect(refusal(() => deal(round, "ana"))).toBe("INVALID_ACTION")
  })
})

describe("an action card in the deal", () => {
  it("pauses the deal on a Freeze, which the player it was dealt to gives to whoever they want, even somebody not dealt yet", () => {
    const paused = deal(table(["number-5", "freeze", "number-9", "number-2"]), "cleo")
    // ana has her card, bob holds the Freeze, cleo was not dealt yet
    expect(lineTitles(paused, "ana")).toEqual(["number-5"])
    expect(lineTitles(paused, "cleo")).toEqual([])
    expect(waiting(paused)).toBe("bob")
    const view = viewOf(paused, "bob")
    expect(view.phase).toMatchObject({ kind: "target", player: "bob", targets: ["ana", "bob", "cleo"] })
    expect(view.phase.kind === "target" && view.phase.card.type).toBe("freeze")
    expect(problems(paused)).toEqual([])

    const done = give(paused, "bob", "cleo")
    // cleo is frozen with the Freeze in front of her and gets no card; the deal is over
    expect(statusOf(done, "cleo")).toBe("frozen")
    expect(lineTitles(done, "cleo")).toEqual(["freeze"])
    expect(deckTitles(done)[0]).toBe("number-9")
    expect(waiting(done)).toBe("ana")
    expect(problems(done)).toEqual([])
  })

  it("lets a player freeze themselves with the Freeze they were dealt", () => {
    const done = give(deal(table(["number-5", "freeze", "number-9", "number-2"]), "cleo"), "bob", "bob")
    expect(statusOf(done, "bob")).toBe("frozen")
    expect(lineTitles(done, "cleo")).toEqual(["number-9"])
    expect(waiting(done)).toBe("ana")
  })

  it("passes over the player who got a Freeze when the dealer is dealt a card last", () => {
    const done = give(deal(table(["number-5", "number-7", "freeze"]), "cleo"), "cleo", "ana")
    expect(statusOf(done, "ana")).toBe("frozen")
    // the first turn skips the frozen player
    expect(waiting(done)).toBe("bob")
  })

  it("pauses the deal on a Flip Three, whose target flips three cards at once", () => {
    const paused = deal(table(["flip-three", "number-1", "number-2", "number-3", "number-4", "number-6"]), "cleo")
    expect(waiting(paused)).toBe("ana")
    expect(lineTitles(paused, "ana")).toEqual([])
    const done = give(paused, "ana", "ana")
    expect(lineTitles(done, "ana")).toEqual(["flip-three", "number-1", "number-2", "number-3"])
    // the deal goes on where it stopped
    expect(lineTitles(done, "bob")).toEqual(["number-4"])
    expect(lineTitles(done, "cleo")).toEqual(["number-6"])
    expect(waiting(done)).toBe("ana")
    expect(problems(done)).toEqual([])
  })

  it("still deals a card to the player a Flip Three was given to, when their turn to be dealt comes", () => {
    const done = give(deal(table(["flip-three", "number-1", "number-2", "number-3", "number-4", "number-6"]), "cleo"), "ana", "bob")
    expect(lineTitles(done, "ana")).toEqual([])
    expect(lineTitles(done, "bob")).toEqual(["flip-three", "number-1", "number-2", "number-3", "number-4"])
    expect(lineTitles(done, "cleo")).toEqual(["number-6"])
  })

  it("holds a Freeze flipped by a Flip Three of the deal until the three cards are done, then deals on", () => {
    const paused = give(deal(table(["flip-three", "freeze", "number-1", "number-2", "number-3", "number-4"]), "cleo"), "ana", "bob")
    // bob flipped a Freeze, a 1 and a 2; the Freeze is his to play before the deal goes on
    expect(waiting(paused)).toBe("bob")
    expect(decisionOf(paused)).toMatchObject({ player: "bob", card: { type: "freeze" }, targets: ["ana", "bob", "cleo"] })
    expect(problems(paused)).toEqual([])
    const done = give(paused, "bob", "cleo")
    // cleo, not dealt yet, is frozen and gets no card; bob, who flipped, is dealt his own card
    expect(statusOf(done, "cleo")).toBe("frozen")
    expect(lineTitles(done, "bob")).toEqual(["flip-three", "number-1", "number-2", "number-3"])
    expect(lineTitles(done, "ana")).toEqual([])
    expect(waiting(done)).toBe("ana")
    expect(problems(done)).toEqual([])
  })

  it("busts a player whose Flip Three flips a duplicate, and carries on with the deal", () => {
    const done = give(deal(table(["flip-three", "number-5", "number-5", "number-8", "number-1", "number-2"]), "cleo"), "ana", "ana")
    expect(statusOf(done, "ana")).toBe("busted")
    // the third card of the Flip Three is not flipped: the next player is dealt it
    expect(lineTitles(done, "ana")).toEqual(["flip-three", "number-5", "number-5"])
    expect(lineTitles(done, "bob")).toEqual(["number-8"])
    expect(lineTitles(done, "cleo")).toEqual(["number-1"])
    expect(deckTitles(done)[0]).toBe("number-2")
    // the busted player is passed over
    expect(waiting(done)).toBe("bob")
    expect(problems(done)).toEqual([])
  })

  it("leaves a player with nothing when they give their action card away: they must hit", () => {
    const done = give(deal(table(["freeze", "number-5", "number-7", "number-9"]), "cleo"), "ana", "bob")
    expect(lineTitles(done, "ana")).toEqual([])
    expect(lineTitles(done, "cleo")).toEqual(["number-5"])
    expect(waiting(done)).toBe("ana")
    expect(viewOf(done, "ana").phase).toEqual({ kind: "turn", player: "ana", canStay: false })
  })

  it("ends the round at once when everybody is frozen in the deal", () => {
    const paused = deal(table(["freeze", "freeze", "freeze"]), "cleo")
    const second = give(paused, "ana", "ana")
    expect(waiting(second)).toBe("bob")
    // the last player is the only one left in: the Freeze goes to them, no choice to make
    const done = give(second, "bob", "bob")
    expect(done.status).toEqual(["frozen", "frozen", "frozen"])
    expect(done.rounds).toEqual([[0, 0, 0]])
    expect(done.stack).toEqual([])
    // the deck passes to the left: ana deals next
    expect(waiting(done)).toBe("ana")
    expect(problems(done)).toEqual([])
  })

  it("refuses a target that cannot get the card, and a card that is not the holder's to give", () => {
    const paused = deal(table(["number-5", "freeze", "number-9"]), "cleo")
    expect(refusal(() => give(paused, "bob", "stranger"))).toBe("INVALID_TARGET")
    expect(refusal(() => step(paused, { type: "target", playerId: "bob" } as never))).toBe("INVALID_TARGET")
    expect(refusal(() => give(paused, "ana", "bob"))).toBe("NOT_YOUR_TURN")
    expect(refusal(() => step(paused, { type: "hit", playerId: "bob" }))).toBe("INVALID_ACTION")
    expect(refusal(() => step(paused, { type: "stay", playerId: "bob" }))).toBe("INVALID_ACTION")
  })
})
