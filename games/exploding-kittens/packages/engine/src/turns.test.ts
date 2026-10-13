import { describe, expect, it } from "vitest"
import {
  CATS,
  deckTitles,
  discardTitles,
  draw,
  expectIntegrity,
  expectRefused,
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
  trace,
} from "./test-utils"

describe("drawing", () => {
  const state = rig(3, { hands: { ana: ["tacocat"] }, deck: ["beard-cat", "favor", "nope"], turn: "ana" })

  it("takes the top card of the draw pile into the hand", () => {
    const next = run(state, draw("ana"))
    expect(handTitles(next, "ana")).toEqual(["beard-cat", "tacocat"])
    expect(deckTitles(next)).toEqual(["favor", "nope"])
  })

  it("ends the turn: the next player starts a plain one", () => {
    const next = run(state, draw("ana"))
    expect([next.turn, next.owed, next.attacked]).toEqual([1, 1, false])
    expect(next.phase).toEqual({ kind: "turn" })
    expectIntegrity(next)
  })

  it("counts the turn for the player", () => {
    expect(run(state, draw("ana")).stats[0]).toEqual({ turns: 1, defused: 0, nopes: 0 })
  })

  it("shows the card to the player who drew it, and tells the others only that a card was drawn", () => {
    const { events } = trace(state, draw("ana"))
    expect(events).toEqual([
      {
        event: { kind: "draw", by: "ana", card: { id: state.deck[0], type: "beard-cat" } },
        to: ["ana"],
        masked: { kind: "draw", by: "ana" },
      },
      { event: { kind: "turn", player: "bob", owed: 1 } },
    ])
  })

  it("does not touch the state it is given", () => {
    const before = structuredClone(state)
    run(state, draw("ana"))
    expect(state).toStrictEqual(before)
  })

  it("is refused when the pile is empty", () => {
    expectRefused(rig(2, { deck: [], turn: "ana" }), draw("ana"), "EMPTY_DECK")
  })

  it("is refused to a player whose turn it is not", () => {
    expectRefused(state, draw("bob"), "NOT_YOUR_TURN")
    expectRefused(state, draw("cleo"), "NOT_YOUR_TURN")
  })

  it("is refused to somebody who is not at the table", () => {
    expectRefused(state, draw("zoe"), "NOT_YOUR_TURN")
  })

  it("cannot be done twice in a row: the turn has passed", () => {
    expectRefused(run(state, draw("ana")), draw("ana"), "NOT_YOUR_TURN")
  })
})

describe("the order of play", () => {
  it("goes round the table, the last seat handing the turn to the first", () => {
    let state = rig(4, { deck: CATS, turn: "ana" })
    const order: number[] = []
    for (const id of ["ana", "bob", "cleo", "dan", "ana"]) {
      order.push(state.turn)
      state = run(state, draw(id))
    }
    expect(order).toEqual([0, 1, 2, 3, 0])
    expect(state.turn).toBe(1)
  })

  it("skips the players who are out", () => {
    expect(run(rig(4, { out: ["bob"], deck: CATS, turn: "ana" }), draw("ana")).turn).toBe(2)
    expect(run(rig(4, { out: ["ana"], deck: CATS, turn: "dan" }), draw("dan")).turn).toBe(1)
    expect(run(rig(4, { out: ["bob", "cleo"], deck: CATS, turn: "ana" }), draw("ana")).turn).toBe(3)
  })

  it("does not wait for a player who is out", () => {
    expectRefused(rig(3, { out: ["bob"], deck: CATS, turn: "ana" }), draw("bob"), "NOT_YOUR_TURN")
  })
})

