import { describe, expect, it } from "vitest"
import {
  CATS,
  type Layout,
  combo,
  comboThrough,
  discardIdOf,
  discardTitles,
  draw,
  entryOf,
  eventOf,
  expectIntegrity,
  expectRefused,
  expectSerializable,
  handIds,
  handTitles,
  idOf,
  idsOf,
  kinds,
  nope,
  pass,
  pick,
  play,
  rig,
  run,
  seedOf,
  titleOf,
  trace,
} from "./test-utils"
import type { State } from "./types"

/**
 * Combos, which are the same in every deck: two or three cards of the same title, or five different ones. The table of each group
 * is a real one, with every other player answering the window by passing.
 */

/** Every player the window waits for passes, in seat order, until it closes. */
function everyonePasses(...players: string[]) {
  return players.map((id) => pass(id))
}

describe("a pair", () => {
  const layout: Layout = {
    hands: { ana: ["tacocat", "tacocat", "skip"], bob: ["beard-cat", "defuse", "nope"], cleo: ["favor"] },
    deck: CATS,
    turn: "ana",
  }
  const table = rig(3, layout)
  const pair = idsOf(table, "ana", "tacocat")
  const played = combo("ana", ["tacocat", "tacocat"], "bob")
  const { state: waiting, events: told } = trace(table, played)

  it("goes to the discard, the card played last on top, and is shown to everybody", () => {
    expect(discardTitles(waiting)).toEqual(["tacocat", "tacocat"])
    expect(waiting.discard).toEqual([pair[1], pair[0]])
    expect(handTitles(waiting, "ana")).toEqual(["skip"])
    expect(told).toEqual([
      {
        event: {
          kind: "combo",
          by: "ana",
          cards: [
            { id: pair[0], type: "tacocat" },
            { id: pair[1], type: "tacocat" },
          ],
          target: "bob",
        },
      },
    ])
    expectIntegrity(waiting)
    expectSerializable(waiting)
  })

  it("opens a Nope window on the steal, for everybody but its author", () => {
    expect(waiting.phase).toEqual({
      kind: "reaction",
      pending: { kind: "combo", by: "ana", cards: pair, target: "bob" },
      nopes: [],
      passed: { bob: null, cleo: null },
    })
  })

  it("takes nothing before the window closes", () => {
    expect(waiting.hands[1]).toEqual(table.hands[1])
    expect(run(waiting, pass("bob")).hands[1]).toEqual(table.hands[1])
  })

  describe("once nobody answers", () => {
    const { state: after, events } = trace(waiting, ...everyonePasses("bob", "cleo"))
    const steal = eventOf(events, "steal")

    it("takes a card of the target, and gives it to the player", () => {
      expect(kinds(events)).toEqual(["resolved", "steal"])
      expect(steal).toMatchObject({ by: "ana", from: "bob" })
      const taken = steal.card?.id
      expect(handIds(table, "bob")).toContain(taken)
      expect(handIds(after, "bob")).toEqual(handIds(table, "bob").filter((id) => id !== taken))
      expect(handIds(after, "ana")).toEqual([idOf(table, "ana", "skip"), taken])
      expect(after.phase).toEqual({ kind: "turn" })
      expectIntegrity(after)
      expectSerializable(after)
    })

    it("tells which card it was to the two of them only", () => {
      expect(entryOf(events, "steal")).toEqual({
        event: { kind: "steal", by: "ana", from: "bob", card: steal.card },
        to: ["ana", "bob"],
        masked: { kind: "steal", by: "ana", from: "bob" },
      })
    })

    it("does not end the turn of the player", () => {
      expect([after.turn, after.owed, after.attacked]).toEqual([0, 1, false])
      expect(run(after, draw("ana")).phase.kind).toBe("turn")
    })

    it("is the same card every time it is played from the same state", () => {
      expect(trace(waiting, ...everyonePasses("bob", "cleo"))).toStrictEqual({ state: after, events })
    })
  })

  it("takes any card of the target with the same chance: over many games, each of them is taken", () => {
    const taken = new Set<string | undefined>()
    for (let i = 0; i < 60; i++) {
      const { events } = trace(rig(3, { ...layout, seed: seedOf(i) }), played, ...everyonePasses("bob", "cleo"))
      taken.add(eventOf(events, "steal").card?.type)
    }
    expect([...taken].sort()).toEqual(["beard-cat", "defuse", "nope"])
  })

  it("takes the only card of a target who holds one", () => {
    const small = rig(3, { hands: { ana: ["tacocat", "tacocat"], bob: ["favor"], cleo: ["skip"] }, deck: CATS, turn: "ana" })
    const after = comboThrough(small, "ana", ["tacocat", "tacocat"], "bob")
    expect(handTitles(after, "ana")).toEqual(["favor"])
    expect(handTitles(after, "bob")).toEqual([])
  })

  it("leaves the draw pile and what the players know of it as they were", () => {
    const knowing: State = { ...table, known: { cleo: 2 } }
    const after = comboThrough(knowing, "ana", ["tacocat", "tacocat"], "bob")
    expect(after.deck).toEqual(knowing.deck)
    expect(after.known).toEqual({ cleo: 2 })
  })

  describe("is made of any two cards of the same title, whatever they print", () => {
    it.each(["attack", "skip", "favor", "shuffle", "see-the-future", "nope", "defuse", "beard-cat"])("two %s", (title) => {
      const state = rig(3, { hands: { ana: [title, title], bob: ["tacocat"], cleo: ["rainbow-ralphing-cat"] }, turn: "ana" })
      const { state: after, events } = trace(state, combo("ana", [title, title], "bob"), ...everyonePasses("bob", "cleo"))
      // a steal, and nothing of what the cards print
      expect(kinds(events)).toEqual(["combo", "resolved", "steal"])
      expect(handTitles(after, "ana")).toEqual(["tacocat"])
      expect(handTitles(after, "bob")).toEqual([])
      expect(discardTitles(after)).toEqual([title, title])
      expect([after.turn, after.owed, after.attacked]).toEqual([0, 1, false])
      expect(after.deck).toEqual(state.deck)
      expect(after.phase).toEqual({ kind: "turn" })
    })

    it("two Attacks do not attack: the turn is not passed and nobody owes more", () => {
      const state = rig(3, { hands: { ana: ["attack", "attack"], bob: ["tacocat"], cleo: ["skip"] }, turn: "ana" })
      const { state: after, events } = trace(state, combo("ana", ["attack", "attack"], "cleo"), ...everyonePasses("bob", "cleo"))
      expect(kinds(events)).not.toContain("attack")
      expect([after.turn, after.owed, after.attacked]).toEqual([0, 1, false])
    })
  })

  describe("can be answered", () => {
    it("by a Nope, which cancels the steal and costs the player their two cards", () => {
      const { state, events } = trace(waiting, nope("bob"), ...everyonePasses("ana", "cleo"))
      expect(kinds(events)).toEqual(["nope", "cancelled"])
      expect(events.at(-1)?.event).toEqual({ kind: "cancelled", by: "ana" })
      expect(discardTitles(state)).toEqual(["nope", "tacocat", "tacocat"])
      expect(handTitles(state, "ana")).toEqual(["skip"])
      expect(handTitles(state, "bob")).toEqual(["beard-cat", "defuse"])
      expect(state.phase).toEqual({ kind: "turn" })
      expectIntegrity(state)
    })

    it("by a Nope that is Noped: the steal goes through", () => {
      const state = rig(3, {
        hands: { ana: ["tacocat", "tacocat", "nope"], bob: ["beard-cat", "nope"], cleo: ["favor"] },
        deck: CATS,
        turn: "ana",
      })
      const { state: after, events } = trace(state, played, nope("bob"), nope("ana"), ...everyonePasses("bob", "cleo"))
      expect(kinds(events)).toEqual(["combo", "nope", "nope", "resolved", "steal"])
      expect(handTitles(after, "ana")).toEqual(["beard-cat"])
      expect(handTitles(after, "bob")).toEqual([])
      expect(discardTitles(after)).toEqual(["nope", "nope", "tacocat", "tacocat"])
    })

    it("and fizzles when the Nope the target played was their last card", () => {
      const state = rig(2, { hands: { ana: ["tacocat", "tacocat", "nope"], bob: ["nope"] }, deck: CATS, turn: "ana" })
      const { state: after, events } = trace(state, played, nope("bob"), nope("ana"), pass("bob"))
      expect(kinds(events)).toEqual(["combo", "nope", "nope", "resolved", "fizzled"])
      expect(events.at(-1)?.event).toEqual({ kind: "fizzled", by: "ana" })
      expect(handTitles(after, "ana")).toEqual([])
      expect(after.phase).toEqual({ kind: "turn" })
      expectIntegrity(after)
    })
  })

  describe("is refused", () => {
    const four = rig(4, {
      hands: { ana: ["tacocat", "tacocat", "skip"], bob: ["defuse"], cleo: [], dan: [] },
      out: ["dan"],
      deck: CATS,
      turn: "ana",
    })

    it.each<[string, unknown]>([
      ["the player themselves", "ana"],
      ["a stranger", "zoe"],
      ["a player who holds no card", "cleo"],
      ["a player who is out", "dan"],
      ["missing", undefined],
      ["null", null],
      ["a number", 1],
      ["an empty name", ""],
      ["an object", { id: "bob" }],
    ])("when the target is %s", (_what, target) => {
      expectRefused(four, (on) => ({ type: "combo", playerId: "ana", cards: idsOf(on, "ana", "tacocat"), target }), "INVALID_TARGET")
    })

    it("when the cards do not have the same title", () => {
      expectRefused(four, combo("ana", ["tacocat", "skip"], "bob"), "BAD_COMBO")
    })

    it("when it is only one card", () => {
      expectRefused(four, combo("ana", ["tacocat"], "bob"), "BAD_COMBO")
    })

    it("when it is no card at all", () => {
      expectRefused(four, { type: "combo", playerId: "ana", cards: [], target: "bob" }, "BAD_COMBO")
    })

    it("when a card is played twice", () => {
      expectRefused(four, (on) => ({ type: "combo", playerId: "ana", cards: [idOf(on, "ana", "tacocat"), idOf(on, "ana", "tacocat")], target: "bob" }), "BAD_COMBO")
    })

    it("when the cards are not in the hand of the player", () => {
      expectRefused(four, (on) => ({ type: "combo", playerId: "ana", cards: [idOf(on, "ana", "tacocat"), idOf(on, "bob", "defuse")], target: "bob" }), "UNKNOWN_CARD")
      expectRefused(four, { type: "combo", playerId: "ana", cards: [-1, -2], target: "bob" }, "UNKNOWN_CARD")
    })

    it.each<[string, unknown]>([
      ["not a list", 12],
      ["missing", undefined],
      ["a list of strings", ["1", "2"]],
      ["a list of fractions", [1.5, 2.5]],
      ["null", null],
    ])("when the cards are %s", (_what, cards) => {
      expectRefused(four, { type: "combo", playerId: "ana", cards, target: "bob" }, "INVALID_ACTION")
    })

    it("when it is four cards of the same title", () => {
      const state = rig(3, { hands: { ana: ["tacocat", "tacocat", "tacocat", "tacocat"], bob: ["defuse"] }, deck: CATS, turn: "ana" })
      expectRefused(state, combo("ana", ["tacocat", "tacocat", "tacocat", "tacocat"], "bob"), "BAD_COMBO")
    })

    it("when it is five cards of the same title", () => {
      const state = rig(3, { hands: { ana: ["nope", "nope", "nope", "nope", "nope"], bob: ["defuse"] }, deck: CATS, turn: "ana" })
      expectRefused(state, combo("ana", ["nope", "nope", "nope", "nope", "nope"], "bob"), "BAD_COMBO")
    })

    it("when it is five cards of which two are alike", () => {
      const state = rig(3, {
        hands: { ana: ["tacocat", "tacocat", "skip", "favor", "shuffle"], bob: ["defuse"] },
        discard: ["attack"],
        deck: CATS,
        turn: "ana",
      })
      expectRefused(state, combo("ana", ["tacocat", "tacocat", "skip", "favor", "shuffle"]), "BAD_COMBO")
    })

    it("when it is six cards", () => {
      const state = rig(3, {
        hands: { ana: ["tacocat", "beard-cat", "skip", "favor", "shuffle", "attack"], bob: ["defuse"] },
        discard: ["nope"],
        deck: CATS,
        turn: "ana",
      })
      expectRefused(state, combo("ana", ["tacocat", "beard-cat", "skip", "favor", "shuffle", "attack"]), "BAD_COMBO")
    })

    it("when it is not the turn of the player, or a window is open", () => {
      expectRefused(four, combo("bob", ["defuse"], "ana"), "NOT_YOUR_TURN")
      expectRefused(waiting, combo("ana", ["skip"], "bob"), "REACTION_OPEN")
    })

    it("and nothing has moved, whatever the reason", () => {
      expect(four.hands[0]).toEqual(rig(4, { hands: { ana: ["tacocat", "tacocat", "skip"] }, out: ["dan"], deck: CATS, turn: "ana" }).hands[0])
    })

    describe("in this order: the cards, then their number and titles, then the target, then the title", () => {
      it("a card that is not in the hand beats a wrong combo", () => {
        expectRefused(four, (on) => ({ type: "combo", playerId: "ana", cards: [idOf(on, "ana", "tacocat"), idOf(on, "bob", "defuse")], target: "ana" }), "UNKNOWN_CARD")
      })

      it("a card played twice beats a wrong target", () => {
        expectRefused(four, (on) => ({ type: "combo", playerId: "ana", cards: [idOf(on, "ana", "tacocat"), idOf(on, "ana", "tacocat")], target: "ana" }), "BAD_COMBO")
      })

      it("cards of different titles beat a wrong target", () => {
        expectRefused(four, combo("ana", ["tacocat", "skip"], "ana"), "BAD_COMBO")
      })

      it("a wrong target beats a wrong title", () => {
        const state = rig(3, { hands: { ana: ["tacocat", "tacocat", "tacocat"], bob: ["defuse"] }, deck: CATS, turn: "ana" })
        expectRefused(state, combo("ana", ["tacocat", "tacocat", "tacocat"], "ana", "nonsense"), "INVALID_TARGET")
      })
    })
  })

  it("ignores the title it is given: only a triple names one", () => {
    const { state } = trace(table, combo("ana", ["tacocat", "tacocat"], "bob", "defuse"))
    const { phase } = state
    if (phase.kind !== "reaction") throw new Error("A window should be open")
    expect(Object.hasOwn(phase.pending, "named")).toBe(false)
    expectSerializable(state)
  })
})

