import { describe, expect, it } from "vitest"
import {
  CATS,
  deckTitles,
  discardTitles,
  draw,
  expectIntegrity,
  expectRefused,
  give,
  handTitles,
  idOf,
  kinds,
  nope,
  pass,
  passAll,
  play,
  playThrough,
  rig,
  run,
  seedOf,
  trace,
} from "./test-utils"

/** The cards that act on the table other than by ending a turn: Favor, Shuffle and See the Future (Skip and Attack: `turns.test.ts`). */

describe("Favor", () => {
  const state = rig(3, {
    hands: { ana: ["favor", "tacocat"], bob: ["skip", "nope"], cleo: ["beard-cat"] },
    deck: CATS,
    turn: "ana",
  })
  const asking = playThrough(state, "ana", "favor", "bob")

  it("names the player it is aimed at when its window opens", () => {
    const open = run(state, play("ana", "favor", "bob"))
    expect(open.phase).toMatchObject({ kind: "reaction", pending: { kind: "card", by: "ana", target: "bob" } })
    expect(discardTitles(open)).toEqual(["favor"])
    expect(handTitles(open, "ana")).toEqual(["tacocat"])
  })

  it("asks the player it is aimed at once nobody has Noped it", () => {
    expect(asking.phase).toEqual({ kind: "give", from: "bob", to: "ana" })
    expect(asking.turn).toBe(0)
    expectIntegrity(asking)
  })

  it("tells what happened, in order", () => {
    const { events } = trace(state, play("ana", "favor", "bob"), pass("bob"), pass("cleo"))
    expect(kinds(events)).toEqual(["play", "resolved", "ask"])
    expect(events[0]?.event).toEqual({ kind: "play", by: "ana", card: { id: idOf(state, "ana", "favor"), type: "favor" }, target: "bob" })
    expect(events[2]?.event).toEqual({ kind: "ask", by: "ana", from: "bob" })
  })

  it("hands the card the target chooses to the player who asked", () => {
    const given = run(asking, give("bob", "skip"))
    expect(handTitles(given, "ana")).toEqual(["skip", "tacocat"])
    expect(handTitles(given, "bob")).toEqual(["nope"])
    expect(given.phase).toEqual({ kind: "turn" })
    expectIntegrity(given)
  })

  it("shows the card to the two of them only", () => {
    const { events } = trace(asking, give("bob", "skip"))
    expect(events).toEqual([
      {
        event: { kind: "give", from: "bob", to: "ana", card: { id: idOf(asking, "bob", "skip"), type: "skip" } },
        to: ["bob", "ana"],
        masked: { kind: "give", from: "bob", to: "ana" },
      },
    ])
  })

  it("leaves the turn to the player who asked: they go on playing, then draw", () => {
    const given = run(asking, give("bob", "skip"))
    expect([given.turn, given.owed, given.attacked]).toEqual([0, 1, false])
    expect(given.stats[0]?.turns).toBe(0)
    // the card they were given is theirs to play
    expect(playThrough(given, "ana", "skip").turn).toBe(1)
    expect(run(given, draw("ana")).turn).toBe(1)
  })

  it("lets the target give any card they hold: a Defuse, a Nope", () => {
    for (const title of ["defuse", "nope"]) {
      const duel = rig(2, { hands: { ana: ["favor"], bob: ["defuse", "nope"] }, deck: CATS, turn: "ana" })
      const given = run(playThrough(duel, "ana", "favor", "bob"), give("bob", title))
      expect(handTitles(given, "ana"), title).toEqual([title])
      expect(handTitles(given, "bob"), title).toEqual(["defuse", "nope"].filter((held) => held !== title))
    }
  })

  it("waits for the target alone", () => {
    expectRefused(asking, draw("ana"), "NOT_YOUR_TURN")
    expectRefused(asking, draw("cleo"), "NOT_YOUR_TURN")
    expectRefused(asking, give("ana", "tacocat"), "NOT_YOUR_TURN")
    expectRefused(asking, give("cleo", "beard-cat"), "NOT_YOUR_TURN")
  })

  it("takes nothing but their answer from the target", () => {
    expectRefused(asking, draw("bob"), "INVALID_ACTION")
    expectRefused(asking, play("bob", "skip"), "INVALID_ACTION")
    expectRefused(asking, { type: "combo", playerId: "bob", cards: [] }, "INVALID_ACTION")
    expectRefused(asking, { type: "defuse", playerId: "bob", position: 0 }, "INVALID_ACTION")
    expectRefused(asking, { type: "pick", playerId: "bob", card: 0 }, "INVALID_ACTION")
  })

  it("is not answered with a card the target does not hold", () => {
    expectRefused(asking, (on) => ({ type: "give", playerId: "bob", card: idOf(on, "ana", "tacocat") }), "UNKNOWN_CARD")
    expectRefused(asking, { type: "give", playerId: "bob", card: -1 }, "UNKNOWN_CARD")
  })

  it("opens no window to answer once the target has asked: there is nothing to Nope any more", () => {
    expectRefused(asking, { type: "pass", playerId: "cleo", chain: 0 }, "NOT_WAITING")
  })

  describe("its target", () => {
    // ana asks; bob holds a card; cleo is in the game with an empty hand; dan is out
    const table = rig(4, { hands: { ana: ["favor"], bob: ["skip"] }, out: ["dan"], deck: CATS, turn: "ana" })

    it("is a player who holds a card", () => {
      expect(run(table, play("ana", "favor", "bob")).phase.kind).toBe("reaction")
    })

    it.each<[string, unknown]>([
      ["no target", undefined],
      ["themself", "ana"],
      ["a stranger", "zoe"],
      ["a player with no card", "cleo"],
      ["a player who is out", "dan"],
      ["something that is not a player", 7],
      ["an object", { id: "bob" }],
    ])("is never %s", (_what, target) => {
      expectRefused(table, { type: "play", playerId: "ana", card: idOf(table, "ana", "favor"), target }, "INVALID_TARGET")
    })

    it("cannot be asked again once they have given their last card", () => {
      const duel = rig(2, { hands: { ana: ["favor", "favor"], bob: ["skip"] }, deck: CATS, turn: "ana" })
      const given = run(playThrough(duel, "ana", "favor", "bob"), give("bob", "skip"))
      expect(handTitles(given, "bob")).toEqual([])
      expectRefused(given, play("ana", "favor", "bob"), "INVALID_TARGET")
    })
  })

  it("does nothing when the target has no card left once its window has closed", () => {
    // bob plays his only card, a Nope; ana Nopes it; the Favor goes through and finds an empty hand
    const duel = rig(2, { hands: { ana: ["favor", "nope"], bob: ["nope"] }, deck: CATS, turn: "ana" })
    const { state: after, events } = trace(duel, play("ana", "favor", "bob"), nope("bob"), nope("ana"), pass("bob"))
    expect(kinds(events)).toEqual(["play", "nope", "nope", "resolved", "fizzled"])
    expect(events.at(-1)?.event).toEqual({ kind: "fizzled", by: "ana" })
    expect(after.phase).toEqual({ kind: "turn" })
    expect(after.turn).toBe(0)
    expect(handTitles(after, "bob")).toEqual([])
    expect(discardTitles(after)).toEqual(["nope", "nope", "favor"])
    expectIntegrity(after)
  })

  it("is cancelled by a Nope: nothing is asked and nothing moves", () => {
    const noped = rig(3, { hands: { ana: ["favor"], bob: ["skip"], cleo: ["nope"] }, deck: CATS, turn: "ana" })
    const after = passAll(run(noped, play("ana", "favor", "bob"), nope("cleo")))
    expect(after.phase).toEqual({ kind: "turn" })
    expect(handTitles(after, "bob")).toEqual(["skip"])
    expect(handTitles(after, "ana")).toEqual([])
    expect(discardTitles(after)).toEqual(["nope", "favor"])
  })
})