describe("a turn", () => {
  it("lets the player play as many cards as they like before they draw", () => {
    const state = rig(3, { hands: { ana: ["shuffle", "see-the-future", "tacocat"] }, deck: CATS, turn: "ana" })
    const played = playThrough(playThrough(state, "ana", "shuffle"), "ana", "see-the-future")
    expect([played.turn, played.owed, played.attacked]).toEqual([0, 1, false])
    expect(played.phase).toEqual({ kind: "turn" })
    expect(discardTitles(played)).toEqual(["see-the-future", "shuffle"])
    expect(played.stats[0]?.turns).toBe(0)
    expectIntegrity(played)

    const drawn = run(played, draw("ana"))
    expect(drawn.turn).toBe(1)
    expect(drawn.stats[0]?.turns).toBe(1)
    expect(handTitles(drawn, "ana")).toHaveLength(2)
  })

  it("lets the player draw without playing anything", () => {
    expect(run(rig(2, { deck: CATS, turn: "bob" }), draw("bob")).turn).toBe(0)
  })

  it("refuses a card played out of turn", () => {
    const state = rig(3, { hands: { ana: ["skip"], bob: ["skip"] }, deck: CATS, turn: "ana" })
    expectRefused(state, play("bob", "skip"), "NOT_YOUR_TURN")
    expectRefused(state, (on) => ({ type: "play", playerId: "zoe", card: idOf(on, "bob", "skip") }), "NOT_YOUR_TURN")
  })
})

describe("Skip", () => {
  const state = rig(3, { hands: { ana: ["skip", "skip"], bob: ["skip"] }, deck: CATS, turn: "ana" })

  it("ends the turn without drawing", () => {
    const next = playThrough(state, "ana", "skip")
    expect([next.turn, next.owed, next.attacked]).toEqual([1, 1, false])
    expect(deckTitles(next)).toEqual(CATS)
    expect(handTitles(next, "ana")).toEqual(["skip"])
    expect(discardTitles(next)).toEqual(["skip"])
    expect(next.stats[0]?.turns).toBe(1)
    expectIntegrity(next)
  })

  it("tells what happened, in order", () => {
    const { events } = trace(state, play("ana", "skip"), pass("bob"), pass("cleo"))
    expect(kinds(events)).toEqual(["play", "resolved", "skip", "turn"])
    expect(events.at(-1)?.event).toEqual({ kind: "turn", player: "bob", owed: 1 })
  })

  it("does nothing before the window has closed: the turn is still the player's", () => {
    const open = run(state, play("ana", "skip"))
    expect(open.turn).toBe(0)
    expect(open.phase.kind).toBe("reaction")
    expect(discardTitles(open)).toEqual(["skip"])
  })

  it("is cancelled by a Nope: the turn goes on, and the player may still draw", () => {
    const noped = rig(3, { hands: { ana: ["skip"], bob: ["nope"] }, deck: CATS, turn: "ana" })
    const after = passAll(run(noped, play("ana", "skip"), nope("bob")))
    expect([after.turn, after.owed, after.attacked]).toEqual([0, 1, false])
    expect(after.phase).toEqual({ kind: "turn" })
    expect(discardTitles(after)).toEqual(["nope", "skip"])
    expect(after.stats[0]?.turns).toBe(0)
    expect(run(after, draw("ana")).turn).toBe(1)
  })

  it("ends only one of the turns that are owed", () => {
    const attacked = rig(3, { hands: { bob: ["skip", "skip"] }, deck: CATS, turn: "bob", owed: 2, attacked: true })
    const once = playThrough(attacked, "bob", "skip")
    expect([once.turn, once.owed, once.attacked]).toEqual([1, 1, true])
    expect(deckTitles(once)).toEqual(CATS)
    const twice = playThrough(once, "bob", "skip")
    expect([twice.turn, twice.owed, twice.attacked]).toEqual([2, 1, false])
    expect(twice.stats[1]?.turns).toBe(2)
  })

  it("leaves the turns that are owed alone when it is cancelled", () => {
    const attacked = rig(3, { hands: { bob: ["skip"], cleo: ["nope"] }, deck: CATS, turn: "bob", owed: 2, attacked: true })
    const after = passAll(run(attacked, play("bob", "skip"), nope("cleo")))
    expect([after.turn, after.owed, after.attacked]).toEqual([1, 2, true])
  })

  it("hands the turn to the next player who is still in the game", () => {
    const table = rig(4, { out: ["bob"], hands: { ana: ["skip"] }, deck: CATS, turn: "ana" })
    expect(playThrough(table, "ana", "skip").turn).toBe(2)
  })
})