describe("a triple", () => {
  const layout: Layout = {
    hands: { ana: ["tacocat", "tacocat", "tacocat", "skip"], bob: ["defuse", "nope", "beard-cat", "defuse"], cleo: ["favor"] },
    deck: CATS,
    turn: "ana",
  }
  const table = rig(3, layout)
  const triple = ["tacocat", "tacocat", "tacocat"]
  const ask = (named: string, target = "bob") => combo("ana", triple, target, named)

  it("goes to the discard with the title it names, shown to everybody", () => {
    const { state, events } = trace(table, ask("defuse"))
    const cards = idsOf(table, "ana", "tacocat")
    expect(events).toEqual([
      { event: { kind: "combo", by: "ana", cards: cards.map((id) => ({ id, type: "tacocat" })), target: "bob", named: "defuse" } },
    ])
    expect(state.phase).toEqual({ kind: "reaction", pending: { kind: "combo", by: "ana", cards, target: "bob", named: "defuse" }, nopes: [], passed: { bob: null, cleo: null } })
    expect(discardTitles(state)).toEqual(["tacocat", "tacocat", "tacocat"])
    expectIntegrity(state)
    expectSerializable(state)
  })

  describe("takes the card it names when the target holds one", () => {
    const { state: after, events } = trace(table, ask("defuse"), ...everyonePasses("bob", "cleo"))
    const named = eventOf(events, "named")

    it("the first one of the hand, and no other", () => {
      const [first, second] = idsOf(table, "bob", "defuse")
      expect(named).toEqual({ kind: "named", by: "ana", from: "bob", title: "defuse", hit: true, card: { id: first, type: "defuse" } })
      expect(handIds(after, "bob")).toEqual(handIds(table, "bob").filter((id) => id !== first))
      expect(handIds(after, "ana")).toEqual([idOf(table, "ana", "skip"), first])
      expect(handIds(after, "bob")).toContain(second)
      expectIntegrity(after)
    })

    it("tells the title and that it hit to everybody, which card exactly to the two of them only", () => {
      expect(entryOf(events, "named")).toEqual({
        event: named,
        to: ["ana", "bob"],
        masked: { kind: "named", by: "ana", from: "bob", title: "defuse", hit: true },
      })
    })

    it("keeps the turn of the player", () => {
      expect(kinds(events)).toEqual(["combo", "resolved", "named"])
      expect([after.turn, after.owed, after.attacked]).toEqual([0, 1, false])
      expect(after.phase).toEqual({ kind: "turn" })
    })
  })

  describe("takes nothing when the target does not hold it", () => {
    const { state: after, events } = trace(table, ask("attack"), ...everyonePasses("bob", "cleo"))

    it("and tells everybody so", () => {
      expect(entryOf(events, "named")).toEqual({ event: { kind: "named", by: "ana", from: "bob", title: "attack", hit: false } })
    })

    it("and moves no card but the three that were played", () => {
      expect(after.hands[1]).toEqual(table.hands[1])
      expect(handTitles(after, "ana")).toEqual(["skip"])
      expect(after.phase).toEqual({ kind: "turn" })
    })
  })

  it.each(["defuse", "nope", "beard-cat", "tacocat", "skip", "see-the-future"])("may name %s, whether or not it is held", (title) => {
    const { events } = trace(table, ask(title), ...everyonePasses("bob", "cleo"))
    expect(eventOf(events, "named")).toMatchObject({ title, hit: handTitles(table, "bob").includes(title) })
  })

  it("is made of any three cards of the same title", () => {
    const state = rig(3, { hands: { ana: ["attack", "attack", "attack"], bob: ["favor"] }, turn: "ana" })
    const { state: after, events } = trace(state, combo("ana", ["attack", "attack", "attack"], "bob", "favor"), ...everyonePasses("bob", "cleo"))
    expect(kinds(events)).toEqual(["combo", "resolved", "named"])
    expect(handTitles(after, "ana")).toEqual(["favor"])
    expect([after.turn, after.owed, after.attacked]).toEqual([0, 1, false])
  })

  describe("is refused", () => {
    it.each<[string, unknown]>([
      ["missing", undefined],
      ["null", null],
      ["a number", 3],
      ["an empty name", ""],
      ["not a title of the game", "nonsense"],
      ["written with other capitals", "Tacocat"],
      ["an Exploding Kitten, which nobody holds", "exploding-kitten"],
      ["a list", ["defuse"]],
    ])("when the title is %s", (_what, named) => {
      expectRefused(table, (on) => ({ type: "combo", playerId: "ana", cards: idsOf(on, "ana", "tacocat"), target: "bob", named }), "INVALID_TITLE")
    })

    it("when the target is not valid, before the title is looked at", () => {
      expectRefused(table, combo("ana", triple, "ana", "nonsense"), "INVALID_TARGET")
      expectRefused(table, combo("ana", triple, undefined, "nonsense"), "INVALID_TARGET")
    })

    it("when the cards do not have the same title", () => {
      expectRefused(table, combo("ana", ["tacocat", "tacocat", "skip"], "bob", "defuse"), "BAD_COMBO")
    })
  })

  describe("when the Nopes of the window are played", () => {
    it("is cancelled by one Nope: the three cards are lost, nothing is asked", () => {
      const { state, events } = trace(table, ask("defuse"), nope("bob"), ...everyonePasses("ana", "cleo"))
      expect(kinds(events)).toEqual(["combo", "nope", "cancelled"])
      expect(state.hands[1]).toEqual(table.hands[1]!.filter((id) => titleOf(table, id) !== "nope"))
      expect(discardTitles(state)).toEqual(["nope", "tacocat", "tacocat", "tacocat"])
    })

    it("fizzles when the target played their last card behind the window", () => {
      const state = rig(2, { hands: { ana: ["tacocat", "tacocat", "tacocat", "nope"], bob: ["nope"] }, deck: CATS, turn: "ana" })
      const { events } = trace(state, ask("nope"), nope("bob"), nope("ana"), pass("bob"))
      expect(kinds(events)).toEqual(["combo", "nope", "nope", "resolved", "fizzled"])
    })
  })
})

