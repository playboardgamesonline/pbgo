import { describe, expect, it } from "vitest"
import { results } from "./results"
import {
  deckTitles,
  defuse,
  discardTitles,
  draw,
  expectIntegrity,
  expectRefused,
  handTitles,
  idOf,
  idsOf,
  kinds,
  kittensInPlay,
  nope,
  pass,
  play,
  rig,
  run,
  titleOf,
  trace,
} from "./test-utils"
import type { State } from "./types"

/** What is left of a pile once its Kitten has been drawn: four cats. */
const REST = ["cattermelon", "cattermelon", "hairy-potato-cat", "hairy-potato-cat"]

/** The Kitten a player holds in the air while they choose where it goes back. */
function kittenInAir(state: State): number {
  if (state.phase.kind !== "defuse") throw new Error(`Expected a Kitten in the air, not the phase ${state.phase.kind}`)
  return state.phase.kitten
}

describe("an Exploding Kitten drawn by a player who holds a Defuse", () => {
  const state = rig(3, { hands: { ana: ["tacocat", "defuse"], bob: ["skip"] }, deck: ["exploding-kitten", ...REST], turn: "ana" })
  const drawn = run(state, draw("ana"))

  it("is shown to everybody, and so is the Defuse that answers it", () => {
    expect(trace(state, draw("ana")).events).toEqual([
      { event: { kind: "kitten", by: "ana", card: { id: state.deck[0], type: "exploding-kitten" } } },
      { event: { kind: "defused", by: "ana", card: { id: idOf(state, "ana", "defuse"), type: "defuse" } } },
    ])
  })

  it("never goes into the hand: the Defuse goes to the discard and the Kitten is held in the air", () => {
    expect(drawn.phase).toEqual({ kind: "defuse", kitten: state.deck[0] })
    expect(handTitles(drawn, "ana")).toEqual(["tacocat"])
    expect(discardTitles(drawn)).toEqual(["defuse"])
    expect(drawn.deck).toEqual(state.deck.slice(1))
    expect(drawn.out).toEqual([])
    expectIntegrity(drawn)
  })

  it("does not end the turn yet", () => {
    expect([drawn.turn, drawn.owed, drawn.attacked]).toEqual([0, 1, false])
    expect(drawn.stats[0]).toEqual({ turns: 0, defused: 0, nopes: 0 })
  })

  it("uses the first Defuse of the hand, and only one", () => {
    const two = rig(3, { hands: { ana: ["defuse", "tacocat", "defuse"] }, deck: ["exploding-kitten", ...REST], turn: "ana" })
    const after = run(two, draw("ana"))
    expect(handTitles(after, "ana")).toEqual(["defuse", "tacocat"])
    expect(after.discard).toEqual([idsOf(two, "ana", "defuse")[0]])
  })

  it("is not a choice: a player who holds a Defuse cannot be put out by the Kitten", () => {
    expect(drawn.out).toEqual([])
    expect(drawn.phase.kind).toBe("defuse")
  })

  it("waits for the player who drew it, and for their Defuse alone", () => {
    expectRefused(drawn, defuse("bob", 0), "NOT_YOUR_TURN")
    expectRefused(drawn, draw("bob"), "NOT_YOUR_TURN")
    expectRefused(drawn, draw("ana"), "INVALID_ACTION")
    expectRefused(drawn, (on) => ({ type: "play", playerId: "ana", card: idOf(on, "ana", "tacocat") }), "INVALID_ACTION")
    expectRefused(drawn, { type: "combo", playerId: "ana", cards: [] }, "INVALID_ACTION")
    expectRefused(drawn, { type: "give", playerId: "ana", card: 0 }, "INVALID_ACTION")
    expectRefused(drawn, { type: "pick", playerId: "ana", card: 0 }, "INVALID_ACTION")
  })

  it("opens no Nope window: there is nothing to answer", () => {
    expectRefused(drawn, { type: "pass", playerId: "bob", chain: 0 }, "NOT_WAITING")
    expectRefused(drawn, { type: "nope", playerId: "bob", card: 0, chain: 0 }, "NOT_WAITING")
  })

  describe("goes back into the pile", () => {
    it.each([0, 1, 2, 3, 4])("at position %i", (position) => {
      const after = run(drawn, defuse("ana", position))
      expect(deckTitles(after)).toEqual([...REST.slice(0, position), "exploding-kitten", ...REST.slice(position)])
      expect(after.phase).toEqual({ kind: "turn" })
      expectIntegrity(after)
    })

    it("under a new id, so that nobody can follow it", () => {
      const old = kittenInAir(drawn)
      const after = run(drawn, defuse("ana", 2))
      expect(after.ids).not.toContain(old)
      expect(after.deck[2]).not.toBe(old)
      expect(titleOf(after, after.deck[2]!)).toBe("exploding-kitten")
      // the cards around it keep their ids, in their order
      expect(after.deck.filter((_, index) => index !== 2)).toEqual(drawn.deck)
    })

    it("and ends the turn: the next player starts a normal turn", () => {
      const { state: after, events } = trace(drawn, defuse("ana", 2))
      expect([after.turn, after.owed, after.attacked]).toEqual([1, 1, false])
      expect(after.stats[0]).toEqual({ turns: 1, defused: 1, nopes: 0 })
      expect(kinds(events)).toEqual(["reinserted", "turn"])
      expect(events[1]?.event).toEqual({ kind: "turn", player: "bob", owed: 1 })
    })

    it("and only its owner is told where", () => {
      expect(trace(drawn, defuse("ana", 2)).events[0]).toEqual({
        event: { kind: "reinserted", by: "ana", position: 2 },
        to: ["ana"],
        masked: { kind: "reinserted", by: "ana" },
      })
    })

    it("is never lost: it is in the pile, or in the air", () => {
      expect([state, drawn, run(drawn, defuse("ana", 0))].map(kittensInPlay)).toEqual([1, 1, 1])
    })

    it("goes to the top when the pile has no other card", () => {
      const last = rig(2, { hands: { ana: ["defuse"] }, deck: ["exploding-kitten"], turn: "ana" })
      const air = run(last, draw("ana"))
      expect(air.deck).toEqual([])
      expectRefused(air, defuse("ana", 1), "BAD_POSITION")
      expect(deckTitles(run(air, defuse("ana", 0)))).toEqual(["exploding-kitten"])
    })
  })

  describe("is refused", () => {
    it("where the pile has no room, and the player may try again", () => {
      for (const position of [-1, 5, 99]) expectRefused(drawn, defuse("ana", position), "BAD_POSITION")
      expect(run(drawn, defuse("ana", 4)).phase).toEqual({ kind: "turn" })
    })

    it.each<[string, unknown]>([
      ["a fraction", 1.5],
      ["not a number", Number.NaN],
      ["infinite", Number.POSITIVE_INFINITY],
      ["a string", "2"],
      ["null", null],
      ["missing", undefined],
    ])("when the position is %s", (_what, position) => {
      expectRefused(drawn, { type: "defuse", playerId: "ana", position }, "INVALID_ACTION")
    })
  })
})