describe("Shuffle", () => {
  const pile = ["tacocat", "beard-cat", "favor", "nope", "skip", "attack", "defuse", "cattermelon", "see-the-future", "hairy-potato-cat"]
  const table = (seed?: number) => rig(3, { hands: { ana: ["shuffle", "tacocat"], bob: ["nope"] }, deck: pile, turn: "ana", seed })
  const state = table()
  const shuffled = playThrough(state, "ana", "shuffle")

  it("puts the same cards of the pile in another order", () => {
    expect([...deckTitles(shuffled)].sort()).toEqual([...pile].sort())
    expect(deckTitles(shuffled)).not.toEqual(pile)
    expectIntegrity(shuffled)
  })

  it("gives the cards of the pile new ids: nobody can follow a card through a shuffle", () => {
    expect(shuffled.deck.filter((id) => state.deck.includes(id))).toEqual([])
    expect(new Set(shuffled.deck).size).toBe(pile.length)
  })

  it("leaves every other card where it was, under the same id", () => {
    expect(shuffled.hands[1]).toEqual(state.hands[1])
    expect(handTitles(shuffled, "ana")).toEqual(["tacocat"])
    expect(idOf(shuffled, "ana", "tacocat")).toBe(idOf(state, "ana", "tacocat"))
    expect(discardTitles(shuffled)).toEqual(["shuffle"])
  })

  it("is decided by the game: the same table shuffles the same way", () => {
    expect(playThrough(state, "ana", "shuffle")).toStrictEqual(shuffled)
  })

  it("does not shuffle every table the same way", () => {
    const orders = [1, 2, 3].map((i) => deckTitles(playThrough(table(seedOf(i)), "ana", "shuffle")).join())
    expect(new Set(orders).size).toBe(3)
  })

  it("shuffles the pile in another way each time: the stream of the game goes on from one shuffle to the next", () => {
    const twice = rig(3, { hands: { ana: ["shuffle", "shuffle"], bob: ["nope"] }, deck: pile, turn: "ana" })
    const first = playThrough(twice, "ana", "shuffle")
    const second = playThrough(first, "ana", "shuffle")
    // Where each title of the pile went. A shuffle that began from the same point of the stream as the last one would send every card to
    // the same place again
    const moves = (from: readonly string[], to: readonly string[]) => from.map((title) => to.indexOf(title)).join()
    expect(moves(deckTitles(first), deckTitles(second))).not.toBe(moves(pile, deckTitles(first)))
  })

  it("does not end the turn", () => {
    expect([shuffled.turn, shuffled.owed, shuffled.attacked]).toEqual([0, 1, false])
    expect(shuffled.phase).toEqual({ kind: "turn" })
    expect(shuffled.stats[0]?.turns).toBe(0)
  })

  it("tells everybody that the pile was shuffled, and nothing else", () => {
    const { events } = trace(state, play("ana", "shuffle"), pass("bob"), pass("cleo"))
    expect(kinds(events)).toEqual(["play", "resolved", "shuffle"])
    expect(events[2]).toEqual({ event: { kind: "shuffle", by: "ana" } })
  })

  it("makes everybody forget the top of the pile", () => {
    const seeing = rig(3, { hands: { ana: ["see-the-future", "shuffle"] }, deck: pile, turn: "ana" })
    const seen = playThrough(seeing, "ana", "see-the-future")
    expect(seen.known).toEqual({ ana: 3 })
    expect(playThrough(seen, "ana", "shuffle").known).toEqual({})
  })

  it("is cancelled by a Nope: the pile and what is known of it stay as they were", () => {
    const seeing = rig(3, { hands: { ana: ["see-the-future", "shuffle"], bob: ["nope"] }, deck: pile, turn: "ana" })
    const seen = playThrough(seeing, "ana", "see-the-future")
    const noped = passAll(run(seen, play("ana", "shuffle"), nope("bob")))
    expect(noped.deck).toEqual(seen.deck)
    expect(noped.known).toEqual({ ana: 3 })
    expect(discardTitles(noped)).toEqual(["nope", "shuffle", "see-the-future"])
  })

  it("works on an empty pile", () => {
    const empty = rig(2, { hands: { ana: ["shuffle"] }, deck: [], turn: "ana" })
    const after = playThrough(empty, "ana", "shuffle")
    expect(after.deck).toEqual([])
    expect(after.phase).toEqual({ kind: "turn" })
    expectIntegrity(after)
  })
})

