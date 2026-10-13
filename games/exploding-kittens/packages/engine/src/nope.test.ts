import { describe, expect, it } from "vitest"
import { resolveWindow as exported } from "./index"
import { waitingFor } from "./machine"
import { ORIGINAL_RULES } from "./rules"
import {
  CATS,
  type Layout,
  type Move,
  combo,
  comboThrough,
  deepFreeze,
  defuse,
  discardIdOf,
  discardTitles,
  draw,
  expectIntegrity,
  expectRefused,
  expectSerializable,
  give,
  handTitles,
  idOf,
  kinds,
  nope,
  pass,
  pick,
  play,
  playThrough,
  rig,
  run,
  seatOf,
  trace,
  tracePassAll,
} from "./test-utils"
import type { State } from "./types"
import { resolveWindow } from "./window"

/**
 * The Nope window: who may answer it, how a chain of Nopes decides, what the engine refuses, what never opens one, and
 * `resolveWindow`, which a timer will call. Most of it happens at the same table: four players, with the five Nopes of the box in
 * their hands (bob holds two) and ana, who has the turn, holding a Skip.
 */

const layout: Layout = {
  hands: {
    ana: ["skip", "nope", "tacocat"],
    bob: ["nope", "nope", "beard-cat"],
    cleo: ["nope", "favor"],
    dan: ["nope", "shuffle"],
  },
  deck: CATS,
  turn: "ana",
}
const table = rig(4, layout)
const SKIP = idOf(table, "ana", "skip")

/** ana plays her Skip: a window is open on it. */
const { state: skipped, events: played } = trace(table, play("ana", "skip"))

/** Who Nopes, one after the other, when a test asks for a chain: bob twice, and ana last, who Nopes the Nope on her own card. */
const NOPERS = ["bob", "cleo", "bob", "dan", "ana"]

function nopesIn(state: State, playerId: string): number {
  return handTitles(state, playerId).filter((title) => title === "nope").length
}

describe("the window of a card", () => {
  it("opens on the card, which is on the discard already, and waits for everybody but its author", () => {
    expect(played).toEqual([{ event: { kind: "play", by: "ana", card: { id: SKIP, type: "skip" } } }])
    expect(skipped.phase).toEqual({
      kind: "reaction",
      pending: { kind: "card", by: "ana", card: SKIP },
      nopes: [],
      passed: { bob: null, cleo: null, dan: null },
    })
    expect(discardTitles(skipped)).toEqual(["skip"])
    expect(waitingFor(skipped)).toEqual(["bob", "cleo", "dan"])
    expectIntegrity(skipped)
    expectSerializable(skipped)
  })

  it("does nothing yet: the card has not taken effect", () => {
    expect([skipped.turn, skipped.owed]).toEqual([0, 1])
    expect(skipped.stats.map(({ turns }) => turns)).toEqual([0, 0, 0, 0])
  })
})