describe("a Defuse and the turns a player owes", () => {
  it("uses up one of them: an attacked player goes on with the other", () => {
    const attacked = rig(3, { hands: { ana: ["defuse"] }, deck: ["exploding-kitten", ...REST], turn: "ana", owed: 2, attacked: true })
    const { state: after, events } = trace(attacked, draw("ana"), defuse("ana", 1))
    expect([after.turn, after.owed, after.attacked]).toEqual([0, 1, true])
    expect(after.stats[0]?.turns).toBe(1)
    expect(kinds(events)).toEqual(["kitten", "defused", "reinserted", "turn"])
    expect(events.at(-1)?.event).toEqual({ kind: "turn", player: "ana", owed: 1 })
  })

  it("counts every turn of an attacked player: a safe draw, then the Kitten defused", () => {
    const attacked = rig(3, {
      hands: { ana: ["defuse"] },
      deck: ["hairy-potato-cat", "exploding-kitten", "cattermelon", "cattermelon"],
      turn: "ana",
      owed: 2,
      attacked: true,
    })
    const afterFirst = run(attacked, draw("ana"))
    expect([afterFirst.turn, afterFirst.owed, afterFirst.attacked]).toEqual([0, 1, true])
    const after = run(afterFirst, draw("ana"), defuse("ana", 0))
    expect([after.turn, after.owed, after.attacked]).toEqual([1, 1, false])
    expect(after.stats[0]).toEqual({ turns: 2, defused: 1, nopes: 0 })
  })
})

