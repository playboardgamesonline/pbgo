import { describe, expect, it } from "vitest"
import { step } from "./actions"
import { deal, deckTitles, decisionOf, discardTitles, give, hit, kinds, layout, lineTitles, problems, refusal, statusOf, stay, viewOf, waiting } from "./test-utils"

// "The Action cards" (booklet pages 6 and 7). Action cards can be played on any active player, including yourself; if you are the only
// active player you must play it on yourself. An active player is one who has neither busted nor stayed.
//
// The tests read like the booklet: ana, bob and cleo sit in that order, cleo deals, so ana plays first.

describe("Freeze", () => {
  it("banks all the points of the player it is played on, and takes them out of the round", () => {
    const drawn = hit(layout({ lines: { bob: ["number-4", "number-6"] }, deck: ["freeze", "number-9"] }), "ana")
    // ana holds the Freeze: she picks who gets it, any active player
    expect(waiting(drawn)).toBe("ana")
    expect(viewOf(drawn, "ana").phase).toMatchObject({ kind: "target", player: "ana", targets: ["ana", "bob", "cleo"] })
    expect(problems(drawn)).toEqual([])

    const result = step(drawn, { type: "target", playerId: "ana", target: "bob" })
    expect(statusOf(result.state, "bob")).toBe("frozen")
    expect(lineTitles(result.state, "bob")).toEqual(["number-4", "number-6", "freeze"])
    expect(viewOf(result.state, null).players[1]).toMatchObject({ status: "frozen", score: 10 })
    expect(kinds(result)).toEqual(["play"])
    expect(result.events[0]!.event).toMatchObject({ kind: "play", by: "ana", target: "bob", card: { type: "freeze" } })
    // ana's hit is over; the frozen player is passed over
    expect(waiting(result.state)).toBe("cleo")
    expect(problems(result.state)).toEqual([])
  })

  it("can be played on yourself, which banks your own points", () => {
    const state = give(hit(layout({ lines: { ana: ["number-9"] }, deck: ["freeze"] }), "ana"), "ana", "ana")
    expect(statusOf(state, "ana")).toBe("frozen")
    expect(viewOf(state, null).players[0]!.score).toBe(9)
    expect(waiting(state)).toBe("bob")
  })

  it("must be played on yourself when you are the only active player", () => {
    const before = layout({
      lines: { ana: ["number-3"], bob: ["number-5"], cleo: ["number-6", "number-6"] },
      status: { bob: "stayed", cleo: "busted" },
      deck: ["freeze"],
    })
    const result = step(before, { type: "hit", playerId: "ana" })
    // no choice to make: the Freeze is on her, and nobody is left in the round
    expect(kinds(result)).toEqual(["draw", "play", "end"])
    expect(statusOf(result.state, "ana")).toBe("frozen")
    expect(result.state.rounds).toEqual([[3, 5, 0]])
    expect(problems(result.state)).toEqual([])
  })

  it("is only for active players: not for somebody who stayed, busted or was frozen", () => {
    const drawn = hit(
      layout({
        lines: { ana: ["number-1"], bob: ["number-2"], cleo: ["number-3"] },
        status: { bob: "stayed" },
        stack: [{ kind: "turn", player: "ana" }],
        deck: ["freeze"],
      }),
      "ana",
    )
    expect(viewOf(drawn, "ana").phase).toMatchObject({ kind: "target", targets: ["ana", "cleo"] })
    expect(refusal(() => give(drawn, "ana", "bob"))).toBe("INVALID_TARGET")
    expect(refusal(() => give(drawn, "ana", "nobody"))).toBe("INVALID_TARGET")
    expect(refusal(() => step(drawn, { type: "target", playerId: "ana", target: 3 } as never))).toBe("INVALID_TARGET")
    expect(statusOf(give(drawn, "ana", "cleo"), "cleo")).toBe("frozen")
  })

  it("is the holder's to give, nobody else's", () => {
    const drawn = hit(layout({ deck: ["freeze"] }), "ana")
    expect(refusal(() => give(drawn, "bob", "cleo"))).toBe("NOT_YOUR_TURN")
    expect(refusal(() => hit(drawn, "ana"))).toBe("INVALID_ACTION")
    expect(refusal(() => stay(drawn, "ana"))).toBe("INVALID_ACTION")
  })
})