describe("Attack", () => {
  const state = rig(3, { hands: { ana: ["attack"], bob: ["attack"] }, deck: CATS, turn: "ana" })

  it("ends the turn without drawing and gives the next player two turns", () => {
    const next = playThrough(state, "ana", "attack")
    expect([next.turn, next.owed, next.attacked]).toEqual([1, 2, true])
    expect(deckTitles(next)).toEqual(CATS)
    expect(discardTitles(next)).toEqual(["attack"])
    expect(next.stats[0]?.turns).toBe(1)
    expectIntegrity(next)
  })

  it("tells what happened, in order", () => {
    const { events } = trace(state, play("ana", "attack"), pass("bob"), pass("cleo"))
    expect(kinds(events)).toEqual(["play", "resolved", "attack", "turn"])
    expect(events[2]?.event).toEqual({ kind: "attack", by: "ana", next: "bob", owed: 2 })
    expect(events[3]?.event).toEqual({ kind: "turn", player: "bob", owed: 2 })
  })

  it("puts the card on the discard at once, before anyone has answered", () => {
    const open = run(state, play("ana", "attack"))
    expect(discardTitles(open)).toEqual(["attack"])
    expect(handTitles(open, "ana")).toEqual([])
    expect(open.turn).toBe(0)
  })

  it("makes the attacked player take both turns, one draw each", () => {
    const attacked = playThrough(state, "ana", "attack")
    const once = run(attacked, draw("bob"))
    expect([once.turn, once.owed, once.attacked]).toEqual([1, 1, true])
    expect(handTitles(once, "bob")).toEqual(["attack", "cattermelon"])
    const twice = run(once, draw("bob"))
    expect([twice.turn, twice.owed, twice.attacked]).toEqual([2, 1, false])
    expect(handTitles(twice, "bob")).toEqual(["attack", "cattermelon", "cattermelon"])
    expect(twice.stats[1]?.turns).toBe(2)
  })

  it("works with two players: the attacker plays again after the two turns", () => {
    const duel = rig(2, { hands: { ana: ["attack"] }, deck: CATS, turn: "ana" })
    const attacked = playThrough(duel, "ana", "attack")
    expect([attacked.turn, attacked.owed]).toEqual([1, 2])
    const back = run(attacked, draw("bob"), draw("bob"))
    expect([back.turn, back.owed, back.attacked]).toEqual([0, 1, false])
  })

  it("goes to the next player who is still in the game", () => {
    const table = rig(4, { out: ["bob"], hands: { ana: ["attack"] }, deck: CATS, turn: "ana" })
    const next = playThrough(table, "ana", "attack")
    expect([next.turn, next.owed]).toEqual([2, 2])
  })

  it("played back by the attacked player: the next one owes 4, the 2 that were owed plus 2", () => {
    const back = playThrough(playThrough(state, "ana", "attack"), "bob", "attack")
    expect([back.turn, back.owed, back.attacked]).toEqual([2, 4, true])
    expect(back.stats[1]?.turns).toBe(1)
  })

  it("played back in a duel: the first attacker owes 4", () => {
    const duel = rig(2, { hands: { ana: ["attack"], bob: ["attack"] }, deck: CATS, turn: "ana" })
    const back = playThrough(playThrough(duel, "ana", "attack"), "bob", "attack")
    expect([back.turn, back.owed, back.attacked]).toEqual([0, 4, true])
  })

  it("played on the second of two turns: the next one owes what was left plus 2", () => {
    const second = run(playThrough(state, "ana", "attack"), draw("bob"))
    expect([second.turn, second.owed, second.attacked]).toEqual([1, 1, true])
    const back = playThrough(second, "bob", "attack")
    expect([back.turn, back.owed, back.attacked]).toEqual([2, 3, true])
  })

  it("stacks: 2, then 4, then 6, and the last player draws six times", () => {
    let table = rig(4, { hands: { ana: ["attack"], bob: ["attack"], cleo: ["attack"] }, deck: CATS, turn: "ana" })
    table = playThrough(table, "ana", "attack")
    expect([table.turn, table.owed]).toEqual([1, 2])
    table = playThrough(table, "bob", "attack")
    expect([table.turn, table.owed]).toEqual([2, 4])
    table = playThrough(table, "cleo", "attack")
    expect([table.turn, table.owed, table.attacked]).toEqual([3, 6, true])
    for (const owed of [5, 4, 3, 2, 1]) {
      table = run(table, draw("dan"))
      expect([table.turn, table.owed], `after a draw, ${owed} to go`).toEqual([3, owed])
    }
    table = run(table, draw("dan"))
    expect([table.turn, table.owed, table.attacked]).toEqual([0, 1, false])
    expect(handTitles(table, "dan")).toHaveLength(6)
    expect(deckTitles(table)).toHaveLength(2)
    expectIntegrity(table)
  })

  it("owes 2 again to whoever follows a player who was not attacked", () => {
    const afterDraw = run(state, draw("ana"))
    expect([afterDraw.turn, afterDraw.owed, afterDraw.attacked]).toEqual([1, 1, false])
    const attacked = playThrough(afterDraw, "bob", "attack")
    expect([attacked.turn, attacked.owed, attacked.attacked]).toEqual([2, 2, true])
  })

  it("owes 2 again once the attacked player has taken their turns: the attack is over", () => {
    // ana attacks bob, bob draws twice, cleo plays a plain turn and attacks dan: 2, not 4
    const table = rig(4, { hands: { ana: ["attack"], cleo: ["attack"] }, deck: CATS, turn: "ana" })
    const afterBob = run(playThrough(table, "ana", "attack"), draw("bob"), draw("bob"))
    expect([afterBob.turn, afterBob.owed, afterBob.attacked]).toEqual([2, 1, false])
    const attacked = playThrough(afterBob, "cleo", "attack")
    expect([attacked.turn, attacked.owed, attacked.attacked]).toEqual([3, 2, true])
  })

  it("is cancelled by a Nope: nothing changes", () => {
    const noped = rig(3, { hands: { ana: ["attack"], bob: ["nope"] }, deck: CATS, turn: "ana" })
    const after = passAll(run(noped, play("ana", "attack"), nope("bob")))
    expect([after.turn, after.owed, after.attacked]).toEqual([0, 1, false])
    expect(discardTitles(after)).toEqual(["nope", "attack"])
    expect(after.stats.map(({ turns }) => turns)).toEqual([0, 0, 0])
    expect(run(after, draw("ana")).turn).toBe(1)
  })

  it("is cancelled by a Nope, even when the player owes turns: they are still owed", () => {
    const attacked = rig(3, { hands: { bob: ["attack"], cleo: ["nope"] }, deck: CATS, turn: "bob", owed: 2, attacked: true })
    const after = passAll(run(attacked, play("bob", "attack"), nope("cleo")))
    expect([after.turn, after.owed, after.attacked]).toEqual([1, 2, true])
  })

  it("goes through when the Nope is Noped", () => {
    const table = rig(3, { hands: { ana: ["attack", "nope"], bob: ["nope"] }, deck: CATS, turn: "ana" })
    const after = passAll(run(table, play("ana", "attack"), nope("bob"), nope("ana")))
    expect([after.turn, after.owed, after.attacked]).toEqual([1, 2, true])
    expect(discardTitles(after)).toEqual(["nope", "nope", "attack"])
  })
})