describe("an Exploding Kitten drawn by a player who holds no Defuse", () => {
  const state = rig(4, {
    hands: { ana: ["tacocat", "favor"], bob: ["skip"], cleo: ["nope"], dan: ["attack"] },
    deck: ["exploding-kitten", ...REST],
    discard: ["shuffle"],
    turn: "ana",
  })
  const { state: after, events } = trace(state, draw("ana"))

  it("puts the player out", () => {
    expect(after.out).toEqual(["ana"])
    expect(after.hands[0]).toEqual([])
    expect(after.phase).toEqual({ kind: "turn" })
    expectIntegrity(after)
  })

  it("shows the Kitten, then the hand it took down, to everybody", () => {
    expect(kinds(events)).toEqual(["kitten", "exploded", "turn"])
    const faces = [...state.hands[0]!, state.deck[0]!].map((id) => ({ id, type: titleOf(state, id) }))
    expect(events[1]).toEqual({ event: { kind: "exploded", by: "ana", cards: faces } })
  })

  it("puts the hand and the Kitten on the discard, the Kitten on top", () => {
    expect(discardTitles(after)).toEqual(["exploding-kitten", "favor", "tacocat", "shuffle"])
  })

  it("passes the turn to the next player, who takes a normal single turn", () => {
    expect([after.turn, after.owed, after.attacked]).toEqual([1, 1, false])
    expect(events[2]?.event).toEqual({ kind: "turn", player: "bob", owed: 1 })
  })

  it("does not count the turn it ended", () => {
    expect(after.stats[0]?.turns).toBe(0)
  })

  it("leaves the player no more moves", () => {
    expectRefused(after, draw("ana"), "NOT_YOUR_TURN")
    expectRefused(after, { type: "give", playerId: "ana", card: 0 }, "NOT_YOUR_TURN")
  })

  it("makes the turns the player still owed vanish", () => {
    const owing = rig(3, { hands: { ana: ["tacocat"] }, deck: ["exploding-kitten", ...REST], turn: "ana", owed: 3, attacked: true })
    const { state: gone, events: told } = trace(owing, draw("ana"))
    expect([gone.turn, gone.owed, gone.attacked]).toEqual([1, 1, false])
    expect(told.at(-1)?.event).toEqual({ kind: "turn", player: "bob", owed: 1 })
  })

  it("skips the players who are out already", () => {
    const table = rig(4, {
      hands: { ana: ["tacocat"], cleo: ["skip"], dan: ["nope"] },
      deck: ["exploding-kitten", ...REST],
      out: ["bob"],
      turn: "ana",
    })
    const gone = run(table, draw("ana"))
    expect(gone.out).toEqual(["bob", "ana"])
    expect(gone.turn).toBe(2)
    expectIntegrity(gone)
  })

  it("makes them forget the cards of the pile they knew, and keeps what the others know", () => {
    const knowing: State = { ...state, known: { ana: 3, bob: 2 } }
    expect(run(knowing, draw("ana")).known).toEqual({ bob: 1 })
  })

  it("is the end of the game when only one player is left", () => {
    const duel = rig(2, { hands: { ana: ["tacocat"], bob: ["skip"] }, deck: ["exploding-kitten", ...REST], turn: "ana" })
    const { state: over, events: told } = trace(duel, draw("ana"))
    expect(kinds(told)).toEqual(["kitten", "exploded", "over"])
    expect(told[2]?.event).toEqual({ kind: "over", winner: "bob" })
    expect(over.phase).toEqual({ kind: "over" })
    expect(over.out).toEqual(["ana"])
    expectIntegrity(over)
  })
})