describe("Flip Three", () => {
  it("makes the player it is played on flip the next three cards, one at a time, into their line", () => {
    const drawn = hit(layout({ deck: ["flip-three", "number-1", "number-2", "number-3", "number-9"] }), "ana")
    const result = step(drawn, { type: "target", playerId: "ana", target: "bob" })
    expect(lineTitles(result.state, "bob")).toEqual(["flip-three", "number-1", "number-2", "number-3"])
    expect(kinds(result)).toEqual(["play", "draw", "draw", "draw"])
    expect(result.events.slice(1).map(({ event }) => (event.kind === "draw" ? [event.by, event.how] : null))).toEqual([
      ["bob", "flip"],
      ["bob", "flip"],
      ["bob", "flip"],
    ])
    // the fourth card stays on the pile; ana's hit is over and bob, who is active, plays next
    expect(deckTitles(result.state)[0]).toBe("number-9")
    expect(waiting(result.state)).toBe("bob")
    expect(problems(result.state)).toEqual([])
  })

  it("can be played on yourself, and is then forced when you are the only active player", () => {
    const own = give(hit(layout({ deck: ["flip-three", "number-1", "number-2", "number-3"] }), "ana"), "ana", "ana")
    expect(lineTitles(own, "ana")).toEqual(["flip-three", "number-1", "number-2", "number-3"])

    const alone = hit(
      layout({
        lines: { ana: ["number-1"], bob: ["number-5"], cleo: ["number-6"] },
        status: { bob: "stayed", cleo: "stayed" },
        deck: ["flip-three", "number-2", "number-3", "number-4"],
      }),
      "ana",
    )
    expect(lineTitles(alone, "ana")).toEqual(["number-1", "flip-three", "number-2", "number-3", "number-4"])
    // the only player left in hits again
    expect(waiting(alone)).toBe("ana")
  })

  it("stops at once when the player busts, and leaves the other cards on the pile", () => {
    const state = give(hit(layout({ lines: { bob: ["number-5"] }, deck: ["flip-three", "number-5", "number-1", "number-2"] }), "ana"), "ana", "bob")
    expect(statusOf(state, "bob")).toBe("busted")
    expect(lineTitles(state, "bob")).toEqual(["number-5", "flip-three", "number-5"])
    expect(deckTitles(state).slice(0, 2)).toEqual(["number-1", "number-2"])
    expect(state.stats[1]).toEqual({ busts: 1, flip7: 0 })
    // the busted player is passed over
    expect(waiting(state)).toBe("cleo")
    expect(problems(state)).toEqual([])
  })

  it("stops at once when the player makes a Flip 7, which ends the round for everybody (pages 6 and 9)", () => {
    const before = layout({
      lines: { ana: ["number-2"], bob: ["number-1", "number-2", "number-3", "number-4", "number-5", "number-6"], cleo: ["number-3"] },
      deck: ["flip-three", "number-7", "number-8", "number-9"],
    })
    const result = step(hit(before, "ana"), { type: "target", playerId: "ana", target: "bob" })
    expect(kinds(result)).toEqual(["play", "draw", "flip7", "end"])
    // the seventh number ends the round: the other two cards are not flipped
    expect(deckTitles(result.state)[0]).toBe("number-8")
    // 1 + … + 7 = 28 and 15 more; the others bank what they hold
    expect(result.state.rounds).toEqual([[2, 43, 3]])
    expect(result.state.status).toEqual(["stayed", "stayed", "stayed"])
    expect(result.state.stats[1]).toEqual({ busts: 0, flip7: 1 })
    expect(result.state.stack).toEqual([])
    expect(problems(result.state)).toEqual([])
  })

  it("counts every kind of card toward the three: numbers, modifiers and action cards (page 6)", () => {
    const state = give(hit(layout({ deck: ["flip-three", "plus-2", "second-chance", "number-3", "number-9"] }), "ana"), "ana", "bob")
    expect(lineTitles(state, "bob")).toEqual(["flip-three", "plus-2", "second-chance", "number-3"])
    expect(deckTitles(state)[0]).toBe("number-9")
  })

  it("keeps a Freeze flipped on the way until the three cards are done, then lets its holder play it (page 6)", () => {
    const flipped = give(
      hit(layout({ lines: { cleo: ["number-8"] }, deck: ["flip-three", "freeze", "number-3", "number-4", "number-9"] }), "ana"),
      "ana",
      "bob",
    )
    // bob flipped the three cards; the Freeze waits in his hands, face up, and he must play it before anything else happens
    expect(lineTitles(flipped, "bob")).toEqual(["flip-three", "number-3", "number-4"])
    expect(waiting(flipped)).toBe("bob")
    const view = viewOf(flipped, "ana")
    // the card he is deciding on is the one of the phase; `held` lists the ones that wait behind it
    expect(view.players[1]!.held).toEqual([])
    expect(view.phase).toMatchObject({ kind: "target", player: "bob", targets: ["ana", "bob", "cleo"] })
    expect(view.phase.kind === "target" && view.phase.card.type).toBe("freeze")
    expect(problems(flipped)).toEqual([])

    const frozen = give(flipped, "bob", "cleo")
    expect(statusOf(frozen, "cleo")).toBe("frozen")
    expect(viewOf(frozen, null).players[2]).toMatchObject({ status: "frozen", score: 8 })
    expect(viewOf(frozen, null).players[1]!.held).toEqual([])
    // ana's hit is over, bob is active: his turn
    expect(waiting(frozen)).toBe("bob")
    expect(problems(frozen)).toEqual([])
  })

  it("does not play a Freeze or a Flip Three flipped on the way when the player busts, and they stay in front of the player", () => {
    const state = give(hit(layout({ lines: { bob: ["number-3"] }, deck: ["flip-three", "freeze", "number-3", "number-9", "number-5"] }), "ana"), "ana", "bob")
    expect(statusOf(state, "bob")).toBe("busted")
    expect(lineTitles(state, "bob")).toEqual(["number-3", "flip-three", "number-3", "freeze"])
    expect(state.status).toEqual(["active", "busted", "active"])
    // the third card of the Flip Three was never flipped
    expect(deckTitles(state)[0]).toBe("number-9")
    expect(waiting(state)).toBe("cleo")
    expect(problems(state)).toEqual([])
  })

  it("plays a Flip Three flipped on the way after the three cards, on a player its holder chooses", () => {
    const first = give(hit(layout({ deck: ["flip-three", "flip-three", "number-1", "number-2", "number-5", "number-6", "number-7", "number-9"] }), "ana"), "ana", "bob")
    expect(lineTitles(first, "bob")).toEqual(["flip-three", "number-1", "number-2"])
    expect(waiting(first)).toBe("bob")
    const phase = viewOf(first, null).phase
    expect(phase.kind === "target" && phase.card.type).toBe("flip-three")

    const second = give(first, "bob", "cleo")
    expect(lineTitles(second, "cleo")).toEqual(["flip-three", "number-5", "number-6", "number-7"])
    expect(lineTitles(second, "bob")).toEqual(["flip-three", "number-1", "number-2"])
    expect(viewOf(second, null).players[1]!.held).toEqual([])
    expect(deckTitles(second)[0]).toBe("number-9")
    expect(waiting(second)).toBe("bob")
    expect(problems(second)).toEqual([])
  })

  it("plays the cards flipped on the way in the order they came, one decision each", () => {
    const flipped = give(hit(layout({ lines: { cleo: ["number-8"] }, deck: ["flip-three", "freeze", "flip-three", "number-3", "number-5", "number-6", "number-7"] }), "ana"), "ana", "bob")
    // bob flipped a Freeze, a Flip Three and a 3: the Freeze first
    expect(decisionOf(flipped)).toMatchObject({ player: "bob", card: { type: "freeze" } })
    expect(viewOf(flipped, null).players[1]!.held.map((face) => face.type)).toEqual(["flip-three"])

    const afterFreeze = give(flipped, "bob", "cleo")
    expect(statusOf(afterFreeze, "cleo")).toBe("frozen")
    // then the Flip Three: ana and bob are the only active players left to choose from
    expect(viewOf(afterFreeze, null).phase).toMatchObject({ kind: "target", player: "bob", targets: ["ana", "bob"] })
    const afterFlip = give(afterFreeze, "bob", "ana")
    expect(lineTitles(afterFlip, "ana")).toEqual(["flip-three", "number-5", "number-6", "number-7"])
    expect(problems(afterFlip)).toEqual([])
  })

  it("lets a Second Chance flipped on the way be kept and used by a duplicate later in the same Flip Three (page 6)", () => {
    const state = give(hit(layout({ lines: { bob: ["number-5"] }, deck: ["flip-three", "second-chance", "number-5", "number-8", "number-9"] }), "ana"), "ana", "bob")
    // the Second Chance cancels the second 5, and the third card is flipped as usual
    expect(statusOf(state, "bob")).toBe("active")
    expect(lineTitles(state, "bob")).toEqual(["number-5", "flip-three", "number-8"])
    expect(discardTitles(state).slice(0, 2)).toEqual(["second-chance", "number-5"])
    expect(deckTitles(state)[0]).toBe("number-9")
    expect(problems(state)).toEqual([])
  })

  it("gives away a second Second Chance flipped on the way to another active player, right away", () => {
    const flipped = hit(layout({ lines: { bob: ["second-chance", "number-4"] }, deck: ["flip-three", "second-chance", "number-1", "number-2", "number-9"] }), "ana")
    const mid = step(flipped, { type: "target", playerId: "ana", target: "bob" }).state
    // bob already holds one: he must give this one to ana or cleo before the next card is flipped
    expect(waiting(mid)).toBe("bob")
    expect(viewOf(mid, null).phase).toMatchObject({ kind: "target", player: "bob", targets: ["ana", "cleo"] })
    expect(lineTitles(mid, "bob")).toEqual(["second-chance", "number-4", "flip-three"])
    expect(problems(mid)).toEqual([])

    const done = give(mid, "bob", "cleo")
    expect(lineTitles(done, "cleo")).toEqual(["second-chance"])
    expect(lineTitles(done, "bob")).toEqual(["second-chance", "number-4", "flip-three", "number-1", "number-2"])
    expect(deckTitles(done)[0]).toBe("number-9")
    expect(problems(done)).toEqual([])
  })
})