describe("a chain of Nopes", () => {
  const outcomes: [number, string][] = [
    [0, "goes through"],
    [1, "is cancelled"],
    [2, "goes through"],
    [3, "is cancelled"],
    [4, "goes through"],
    [5, "is cancelled"],
  ]

  it.each(outcomes)("of %i Nopes: the Skip %s", (length, outcome) => {
    const authors = NOPERS.slice(0, length)
    const { state: open, events: answers } = trace(skipped, ...authors.map((id) => nope(id)))
    expect(kinds(answers)).toEqual(authors.map(() => "nope"))
    expect(open.phase.kind).toBe("reaction")
    expectIntegrity(open)

    const { state: closed, events } = tracePassAll(open)
    if (outcome === "goes through") {
      expect(kinds(events)).toEqual(["resolved", "skip", "turn"])
      expect([closed.turn, closed.owed, closed.stats[0]!.turns]).toEqual([1, 1, 1])
    } else {
      expect(events).toEqual([{ event: { kind: "cancelled", by: "ana" } }])
      expect([closed.turn, closed.owed, closed.stats[0]!.turns]).toEqual([0, 1, 0])
    }
    expect(closed.phase).toEqual({ kind: "turn" })
    // The Skip is spent either way, and every Nope played sits on top of it
    expect(discardTitles(closed)).toEqual([...authors.map(() => "nope"), "skip"])
    expect(handTitles(closed, "ana")).not.toContain("skip")
    for (const id of table.seats) {
      const count = authors.filter((author) => author === id).length
      expect(closed.stats[seatOf(closed, id)]!.nopes).toBe(count)
      expect(nopesIn(closed, id)).toBe(nopesIn(table, id) - count)
    }
    expectIntegrity(closed)
    expectSerializable(closed)
  })

  it("is answered, after each Nope, by everybody but the author of the last one", () => {
    const waiting = [waitingFor(skipped)]
    let state = skipped
    for (const id of NOPERS) {
      state = run(state, nope(id))
      waiting.push(waitingFor(state))
      expectIntegrity(state)
    }
    expect(waiting).toEqual([
      ["bob", "cleo", "dan"], // ana's Skip
      ["ana", "cleo", "dan"], // bob's Nope
      ["ana", "bob", "dan"], // cleo's Nope
      ["ana", "cleo", "dan"], // bob's second Nope
      ["ana", "bob", "cleo"], // dan's Nope
      ["bob", "cleo", "dan"], // ana's Nope
    ])
  })

  it("puts a Nope on the discard above the card it answers, and tells everybody", () => {
    const card = idOf(skipped, "bob", "nope")
    const { state, events } = trace(skipped, nope("bob"))
    expect(state.discard).toEqual([card, SKIP])
    expect(events).toEqual([{ event: { kind: "nope", by: "bob", card: { id: card, type: "nope" } } }])
  })

  it("leaves the player whose card was cancelled their turn: they still draw", () => {
    const { state: closed } = tracePassAll(run(skipped, nope("bob")))
    expect(waitingFor(closed)).toEqual(["ana"])
    expect(run(closed, { type: "draw", playerId: "ana" }).turn).toBe(1)
  })

  it("brings the card back when its author Nopes the Nope", () => {
    const { state: closed, events } = tracePassAll(run(skipped, nope("bob"), nope("ana")))
    expect(kinds(events)).toEqual(["resolved", "skip", "turn"])
    expect(closed.turn).toBe(1)
  })

  describe("cancels what a card does, whichever card it is", () => {
    const holding = rig(4, {
      hands: { ana: ["favor", "shuffle", "attack"], bob: ["nope", "beard-cat"], cleo: ["tacocat"], dan: ["beard-cat"] },
      deck: CATS,
      turn: "ana",
    })
    const cards: [string, string | undefined][] = [
      ["favor", "cleo"],
      ["shuffle", undefined],
      ["attack", undefined],
    ]

    it.each(cards)("a %s", (title, target) => {
      const { state: open } = trace(holding, play("ana", title, target))
      expect(open.phase.kind).toBe("reaction")
      const { state: cancelled, events } = tracePassAll(run(open, nope("bob")))
      expect(events).toEqual([{ event: { kind: "cancelled", by: "ana" } }])
      expect(cancelled.phase).toEqual({ kind: "turn" })
      // The card is spent, and nothing else moved: nobody was asked for a card, the pile was not shuffled, the turn did not pass
      expect([cancelled.turn, cancelled.owed]).toEqual([0, 1])
      expect(cancelled.deck).toEqual(holding.deck)
      expect(cancelled.hands[2]).toEqual(holding.hands[2])
      expect(cancelled.hands[3]).toEqual(holding.hands[3])
      expect(discardTitles(cancelled)).toEqual(["nope", title])
      expectIntegrity(cancelled)
    })
  })
})