describe("five different cards", () => {
  const layout: Layout = {
    hands: { ana: ["tacocat", "beard-cat", "skip", "favor", "shuffle", "nope"], bob: ["defuse"], cleo: ["see-the-future"] },
    discard: ["attack", "exploding-kitten", "tacocat"],
    deck: CATS,
    turn: "ana",
  }
  const table = rig(3, layout)
  const five = ["tacocat", "beard-cat", "skip", "favor", "shuffle"]
  const played = combo("ana", five)
  const cards = five.map((title) => idOf(table, "ana", title))
  const { state: waiting, events: told } = trace(table, played)

  it("goes to the discard in the order it was played, shown to everybody, and names nobody", () => {
    expect(discardTitles(waiting)).toEqual(["shuffle", "favor", "skip", "beard-cat", "tacocat", "attack", "exploding-kitten", "tacocat"])
    expect(told).toEqual([{ event: { kind: "combo", by: "ana", cards: cards.map((id, i) => ({ id, type: five[i] })) } }])
    expect(waiting.phase).toEqual({ kind: "reaction", pending: { kind: "combo", by: "ana", cards }, nopes: [], passed: { bob: null, cleo: null } })
    expect(handTitles(waiting, "ana")).toEqual(["nope"])
    expectIntegrity(waiting)
    expectSerializable(waiting)
  })

  it("does not look at a target it is given", () => {
    const { state } = trace(table, combo("ana", five, "bob", "defuse"))
    if (state.phase.kind !== "reaction") throw new Error("A window should be open")
    expect(Object.hasOwn(state.phase.pending, "target")).toBe(false)
    expect(Object.hasOwn(state.phase.pending, "named")).toBe(false)
  })

  describe("lets the player take a card of the discard once nobody answers", () => {
    const { state: choosing, events } = trace(waiting, ...everyonePasses("bob", "cleo"))

    it("waits for the player to choose, with the five cards just played set aside", () => {
      expect(kinds(events)).toEqual(["resolved"])
      expect(choosing.phase).toEqual({ kind: "pick", played: cards })
      expectIntegrity(choosing)
    })

    it("waits for the player alone", () => {
      expectRefused(choosing, pick("bob", "attack"), "NOT_YOUR_TURN")
      expectRefused(choosing, draw("ana"), "INVALID_ACTION")
      expectRefused(choosing, play("ana", "nope"), "INVALID_ACTION")
      expectRefused(choosing, combo("ana", ["nope"], "bob"), "INVALID_ACTION")
      expectRefused(choosing, { type: "pass", playerId: "bob", chain: 0 }, "NOT_WAITING")
    })

    it("gives the card back to the hand under a new id, and shows it to everybody", () => {
      const old = discardIdOf(choosing, "attack")
      const { state: after, events: taken } = trace(choosing, pick("ana", "attack"))
      expect(taken).toEqual([{ event: { kind: "pick", by: "ana", card: { id: old, type: "attack" } } }])
      expect(handTitles(after, "ana")).toEqual(["attack", "nope"])
      expect(after.ids).not.toContain(old)
      expect(discardTitles(after)).toEqual(["shuffle", "favor", "skip", "beard-cat", "tacocat", "exploding-kitten", "tacocat"])
      expect(after.phase).toEqual({ kind: "turn" })
      expect([after.turn, after.owed, after.attacked]).toEqual([0, 1, false])
      expectIntegrity(after)
      expectSerializable(after)
    })

    it("can be any card that was in the discard before: a cat, an action card…", () => {
      // two Tacocats lie there: the one just played (second in the discard, from the top), and the older one (last)
      const older = discardIdOf(choosing, "tacocat", 1)
      expect(choosing.discard.indexOf(older)).toBe(choosing.discard.length - 1)
      const after = run(choosing, pick("ana", "tacocat", 1))
      expect(handTitles(after, "ana")).toEqual(["nope", "tacocat"])
      expect(discardTitles(after)).toEqual(["shuffle", "favor", "skip", "beard-cat", "tacocat", "attack", "exploding-kitten"])
      expectIntegrity(after)
    })

    it("cannot be a card just played, even when an older card of the discard has the same title", () => {
      expectRefused(choosing, (on) => ({ type: "pick", playerId: "ana", card: discardIdOf(on, "tacocat", 0) }), "INVALID_PICK")
    })

    it("lets the player go on with the turn", () => {
      expect(run(choosing, pick("ana", "attack"), draw("ana")).phase.kind).toBe("turn")
    })

    it.each([
      ["a card that was just played", (on: State) => on.discard[0]!],
      ["the first of the cards that were just played", () => cards[0]!],
      ["an Exploding Kitten", (on: State) => discardIdOf(on, "exploding-kitten")],
      ["a card of a hand", (on: State) => idOf(on, "ana", "nope")],
      ["a card of the draw pile", (on: State) => on.deck[0]!],
      ["a card that does not exist", () => -1],
    ])("is refused for %s", (_what, wanted) => {
      expectRefused(choosing, (on) => ({ type: "pick", playerId: "ana", card: wanted(on) }), "INVALID_PICK")
    })

    it.each<[string, unknown]>([
      ["a fraction", 1.5],
      ["a string", "1"],
      ["missing", undefined],
    ])("is refused when the card is %s", (_what, card) => {
      expectRefused(choosing, { type: "pick", playerId: "ana", card }, "INVALID_ACTION")
    })
  })

  describe("when the discard holds a Defuse or a Nope", () => {
    const rich = rig(3, {
      hands: { ana: five, bob: ["defuse"] },
      discard: ["defuse", "nope", "exploding-kitten"],
      deck: CATS,
      turn: "ana",
    })

    it.each(["defuse", "nope"])("the player may take the %s", (title) => {
      const after = run(comboThrough(rich, "ana", five), pick("ana", title))
      expect(handTitles(after, "ana")).toEqual([title])
      expect(discardTitles(after)).toEqual(["shuffle", "favor", "skip", "beard-cat", "tacocat", ...["defuse", "nope", "exploding-kitten"].filter((kept) => kept !== title)])
      expectIntegrity(after)
    })
  })

  describe("can be answered", () => {
    it("by a Nope: the five cards are lost, nothing is taken", () => {
      const armed = rig(3, { ...layout, hands: { ...layout.hands, bob: ["defuse", "nope"] } })
      const { state, events } = trace(armed, played, nope("bob"), ...everyonePasses("ana", "cleo"))
      expect(kinds(events)).toEqual(["combo", "nope", "cancelled"])
      expect(state.phase).toEqual({ kind: "turn" })
      expect(state.discard).toHaveLength(layout.discard!.length + five.length + 1)
      expect(handTitles(state, "ana")).toEqual(["nope"])
      expectRefused(state, pick("ana", "attack"), "INVALID_ACTION")
      expectIntegrity(state)
    })

    it("by a Nope that is Noped: the player takes a card, and the Nopes are in the discard to take too", () => {
      const state = rig(3, { ...layout, hands: { ana: [...five, "nope"], bob: ["nope"], cleo: [] } })
      const { state: choosing } = trace(state, played, nope("bob"), nope("ana"), ...everyonePasses("bob", "cleo"))
      expect(choosing.phase.kind).toBe("pick")
      const after = run(choosing, pick("ana", "nope"))
      expect(handTitles(after, "ana")).toEqual(["nope"])
    })
  })

  describe("is refused", () => {
    it("when the cards have only four different titles", () => {
      const state = rig(3, { ...layout, hands: { ana: ["tacocat", "beard-cat", "skip", "favor", "favor"], bob: ["defuse"] } })
      expectRefused(state, combo("ana", ["tacocat", "beard-cat", "skip", "favor", "favor"]), "BAD_COMBO")
    })

    it("when the discard holds nothing to take", () => {
      for (const discard of [[], ["exploding-kitten"], ["exploding-kitten", "exploding-kitten"]]) {
        expectRefused(rig(3, { ...layout, discard }), played, "EMPTY_DISCARD")
      }
    })

    it("and the five cards just played do not count: a discard that holds them alone is empty", () => {
      const state = rig(3, { ...layout, hands: { ana: five }, discard: [] })
      expectRefused(state, played, "EMPTY_DISCARD")
    })

    it("when the option is off", () => {
      const state = rig(3, { ...layout, options: { fiveDifferent: false } })
      expect(state.options.fiveDifferent).toBe(false)
      expectRefused(state, played, "BAD_COMBO")
    })

    it("when a card is not in the hand", () => {
      expectRefused(table, (on) => ({ type: "combo", playerId: "ana", cards: [...cards.slice(0, 4), idOf(on, "bob", "defuse")] }), "UNKNOWN_CARD")
    })
  })

  it("is any five titles: the five kinds of cat as well", () => {
    const cats = ["tacocat", "beard-cat", "rainbow-ralphing-cat", "cattermelon", "hairy-potato-cat"]
    const state = rig(3, { hands: { ana: cats, bob: ["defuse"] }, discard: ["nope"], deck: ["skip"], turn: "ana" })
    const choosing = comboThrough(state, "ana", cats)
    expect(choosing.phase).toEqual({ kind: "pick", played: cats.map((title) => idOf(state, "ana", title)) })
    expect(handTitles(run(choosing, pick("ana", "nope")), "ana")).toEqual(["nope"])
  })
})