describe("Second Chance", () => {
  it("is kept by the player who draws it", () => {
    const result = step(layout({ deck: ["second-chance", "number-4"] }), { type: "hit", playerId: "ana" })
    expect(lineTitles(result.state, "ana")).toEqual(["second-chance"])
    expect(kinds(result)).toEqual(["draw", "play"])
    expect(result.events[1]!.event).toMatchObject({ kind: "play", by: "ana", target: "ana", card: { type: "second-chance" } })
    expect(waiting(result.state)).toBe("bob")
  })

  it("cancels a duplicate: the Second Chance and the duplicate are both discarded, and the player is still in (page 7)", () => {
    const result = step(layout({ lines: { ana: ["number-5", "second-chance"] }, deck: ["number-5", "number-9"] }), { type: "hit", playerId: "ana" })
    expect(statusOf(result.state, "ana")).toBe("active")
    expect(lineTitles(result.state, "ana")).toEqual(["number-5"])
    expect(discardTitles(result.state).slice(0, 2)).toEqual(["second-chance", "number-5"])
    expect(kinds(result)).toEqual(["draw", "saved"])
    expect(result.state.stats[0]).toEqual({ busts: 0, flip7: 0 })
    expect(problems(result.state)).toEqual([])
  })

  it("is spent by one duplicate only: the next one busts", () => {
    let state = layout({ lines: { ana: ["number-5", "second-chance"] }, deck: ["number-5", "number-1", "number-2", "number-5"] })
    state = hit(state, "ana")
    expect(statusOf(state, "ana")).toBe("active")
    state = hit(hit(state, "bob"), "cleo")
    state = hit(state, "ana")
    expect(statusOf(state, "ana")).toBe("busted")
  })

  it("does not save a player from a card that is not a duplicate", () => {
    const state = hit(layout({ lines: { ana: ["number-5", "second-chance"] }, deck: ["number-6"] }), "ana")
    expect(lineTitles(state, "ana")).toEqual(["number-5", "second-chance", "number-6"])
  })

  it("is held by a player once: a second one is given to another active player of their choice (page 7)", () => {
    const drawn = hit(layout({ lines: { ana: ["second-chance"] }, deck: ["second-chance", "number-4"] }), "ana")
    expect(waiting(drawn)).toBe("ana")
    expect(viewOf(drawn, null).phase).toMatchObject({ kind: "target", player: "ana", targets: ["bob", "cleo"] })
    expect(problems(drawn)).toEqual([])

    const given = give(drawn, "ana", "bob")
    expect(lineTitles(given, "bob")).toEqual(["second-chance"])
    expect(lineTitles(given, "ana")).toEqual(["second-chance"])
    expect(waiting(given)).toBe("bob")
  })

  it("cannot be given to oneself, nor to somebody who holds one, nor to somebody out of the round", () => {
    const drawn = hit(layout({ lines: { ana: ["second-chance"], bob: ["number-1"], cleo: ["second-chance"] }, status: { bob: "stayed" }, deck: ["second-chance"] }), "ana")
    // bob stayed, cleo holds one, ana is the holder: nobody can get it, so it is discarded, and the turn goes to cleo (bob is out)
    expect(waiting(drawn)).toBe("cleo")
    expect(discardTitles(drawn)).toEqual(["second-chance"])

    const open = hit(layout({ lines: { ana: ["second-chance"], cleo: ["second-chance"] }, stack: [{ kind: "turn", player: "ana" }], deck: ["second-chance"] }), "ana")
    // only bob can get it: no choice to make
    expect(lineTitles(open, "bob")).toEqual(["second-chance"])

    const choice = hit(layout({ lines: { ana: ["second-chance"] }, deck: ["second-chance"] }), "ana")
    expect(refusal(() => give(choice, "ana", "ana"))).toBe("INVALID_TARGET")
    const taken = give(choice, "ana", "bob")
    expect(taken.lines[1]).toHaveLength(1)
  })

  it("is given to another player: the holder is never among the targets, even in a state where they hold none (page 7)", () => {
    // a state a real game cannot reach (the holder gives a second one away because they hold one): the rule still says "another active player"
    const state = layout({
      lines: { cleo: ["second-chance"] },
      stack: [
        { kind: "turn", player: "ana" },
        { kind: "target", player: "ana", card: "second-chance" },
      ],
    })
    expect(decisionOf(state).targets).toEqual(["bob"])
    const open = layout({
      stack: [
        { kind: "turn", player: "ana" },
        { kind: "target", player: "ana", card: "second-chance" },
      ],
    })
    expect(decisionOf(open).targets).toEqual(["bob", "cleo"])
  })

  it("is given at once when only one player can get it, with no choice to make", () => {
    const result = step(layout({ lines: { ana: ["second-chance"], cleo: ["second-chance"] }, deck: ["second-chance"] }), { type: "hit", playerId: "ana" })
    expect(kinds(result)).toEqual(["draw", "play"])
    expect(lineTitles(result.state, "bob")).toEqual(["second-chance"])
    expect(waiting(result.state)).toBe("bob")
  })

  it("is discarded when nobody can get it: no other active player, or all of them hold one already (page 7)", () => {
    const alone = step(layout({ lines: { ana: ["second-chance"], bob: ["number-1"], cleo: ["number-2", "number-2"] }, status: { bob: "stayed", cleo: "busted" }, deck: ["second-chance"] }), {
      type: "hit",
      playerId: "ana",
    })
    expect(kinds(alone)).toEqual(["draw", "discarded"])
    expect(discardTitles(alone.state)).toEqual(["second-chance"])
    expect(lineTitles(alone.state, "ana")).toEqual(["second-chance"])
    // ana is still in, with her own turn to come
    expect(waiting(alone.state)).toBe("ana")

    const holding = step(layout({ lines: { ana: ["second-chance"], bob: ["second-chance"], cleo: ["number-3"] }, status: { cleo: "stayed" }, deck: ["second-chance"] }), { type: "hit", playerId: "ana" })
    // bob holds one already and cleo is out: nobody can get it
    expect(kinds(holding)).toEqual(["draw", "discarded"])
    expect(discardTitles(holding.state)).toEqual(["second-chance"])
  })

  it("is discarded with everything else at the end of a round, even if it was never used (page 7)", () => {
    let state = layout({ lines: { ana: ["number-5", "second-chance"], bob: ["number-6"], cleo: ["number-7"] }, deck: ["number-1", "number-2"] })
    state = stay(stay(stay(state, "ana"), "bob"), "cleo")
    // the round is over: the cards are still in front of the players, for the board to show
    expect(lineTitles(state, "ana")).toEqual(["number-5", "second-chance"])
    expect(discardTitles(state)).toEqual([])
    // the next deal sweeps them up (ana deals: the dealer moved to her)
    const next = deal(state, "ana")
    expect(discardTitles(next)).toContain("second-chance")
    expect(next.lines.flat().every((id) => !next.discard.includes(id))).toBe(true)
    expect(problems(next)).toEqual([])
  })
})