describe("who may answer", () => {
  it("is not the author of the card: ana can neither Nope her own Skip nor pass on it", () => {
    expectRefused(skipped, nope("ana"), "NOT_WAITING")
    expectRefused(skipped, pass("ana"), "NOT_WAITING")
  })

  it("is not the author of the last Nope either, until somebody else Nopes", () => {
    const { state: noped } = trace(skipped, nope("bob"))
    expectRefused(noped, nope("bob"), "NOT_WAITING")
    expectRefused(noped, pass("bob"), "NOT_WAITING")
    const { state: again } = trace(noped, nope("cleo"))
    expect(waitingFor(again)).toContain("bob")
    expect(run(again, nope("bob")).phase.kind).toBe("reaction")
  })

  it.each(["zoe", "constructor", "__proto__", "toString"])("is not %s, who is not at the table", (stranger) => {
    expectRefused(skipped, { type: "pass", playerId: stranger, chain: 0 }, "NOT_WAITING")
    expectRefused(skipped, { type: "nope", playerId: stranger, card: SKIP, chain: 0 }, "NOT_WAITING")
  })

  it("lets a player who passed still Nope, as long as the window is open", () => {
    const { state } = trace(skipped, pass("bob"), nope("bob"))
    expect(state.phase).toMatchObject({ kind: "reaction", nopes: [{ by: "bob" }] })
    expect(waitingFor(state)).toEqual(["ana", "cleo", "dan"])
  })

  it("lets the same player Nope again, as long as somebody else's Nope came in between", () => {
    const { state } = trace(skipped, nope("bob"), nope("cleo"), nope("bob"))
    expect(state.stats[1]!.nopes).toBe(2)
    expect(nopesIn(state, "bob")).toBe(0)
  })

  it("never counts a player who is out: the window does not wait for them", () => {
    const out = rig(4, { hands: { ana: ["skip"], bob: ["nope"], dan: ["nope"] }, out: ["cleo"], deck: CATS, turn: "ana" })
    const { state: open } = trace(out, play("ana", "skip"))
    expect(waitingFor(open)).toEqual(["bob", "dan"])
    expectRefused(open, pass("cleo"), "NOT_WAITING")
    expectRefused(open, (on) => ({ type: "nope", playerId: "cleo", card: idOf(on, "bob", "nope"), chain: 0 }), "NOT_WAITING")
    const { state: noped } = trace(open, nope("bob"))
    expect(waitingFor(noped)).toEqual(["ana", "dan"])
    // the last pass is the one of the last living responder
    expect(run(open, pass("bob"), pass("dan")).phase).toEqual({ kind: "turn" })
  })

  describe("in a game of two", () => {
    const duel = rig(2, { hands: { ana: ["skip", "nope"], bob: ["nope"] }, deck: CATS })

    it("gives the last word to the only opponent", () => {
      const { state: open } = trace(duel, play("ana", "skip"), nope("bob"), nope("ana"))
      expect(waitingFor(open)).toEqual(["bob"])
      const { state: closed, events } = trace(open, pass("bob"))
      expect(kinds(events)).toEqual(["resolved", "skip", "turn"])
      expect(closed.turn).toBe(1)
    })

    it("closes when the only opponent passes", () => {
      const { state: closed, events } = trace(duel, play("ana", "skip"), pass("bob"))
      expect(kinds(events)).toEqual(["play", "resolved", "skip", "turn"])
      expect(closed.phase).toEqual({ kind: "turn" })
    })

    it("closes when the author passes on the only Nope: the card is cancelled", () => {
      const { state: closed, events } = trace(duel, play("ana", "skip"), nope("bob"), pass("ana"))
      expect(kinds(events)).toEqual(["play", "nope", "cancelled"])
      expect(closed.turn).toBe(0)
    })
  })
})