describe("See the Future", () => {
  const pile = ["favor", "nope", "skip", "attack", "tacocat"]
  const state = rig(3, { hands: { ana: ["see-the-future"], bob: ["nope"] }, deck: pile, turn: "ana" })
  const seen = playThrough(state, "ana", "see-the-future")

  it("shows the top three cards, in order, to the player who played it and to nobody else", () => {
    const { events } = trace(state, play("ana", "see-the-future"), pass("bob"), pass("cleo"))
    expect(events.at(-1)).toEqual({
      event: { kind: "see", by: "ana", count: 3, cards: state.deck.slice(0, 3).map((id, i) => ({ id, type: pile[i] })) },
      to: ["ana"],
      masked: { kind: "see", by: "ana", count: 3 },
    })
  })

  it("changes nothing in the pile, the hands or the turn", () => {
    expect(seen.deck).toEqual(state.deck)
    expect([seen.turn, seen.owed, seen.attacked]).toEqual([0, 1, false])
    expect(seen.phase).toEqual({ kind: "turn" })
    expect(discardTitles(seen)).toEqual(["see-the-future"])
    expectIntegrity(seen)
  })

  it("is remembered: the player who looked knows three cards of the pile, and nobody else knows any", () => {
    expect(seen.known).toEqual({ ana: 3 })
  })

  it("shows fewer cards when the pile is short", () => {
    for (const size of [2, 1]) {
      const table = rig(3, { hands: { ana: ["see-the-future"] }, deck: pile.slice(0, size), turn: "ana" })
      expect(playThrough(table, "ana", "see-the-future").known, `a pile of ${size}`).toEqual({ ana: size })
    }
  })

  it("shows nothing when the pile is empty", () => {
    const table = rig(2, { hands: { ana: ["see-the-future"] }, deck: [], turn: "ana" })
    const { state: after, events } = trace(table, play("ana", "see-the-future"), pass("bob"))
    expect(after.known).toEqual({})
    expect(events.at(-1)).toEqual({
      event: { kind: "see", by: "ana", count: 0, cards: [] },
      to: ["ana"],
      masked: { kind: "see", by: "ana", count: 0 },
    })
  })

  it("is cancelled by a Nope: nothing is seen", () => {
    const { state: after, events } = trace(state, play("ana", "see-the-future"), nope("bob"), pass("ana"), pass("cleo"))
    expect(kinds(events)).toEqual(["play", "nope", "cancelled"])
    expect(after.known).toEqual({})
  })

  it("is forgotten card by card as the pile is drawn", () => {
    // ana, bob and cleo draw one card each: the three cards ana saw are gone
    const afterAna = run(seen, draw("ana"))
    expect(afterAna.known).toEqual({ ana: 2 })
    const afterBob = run(afterAna, draw("bob"))
    expect(afterBob.known).toEqual({ ana: 1 })
    expect(run(afterBob, draw("cleo")).known).toEqual({})
  })

  it("is kept by each player apart from the others", () => {
    const both = rig(3, { hands: { ana: ["see-the-future"], bob: ["see-the-future"] }, deck: pile, turn: "ana" })
    const afterAna = run(playThrough(both, "ana", "see-the-future"), draw("ana"))
    expect(afterAna.known).toEqual({ ana: 2 })
    const afterBob = playThrough(afterAna, "bob", "see-the-future")
    expect(afterBob.known).toEqual({ ana: 2, bob: 3 })
    expect(run(afterBob, draw("bob")).known).toEqual({ ana: 1, bob: 2 })
  })

  it("is counted again, not added, when played twice in a turn", () => {
    const twice = rig(3, { hands: { ana: ["see-the-future", "see-the-future"] }, deck: pile, turn: "ana" })
    expect(playThrough(playThrough(twice, "ana", "see-the-future"), "ana", "see-the-future").known).toEqual({ ana: 3 })
  })
})