describe("what the players know of the top of the pile when a Kitten goes back", () => {
  // ana and bob both know the top three cards, the Kitten among them
  const state: State = {
    ...rig(3, { hands: { ana: ["defuse", "tacocat"] }, deck: ["exploding-kitten", ...REST], turn: "ana" }),
    known: { ana: 3, bob: 3 },
  }
  const drawn = run(state, draw("ana"))

  it("lowers it as soon as the Kitten leaves the pile, as for any card drawn", () => {
    expect(drawn.known).toEqual({ ana: 2, bob: 2 })
  })

  it.each<[number, Record<string, number>]>([
    [0, {}],
    [1, { ana: 1 }],
    [2, { ana: 2 }],
    [3, { ana: 2 }],
    [4, { ana: 2 }],
  ])("lets the player who puts it back keep the cards above it: position %i", (position, kept) => {
    const after = run(drawn, defuse("ana", position))
    expect(after.known).toEqual(kept)
    expectIntegrity(after)
  })

  it("makes everybody else forget, wherever it goes: the size of what they know would tell where it is", () => {
    for (const position of [0, 1, 2, 3, 4]) {
      expect(Object.keys(run(drawn, defuse("ana", position)).known), `position ${position}`).not.toContain("bob")
    }
  })

  it("keeps nothing for a player who knew nothing", () => {
    const strangers: State = { ...state, known: { bob: 3 } }
    for (const position of [0, 2, 4]) expect(run(strangers, draw("ana"), defuse("ana", position)).known, `position ${position}`).toEqual({})
  })
})

describe("the ranking", () => {
  // ana defuses the first Kitten and puts it back on top; bob draws it and is out; cleo draws a cat; ana draws the next Kitten and is out
  const table = rig(3, {
    hands: { ana: ["defuse"], bob: ["nope"], cleo: ["skip"] },
    deck: ["exploding-kitten", "hairy-potato-cat", "exploding-kitten", "exploding-kitten"],
    turn: "ana",
  })
  const final = run(table, draw("ana"), defuse("ana", 0), draw("bob"), draw("cleo"), draw("ana"))
  const scores = (state: State) =>
    Object.fromEntries(
      (results(state)?.players ?? []).map(({ playerId, detail }) => [playerId, Object.fromEntries(detail.map(({ key, points }) => [key, points]))]),
    )

  it("does not exist while the game is on", () => {
    expect(results(table)).toBeNull()
    expect(results(run(table, draw("ana")))).toBeNull()
  })

  it("puts the last player in first, then the others from the last one out", () => {
    expect(final.phase).toEqual({ kind: "over" })
    expect(final.out).toEqual(["bob", "ana"])
    const ranking = results(final)
    expect(ranking?.winners).toEqual(["cleo"])
    expect(ranking?.players.map(({ playerId, rank, total }) => [playerId, rank, total])).toEqual([
      ["cleo", 1, 2],
      ["ana", 2, 1],
      ["bob", 3, 0],
    ])
  })

  it("tells the opponents each player outlasted, the turns they took and the Kittens they defused", () => {
    expect(scores(final)).toEqual({
      cleo: { outlasted: 2, turnsSurvived: 1, kittensDefused: 0, nopesPlayed: 0 },
      ana: { outlasted: 1, turnsSurvived: 1, kittensDefused: 1, nopesPlayed: 0 },
      bob: { outlasted: 0, turnsSurvived: 0, kittensDefused: 0, nopesPlayed: 0 },
    })
  })

  it("lists the same details, in the same order, for every player", () => {
    for (const { detail } of results(final)?.players ?? []) {
      expect(detail.map(({ key }) => key)).toEqual(["outlasted", "turnsSurvived", "kittensDefused", "nopesPlayed"])
      expect(detail.every(({ label }) => label.length > 0)).toBe(true)
    }
  })

  it("counts the Nopes a player played, a Nope that cancelled something or not", () => {
    // bob plays a Skip, ana Nopes it; bob then draws the Kitten ana put back on top, and is out
    const duel = rig(2, {
      hands: { ana: ["defuse", "nope"], bob: ["skip"] },
      deck: ["exploding-kitten", "cattermelon", "cattermelon"],
      turn: "ana",
    })
    const over = run(duel, draw("ana"), defuse("ana", 0), play("bob", "skip"), nope("ana"), pass("bob"), draw("bob"))
    expect(over.phase).toEqual({ kind: "over" })
    expect(scores(over)).toEqual({
      ana: { outlasted: 1, turnsSurvived: 1, kittensDefused: 1, nopesPlayed: 1 },
      bob: { outlasted: 0, turnsSurvived: 0, kittensDefused: 0, nopesPlayed: 0 },
    })
  })
})