describe("a pass", () => {
  it("tells nobody: no event, and the window still waits for the same players", () => {
    const { state, events } = trace(skipped, pass("bob"))
    expect(events).toEqual([])
    expect(waitingFor(state)).toEqual(waitingFor(skipped))
    expect(state).toStrictEqual({ ...skipped, phase: { ...skipped.phase, passed: { bob: true, cleo: null, dan: null } } })
  })

  const orders: [string, string, string][] = [
    ["bob", "cleo", "dan"],
    ["dan", "cleo", "bob"],
    ["cleo", "dan", "bob"],
  ]
  it.each(orders)("closes the window with the last one, whoever it is (%s, %s, %s)", (first, second, last) => {
    const open = run(skipped, pass(first), pass(second))
    expect(open.phase.kind).toBe("reaction")
    expect(waitingFor(open)).toEqual(["bob", "cleo", "dan"])
    const { state: closed, events } = trace(open, pass(last))
    expect(closed.phase).toEqual({ kind: "turn" })
    expect(kinds(events)).toEqual(["resolved", "skip", "turn"])
  })

  it("is wiped out by a Nope: those who passed before it must answer again", () => {
    const { state } = trace(skipped, pass("cleo"), nope("dan"))
    expect(state.phase).toEqual({
      kind: "reaction",
      pending: { kind: "card", by: "ana", card: SKIP },
      nopes: [{ card: expect.any(Number), by: "dan" }],
      passed: { ana: null, bob: null, cleo: null },
    })
    const waiting = run(state, pass("ana"), pass("bob"))
    expect(waiting.phase.kind).toBe("reaction")
    expect(run(waiting, pass("cleo")).phase).toEqual({ kind: "turn" })
  })

  it("is refused a second time", () => {
    expectRefused(run(skipped, pass("bob")), pass("bob"), "ALREADY_PASSED")
  })
})

describe("what a responder may not do", () => {
  const { state: noped } = trace(skipped, nope("bob"))

  it("answer a chain that has moved on (STALE_REACTION)", () => {
    // bob Noped: cleo's pass, sent when the chain was empty, arrives late, and does not count for the window it opened
    expectRefused(noped, { type: "pass", playerId: "cleo", chain: 0 }, "STALE_REACTION")
    expectRefused(noped, (on) => ({ type: "nope", playerId: "cleo", card: idOf(on, "cleo", "nope"), chain: 0 }), "STALE_REACTION")
    // and an answer from the future is no better
    expectRefused(skipped, { type: "pass", playerId: "cleo", chain: 1 }, "STALE_REACTION")
    expect(noped.phase).toMatchObject({ passed: { ana: null, cleo: null, dan: null } })
    // the right chain is accepted
    expect(run(noped, pass("cleo")).phase).toMatchObject({ passed: { ana: null, cleo: true, dan: null } })
  })

  const others: [string, Move][] = [
    ["a draw by the player", draw("ana")],
    ["a card played by the player", play("ana", "tacocat")],
    ["a card played by someone who may answer", play("cleo", "favor", "bob")],
    ["a combo", combo("ana", ["tacocat"])],
    ["a Defuse", defuse("ana", 0)],
    ["a gift", give("bob", "beard-cat")],
    ["a card taken from the discard", pick("ana", "skip")],
  ]
  it.each(others)("do %s, while a window is open (REACTION_OPEN)", (_, move) => {
    expectRefused(skipped, move, "REACTION_OPEN")
  })

  it("play a Nope that is not in their hand (UNKNOWN_CARD)", () => {
    const strays: [string, (on: State) => number][] = [
      ["the Nope of somebody else", (on) => idOf(on, "cleo", "nope")],
      ["a card nobody holds", () => -1],
      ["a card of the discard", (on) => discardIdOf(on, "skip")],
    ]
    for (const [, card] of strays) {
      expectRefused(skipped, (on) => ({ type: "nope", playerId: "bob", card: card(on), chain: 0 }), "UNKNOWN_CARD")
    }
  })

  it("play another card as a Nope (NO_NOPE)", () => {
    expectRefused(skipped, (on) => ({ type: "nope", playerId: "bob", card: idOf(on, "bob", "beard-cat"), chain: 0 }), "NO_NOPE")
  })

  const malformed: [string, (on: State) => unknown][] = [
    ["a Nope without a card", () => ({ type: "nope", playerId: "bob", chain: 0 })],
    ["a Nope with a fractional card", () => ({ type: "nope", playerId: "bob", card: 1.5, chain: 0 })],
    ["a Nope whose card is a string", (on) => ({ type: "nope", playerId: "bob", card: String(idOf(on, "bob", "nope")), chain: 0 })],
    ["a Nope whose card is not a number", () => ({ type: "nope", playerId: "bob", card: Number.NaN, chain: 0 })],
    ["a Nope without a chain", (on) => ({ type: "nope", playerId: "bob", card: idOf(on, "bob", "nope") })],
    ["a Nope with a fractional chain", (on) => ({ type: "nope", playerId: "bob", card: idOf(on, "bob", "nope"), chain: 0.5 })],
    ["a pass without a chain", () => ({ type: "pass", playerId: "bob" })],
    ["a pass whose chain is null", () => ({ type: "pass", playerId: "bob", chain: null })],
    ["a pass whose chain is infinite", () => ({ type: "pass", playerId: "bob", chain: Number.POSITIVE_INFINITY })],
  ]
  it.each(malformed)("send %s (INVALID_ACTION)", (_, build) => {
    expectRefused(skipped, build, "INVALID_ACTION")
  })

  describe("is checked in this order", () => {
    it("the shape of the action, before everything else", () => {
      // ana may not answer her own card either, and sends no chain: it is the shape that is refused
      expectRefused(skipped, { type: "pass", playerId: "ana" }, "INVALID_ACTION")
    })

    it("then the player, whatever chain they send", () => {
      expectRefused(noped, { type: "pass", playerId: "bob", chain: 0 }, "NOT_WAITING")
    })

    it("then the chain, whatever card they play", () => {
      expectRefused(noped, { type: "nope", playerId: "cleo", card: -1, chain: 0 }, "STALE_REACTION")
    })

    it("then the hand, before the kind of the card", () => {
      expectRefused(skipped, (on) => ({ type: "nope", playerId: "bob", card: idOf(on, "cleo", "favor"), chain: 0 }), "UNKNOWN_CARD")
    })
  })
})