describe("what a player may not do", () => {
  const state = rig(3, { hands: { ana: ["tacocat", "nope", "defuse", "skip"], bob: ["skip"] }, deck: CATS, turn: "ana" })

  it("play a card they do not hold", () => {
    expectRefused(state, (on) => ({ type: "play", playerId: "ana", card: idOf(on, "bob", "skip") }), "UNKNOWN_CARD")
    expectRefused(state, { type: "play", playerId: "ana", card: -1 }, "UNKNOWN_CARD")
  })

  it("play a card that is not played on its own: a cat, a Nope, a Defuse", () => {
    for (const title of ["tacocat", "nope", "defuse"]) expectRefused(state, play("ana", title), "NOT_PLAYABLE")
  })

  it("answer a window that is not there", () => {
    expectRefused(state, { type: "pass", playerId: "bob", chain: 0 }, "NOT_WAITING")
    expectRefused(state, (on) => ({ type: "nope", playerId: "bob", card: idOf(on, "ana", "nope"), chain: 0 }), "NOT_WAITING")
  })

  it("do what belongs to another phase: put a Kitten back, answer a Favor, take from the discard", () => {
    expectRefused(state, { type: "defuse", playerId: "ana", position: 0 }, "INVALID_ACTION")
    expectRefused(state, (on) => ({ type: "give", playerId: "ana", card: idOf(on, "ana", "tacocat") }), "INVALID_ACTION")
    expectRefused(state, { type: "pick", playerId: "ana", card: 0 }, "INVALID_ACTION")
  })

  const malformed: [string, unknown][] = [
    ["nothing", undefined],
    ["null", null],
    ["a string", "draw"],
    ["a number", 42],
    ["a list", []],
    ["an empty object", {}],
    ["no player", { type: "draw" }],
    ["a player that is not a string", { type: "draw", playerId: 7 }],
    ["no type", { playerId: "ana" }],
    ["a type that does not exist", { type: "explode", playerId: "ana" }],
    ["a type that is not a string", { type: 5, playerId: "ana" }],
    ["a type of the prototype", { type: "toString", playerId: "ana" }],
    ["a play without a card", { type: "play", playerId: "ana" }],
    ["a card that is not a number", { type: "play", playerId: "ana", card: "7" }],
    ["a card that is not a whole number", { type: "play", playerId: "ana", card: 1.5 }],
    ["a card that is not finite", { type: "play", playerId: "ana", card: Number.POSITIVE_INFINITY }],
    ["cards that are not a list", { type: "combo", playerId: "ana", cards: 3 }],
    ["cards that are not numbers", { type: "combo", playerId: "ana", cards: ["a", "b"] }],
    ["a Nope without a chain", { type: "nope", playerId: "bob", card: 1 }],
    ["a pass without a chain", { type: "pass", playerId: "bob" }],
    ["a pass with a chain that is not a number", { type: "pass", playerId: "bob", chain: "0" }],
  ]

  it.each(malformed)("send what is not an action: %s", (_what, input) => {
    expectRefused(state, input, "INVALID_ACTION")
  })
})

describe("after the end", () => {
  // ana draws an Exploding Kitten and holds no Defuse: bob is the last one in
  const over = run(rig(2, { hands: { ana: ["tacocat"] }, deck: ["exploding-kitten", "beard-cat"], turn: "ana" }), draw("ana"))

  it("is over, with ana out", () => {
    expect(over.phase).toEqual({ kind: "over" })
    expect(over.out).toEqual(["ana"])
    expectIntegrity(over)
  })

  it("refuses everything", () => {
    expectRefused(over, draw("bob"), "GAME_OVER")
    expectRefused(over, draw("ana"), "GAME_OVER")
    expectRefused(over, { type: "pass", playerId: "bob", chain: 0 }, "GAME_OVER")
    expectRefused(over, { type: "play", playerId: "bob", card: 0 }, "GAME_OVER")
    expectRefused(over, undefined, "GAME_OVER")
    expectRefused(over, {}, "GAME_OVER")
  })
})