describe("nothing else opens a window", () => {
  it("a draw", () => {
    const state = rig(3, { hands: { ana: ["tacocat"], bob: ["skip"], cleo: ["skip"] }, deck: ["beard-cat", ...CATS] })
    const after = run(state, draw("ana"))
    expect(after.phase).toEqual({ kind: "turn" })
    expect(waitingFor(after)).toEqual(["bob"])
  })

  it("an Exploding Kitten, a Defuse and the place the Kitten goes back to", () => {
    const state = rig(3, { hands: { ana: ["defuse"], bob: ["skip"], cleo: ["skip"] }, deck: ["exploding-kitten", ...CATS] })
    const drawn = run(state, draw("ana"))
    expect(drawn.phase.kind).toBe("defuse")
    expect(waitingFor(drawn)).toEqual(["ana"])
    const back = run(drawn, defuse("ana", 3))
    expect(back.phase).toEqual({ kind: "turn" })
    expect(waitingFor(back)).toEqual(["bob"])
  })

  it("an elimination, the last one too", () => {
    const state = rig(3, { hands: { ana: ["tacocat"], bob: ["skip"], cleo: ["skip"] }, deck: ["exploding-kitten", ...CATS] })
    const after = run(state, draw("ana"))
    expect(after.out).toEqual(["ana"])
    expect(after.phase).toEqual({ kind: "turn" })
    expect(waitingFor(after)).toEqual(["bob"])
    const duel = rig(2, { hands: { ana: ["tacocat"], bob: ["skip"] }, deck: ["exploding-kitten", ...CATS] })
    expect(run(duel, draw("ana")).phase).toEqual({ kind: "over" })
  })

  it("the card a Favor makes the target give", () => {
    const state = rig(3, { hands: { ana: ["favor"], bob: ["beard-cat"], cleo: ["skip"] }, deck: CATS })
    const asking = playThrough(state, "ana", "favor", "bob")
    expect(asking.phase).toEqual({ kind: "give", from: "bob", to: "ana" })
    expect(waitingFor(asking)).toEqual(["bob"])
    const after = run(asking, give("bob", "beard-cat"))
    expect(after.phase).toEqual({ kind: "turn" })
    expect(waitingFor(after)).toEqual(["ana"])
  })

  it("the card taken from the discard after five different cards", () => {
    const five = ["skip", "attack", "shuffle", "tacocat", "beard-cat"]
    const state = rig(3, { hands: { ana: five, bob: ["favor"], cleo: ["favor"] }, discard: ["see-the-future"], deck: CATS })
    const picking = comboThrough(state, "ana", five)
    expect(picking.phase.kind).toBe("pick")
    expect(waitingFor(picking)).toEqual(["ana"])
    const after = run(picking, pick("ana", "see-the-future"))
    expect(after.phase).toEqual({ kind: "turn" })
    expect(waitingFor(after)).toEqual(["ana"])
  })
})

describe("resolveWindow", () => {
  const favor = trace(rig(3, { hands: { ana: ["favor"], bob: ["beard-cat"], cleo: ["skip"] }, deck: CATS }), play("ana", "favor", "bob")).state
  const shuffle = trace(rig(3, { hands: { ana: ["shuffle"], bob: ["skip"], cleo: ["skip"] }, deck: CATS }), play("ana", "shuffle")).state

  it("ends the window as if everyone had passed", () => {
    expect(resolveWindow(ORIGINAL_RULES, skipped)).toStrictEqual(tracePassAll(skipped))
    expect(resolveWindow(ORIGINAL_RULES, run(skipped, pass("bob")))).toStrictEqual(tracePassAll(run(skipped, pass("bob"))))
  })

  it("lets the Nopes played so far decide: an odd chain cancels the card, an even one does not", () => {
    const one = resolveWindow(ORIGINAL_RULES, run(skipped, nope("bob")))
    expect(one.events).toEqual([{ event: { kind: "cancelled", by: "ana" } }])
    expect([one.state.phase.kind, one.state.turn]).toEqual(["turn", 0])
    const two = resolveWindow(ORIGINAL_RULES, run(skipped, nope("bob"), nope("cleo")))
    expect(kinds(two.events)).toEqual(["resolved", "skip", "turn"])
    expect([two.state.phase.kind, two.state.turn]).toEqual(["turn", 1])
  })

  it("goes on to what the card does: a Favor asks for a card, a Shuffle shuffles the pile", () => {
    const asked = resolveWindow(ORIGINAL_RULES, favor)
    expect(asked.state.phase).toEqual({ kind: "give", from: "bob", to: "ana" })
    expect(asked).toStrictEqual(tracePassAll(favor))
    const shuffled = resolveWindow(ORIGINAL_RULES, shuffle)
    expect(kinds(shuffled.events)).toEqual(["resolved", "shuffle"])
    expect(shuffled).toStrictEqual(tracePassAll(shuffle))
  })

  describe("when no window is open", () => {
    const kitten = rig(3, { hands: { ana: ["defuse"], bob: ["skip"], cleo: ["skip"] }, deck: ["exploding-kitten", ...CATS] })
    const five = ["skip", "attack", "shuffle", "tacocat", "beard-cat"]
    const states: [string, State][] = [
      ["a turn", table],
      ["a Kitten to put back", run(kitten, draw("ana"))],
      ["a Favor to give", playThrough(rig(3, { hands: { ana: ["favor"], bob: ["beard-cat"], cleo: ["skip"] }, deck: CATS }), "ana", "favor", "bob")],
      [
        "a card to take from the discard",
        comboThrough(rig(3, { hands: { ana: five, bob: ["favor"], cleo: ["favor"] }, discard: ["see-the-future"], deck: CATS }), "ana", five),
      ],
      ["a finished game", run(rig(2, { hands: { ana: ["tacocat"], bob: ["skip"] }, deck: ["exploding-kitten", ...CATS] }), draw("ana"))],
    ]

    it.each(states)("changes nothing in %s", (_, state) => {
      expect(resolveWindow(ORIGINAL_RULES, state)).toStrictEqual({ state, events: [] })
    })
  })

  it("works on a copy: the state it is given is not touched", () => {
    const frozen = deepFreeze(structuredClone(skipped))
    const before = structuredClone(frozen)
    const { state } = resolveWindow(ORIGINAL_RULES, frozen)
    expect(frozen).toStrictEqual(before)
    expect(state).not.toBe(frozen)
    expect(state.phase).toEqual({ kind: "turn" })
  })

  it("leaves the answers that come after it refused", () => {
    const { state } = resolveWindow(ORIGINAL_RULES, skipped)
    expectRefused(state, pass("bob"), "NOT_WAITING")
    expectRefused(state, nope("bob"), "NOT_WAITING")
  })

  it("is what the package gives a timer", () => {
    expect(exported).toBe(resolveWindow)
  })
})
