import { playFor, playOn, waitingPlayers } from "@pbgo/engine-kit"
import { describe, expect, it } from "vitest"
import { debugCommands } from "./debug"
import { GAME } from "./game"
import { ORIGINAL_RULES } from "./rules"
import {
  CATS,
  comboThrough,
  deckTitles,
  deepFreeze,
  discardTitles,
  draw,
  expectIntegrity,
  expectSerializable,
  handIds,
  handTitles,
  idOf,
  kittensInPlay,
  living,
  newState,
  nope,
  playThrough,
  rig,
  run,
  seedOf,
  viewOf,
} from "./test-utils"
import type { State } from "./types"
import { resolveWindow } from "./window"

/**
 * The debug panel (`GAME.debug`), for development: commands that play a turn or a whole game out, and commands that rig the table
 * for the player whose turn it is. They are no rules, but a state they make has to be as sound as one the rules make, and the
 * ones that move cards must leave nothing behind about the draw pile that a player could still read in their view.
 */

const REST = ["cattermelon", "cattermelon", "hairy-potato-cat", "hairy-potato-cat"]
const FIVE = ["tacocat", "beard-cat", "skip", "favor", "shuffle"]
/** The Exploding Kittens of a table of `n`: one fewer than players. */
const kittens = (n: number): string[] => Array.from({ length: n - 1 }, () => "exploding-kitten")

const COMMANDS = ["attackMe", "closeWindow", "giveDefuse", "giveNope", "kittenOnTop", "over", "stripDefuse", "turn"]
/** The commands that move cards or change the turns owed: they act between two plays only. */
const RIGGING = ["attackMe", "giveDefuse", "giveNope", "kittenOnTop", "stripDefuse"]

function command(name: string): (state: State) => State {
  const found = GAME.debug?.[name]
  if (!found) throw new Error(`The game has no debug command "${name}"`)
  return found
}

// One table in each phase of the game, as in game.test.ts. Every pile holds the Kittens a table of its size has, so that a game played on
// from there ends

/** Four players, bob to play: a Skip and a Defuse in his hand, a Nope in the hands of ana and dan. */
const turn = rig(4, {
  hands: { ana: ["nope", "tacocat"], bob: ["skip", "defuse"], cleo: ["beard-cat"], dan: ["nope", "defuse"] },
  deck: [...CATS, ...kittens(4)],
  turn: "bob",
})
/** bob played the Skip: ana, cleo and dan may answer. */
const reaction = run(turn, (state) => ({ type: "play", playerId: "bob", card: idOf(state, "bob", "skip") }))
/** ana drew an Exploding Kitten and holds a Defuse. */
const defusing = run(
  rig(3, { hands: { ana: ["tacocat", "defuse"], bob: ["skip"] }, deck: ["exploding-kitten", ...REST, "exploding-kitten"], turn: "ana" }),
  draw("ana"),
)
/** ana played a Favor, bob has to give her a card. */
const giving = playThrough(
  rig(3, {
    hands: { ana: ["favor", "tacocat"], bob: ["skip", "nope"], cleo: ["beard-cat"] },
    deck: [...CATS, ...kittens(3)],
    turn: "ana",
  }),
  "ana",
  "favor",
  "bob",
)
/** ana played five different cards, she takes a card of the discard. */
const picking = comboThrough(
  rig(3, {
    hands: { ana: [...FIVE, "nope"], bob: ["defuse"], cleo: ["see-the-future"] },
    discard: ["attack", "exploding-kitten", "tacocat"],
    deck: [...CATS, ...kittens(3)],
    turn: "ana",
  }),
  "ana",
  FIVE,
)
/** ana drew an Exploding Kitten and holds no Defuse: bob wins. */
const over = run(rig(2, { hands: { ana: ["tacocat"], bob: ["skip"] }, deck: ["exploding-kitten", ...REST], turn: "ana" }), draw("ana"))

const TABLES: [string, State][] = [
  ["turn", turn],
  ["reaction", reaction],
  ["defuse", defusing],
  ["give", giving],
  ["pick", picking],
  ["over", over],
]
/** The tables where the game is held up by something: a window, a Kitten, a Favor, a pick, or nothing at all any more. */
const HELD_UP = TABLES.filter(([phase]) => phase !== "turn")

/** What the server does for an absent player, until the turn is over. */
function playedOut(state: State): State {
  const { turn: seat, owed } = state
  let s = state
  while (!GAME.isOver(s) && s.turn === seat && s.owed === owed) s = playFor(GAME, s, waitingPlayers(GAME, s)[0]!)
  return s
}

describe("the commands", () => {
  it("are the eight of the panel", () => {
    expect(Object.keys(GAME.debug ?? {}).sort()).toEqual(COMMANDS)
    expect(Object.keys(debugCommands(ORIGINAL_RULES)).sort()).toEqual(COMMANDS)
    for (const name of COMMANDS) expect(command(name), name).toBeTypeOf("function")
  })

  describe.each(COMMANDS)("%s", (name) => {
    it.each(TABLES)("leaves a sound state, that is stored and shown as any other, in phase %s", (_phase, table) => {
      const next = command(name)(table)
      expectIntegrity(next)
      expectSerializable(next)
      for (const viewer of [null, ...next.seats]) expect(() => viewOf(next, viewer), String(viewer)).not.toThrow()
    })

    it.each(TABLES)("never writes into a state in phase %s", (_phase, table) => {
      const frozen = deepFreeze(structuredClone(table))
      expect(() => command(name)(frozen)).not.toThrow()
      expect(frozen).toStrictEqual(table)
    })

    it.each(TABLES)("gives the same state each time, in phase %s", (_phase, table) => {
      expect(command(name)(table)).toStrictEqual(command(name)(table))
    })

    it.each(TABLES)("leaves a game that can be played to its end, in phase %s", (_phase, table) => {
      const end = playOn(GAME, command(name)(table))
      expect(GAME.isOver(end)).toBe(true)
      expect(living(end)).toHaveLength(1)
    })

    it("leaves a game that can be played to its end, for 2 to 5 players", () => {
      for (const n of [2, 3, 4, 5]) {
        for (let i = 0; i < 3; i++) {
          const next = command(name)(newState(n, seedOf(n * 10 + i)))
          expectIntegrity(next)
          const end = playOn(GAME, next)
          expect(GAME.isOver(end), `${n} players, game ${i}`).toBe(true)
          expect(living(end), `${n} players, game ${i}`).toHaveLength(1)
        }
      }
    })
  })
})

describe("turn", () => {
  it("plays for the player the game waits for, as the server does for an absent one", () => {
    for (const n of [2, 3, 4, 5]) {
      for (let i = 0; i < 5; i++) {
        const state = newState(n, seedOf(n * 10 + i))
        expect(command("turn")(state), `${n} players, game ${i}`).toStrictEqual(playedOut(state))
      }
    }
  })

  it("hands the table to the next player, or ends the game", () => {
    for (const n of [2, 3, 4, 5]) {
      for (let i = 0; i < 5; i++) {
        const state = newState(n, seedOf(n * 10 + i))
        const next = command("turn")(state)
        expect(GAME.isOver(next) || next.turn === (state.turn + 1) % n, `${n} players, game ${i}`).toBe(true)
      }
    }
  })

  it.each(HELD_UP.filter(([phase]) => phase !== "over"))("plays on from a table held up in phase %s, until the turn is over", (_phase, table) => {
    const next = command("turn")(table)
    expect(next).toStrictEqual(playedOut(table))
    expect(GAME.isOver(next) || next.turn !== table.turn || next.owed !== table.owed).toBe(true)
  })

  it("closes the window of the Skip, which ends the turn of its author", () => {
    const next = command("turn")(reaction)
    expect(next.phase).toEqual({ kind: "turn" })
    expect(next.turn).toBe(reaction.seats.indexOf("cleo"))
    expect(discardTitles(next)[0]).toBe("skip")
  })

  it("has the player who was asked for a card give one, then draw", () => {
    const next = command("turn")(giving)
    expect(handIds(next, "bob")).toHaveLength(1)
    expect(handIds(next, "ana")).toHaveLength(3)
    expect(next.turn).toBe(next.seats.indexOf("bob"))
  })

  it("takes a card of the discard for the player of the five different cards", () => {
    const next = command("turn")(picking)
    expect(handIds(next, "ana")).toHaveLength(3)
    expect(next.turn).toBe(next.seats.indexOf("bob"))
  })

  it("puts the Kitten of a player who defuses it back, and ends their turn", () => {
    const next = command("turn")(defusing)
    expect(kittensInPlay(next)).toBe(2)
    expect(next.turn).toBe(next.seats.indexOf("bob"))
    expect(next.out).toEqual([])
  })

  it("leaves a game that is over as it is", () => {
    expect(command("turn")(over)).toStrictEqual(over)
  })

  describe("after attackMe", () => {
    const table = rig(3, { hands: { ana: ["tacocat"] }, deck: [...CATS, ...kittens(3)] })

    it("plays the turns the player owes one at a time", () => {
      const attacked = command("attackMe")(table)
      const first = command("turn")(attacked)
      expect([first.turn, first.owed, first.attacked]).toEqual([0, 1, true])
      expect(handTitles(first, "ana")).toEqual(["cattermelon", "tacocat"])
      const second = command("turn")(first)
      expect([second.turn, second.owed, second.attacked]).toEqual([1, 1, false])
      expect(handTitles(second, "ana")).toEqual(["cattermelon", "cattermelon", "tacocat"])
    })
  })
})

describe("over", () => {
  it("plays the game to the end, as playOn does", () => {
    for (const n of [2, 3, 4, 5]) {
      for (let i = 0; i < 5; i++) {
        const state = newState(n, seedOf(n * 10 + i))
        const end = command("over")(state)
        expect(end, `${n} players, game ${i}`).toStrictEqual(playOn(GAME, state))
        expect(GAME.isOver(end)).toBe(true)
        expect(viewOf(end, null).results?.winners, `${n} players, game ${i}`).toEqual(living(end))
      }
    }
  })

  it.each(HELD_UP)("plays on from a table held up in phase %s", (_phase, table) => {
    const end = command("over")(table)
    expect(GAME.isOver(end)).toBe(true)
    expectIntegrity(end)
  })

  it("leaves a game that is over as it is", () => {
    expect(command("over")(over)).toStrictEqual(over)
  })
})

describe("kittenOnTop", () => {
  const table = rig(3, {
    hands: { ana: ["tacocat"] },
    deck: ["beard-cat", "cattermelon", "exploding-kitten", "skip", "exploding-kitten"],
  })

  it("makes the first Exploding Kitten of the draw pile its next card, the others staying in order", () => {
    const next = command("kittenOnTop")(table)
    expect(deckTitles(next)).toEqual(["exploding-kitten", "beard-cat", "cattermelon", "skip", "exploding-kitten"])
  })

  it("only moves the card: same ids, same hands, same discard", () => {
    const next = command("kittenOnTop")(table)
    expect([...next.deck].sort()).toEqual([...table.deck].sort())
    expect(next.ids).toEqual(table.ids)
    expect(next.hands).toEqual(table.hands)
    expect(next.discard).toEqual(table.discard)
  })

  it("leaves a pile as it is when the Kitten is on top already, or when there is none", () => {
    const onTop = rig(3, { hands: { ana: ["tacocat"] }, deck: ["exploding-kitten", "beard-cat"] })
    const none = rig(3, { hands: { ana: ["tacocat"] }, deck: ["beard-cat", "skip"] })
    expect(command("kittenOnTop")(onTop)).toStrictEqual(onTop)
    expect(command("kittenOnTop")(none)).toStrictEqual(none)
  })

  it("makes the player draw a Kitten they have to defuse", () => {
    const start = newState(3, seedOf(1))
    const after = run(command("kittenOnTop")(start), draw(start.seats[start.turn]!))
    expect(after.phase.kind).toBe("defuse")
  })
})

describe.each([
  ["giveNope", "nope"],
  ["giveDefuse", "defuse"],
])("%s", (name, title) => {
  const give = command(name)
  const copies = (state: State, playerId: string): number => handTitles(state, playerId).filter((card) => card === title).length

  it("takes the card from the draw pile first", () => {
    const table = rig(3, {
      hands: { ana: ["tacocat"], bob: [title] },
      deck: ["beard-cat", title, "cattermelon"],
      discard: [title],
    })
    const next = give(table)
    expect(handTitles(next, "ana")).toEqual([title, "tacocat"])
    expect(deckTitles(next)).toEqual(["beard-cat", "cattermelon"])
    expect(discardTitles(next)).toEqual([title])
    expect(handTitles(next, "bob")).toEqual([title])
    expectIntegrity(next)
  })

  it("then from the discard", () => {
    const table = rig(3, {
      hands: { ana: ["tacocat"], bob: [title] },
      deck: ["beard-cat", "cattermelon"],
      discard: ["skip", title],
    })
    const next = give(table)
    expect(handTitles(next, "ana")).toEqual([title, "tacocat"])
    expect(discardTitles(next)).toEqual(["skip"])
    expect(handTitles(next, "bob")).toEqual([title])
    expectIntegrity(next)
  })

  it("then from the hand of another player, where it was", () => {
    const table = rig(3, { hands: { ana: ["tacocat"], bob: [title, "skip"], cleo: ["beard-cat"] }, deck: ["cattermelon"] })
    const next = give(table)
    expect(handTitles(next, "ana")).toEqual([title, "tacocat"])
    expect(handTitles(next, "bob")).toEqual(["skip"])
    expect(handTitles(next, "cleo")).toEqual(["beard-cat"])
    expectIntegrity(next)
  })

  it("brings it under a new id, as a card that goes back into hiding", () => {
    const table = rig(3, { hands: { ana: ["tacocat"] }, deck: ["beard-cat", title] })
    const before = table.deck[1]!
    const next = give(table)
    const held = idOf(next, "ana", title)
    expect(held).not.toBe(before)
    expect(next.ids).not.toContain(before)
    expect(next.ids).toHaveLength(table.ids.length)
  })

  it("does not take a card from the player who is to hold it", () => {
    const own = rig(3, { hands: { ana: ["tacocat", title] }, deck: ["beard-cat"] })
    expect(give(own)).toStrictEqual(own)
    expect(copies(give(own), "ana")).toBe(1)
  })

  it("changes nothing when there is none to take", () => {
    const none = rig(3, { hands: { ana: ["tacocat"], bob: ["skip"] }, deck: ["beard-cat"], discard: ["attack"] })
    expect(give(none)).toStrictEqual(none)
  })

  it("is for the player whose turn it is", () => {
    const table = rig(3, { hands: { ana: ["tacocat"], bob: ["skip"] }, deck: ["beard-cat", title], turn: "bob" })
    const next = give(table)
    expect(handTitles(next, "bob")).toEqual(["skip", title].sort())
    expect(handTitles(next, "ana")).toEqual(["tacocat"])
  })
})

describe("stripDefuse", () => {
  it("puts every Defuse of the player whose turn it is on the discard", () => {
    const table = rig(3, { hands: { ana: ["defuse", "tacocat", "defuse"], bob: ["defuse"] }, discard: ["skip"] })
    const next = command("stripDefuse")(table)
    expect(handTitles(next, "ana")).toEqual(["tacocat"])
    expect(discardTitles(next)).toEqual(["defuse", "defuse", "skip"])
    expect(handTitles(next, "bob")).toEqual(["defuse"])
    expectIntegrity(next)
  })

  it("changes nothing for a player who holds none", () => {
    const table = rig(3, { hands: { ana: ["tacocat"], bob: ["defuse"] }, discard: ["skip"] })
    expect(command("stripDefuse")(table)).toStrictEqual(table)
  })

  it("leaves the player out at the next Kitten they draw, when the Kitten is on top", () => {
    for (let i = 0; i < 4; i++) {
      const start = newState(3, seedOf(i))
      const player = start.seats[start.turn]!
      const doomed = command("kittenOnTop")(command("stripDefuse")(start))
      expect(deckTitles(doomed)[0]).toBe("exploding-kitten")
      const after = run(doomed, draw(player))
      expect(after.out, `game ${i}`).toEqual([player])
      expect(after.phase.kind).toBe("turn")
    }
  })

  it("is undone by giveDefuse", () => {
    const start = newState(3, seedOf(2))
    const player = start.seats[start.turn]!
    const stripped = command("stripDefuse")(start)
    expect(handTitles(stripped, player)).not.toContain("defuse")
    expect(handTitles(command("giveDefuse")(stripped), player)).toContain("defuse")
  })
})

describe("attackMe", () => {
  it("gives the player whose turn it is two turns", () => {
    const table = rig(3, { hands: { ana: ["tacocat"] } })
    const next = command("attackMe")(table)
    expect([next.turn, next.owed, next.attacked]).toEqual([0, 2, true])
    expect(next.hands).toEqual(table.hands)
    expect(next.deck).toEqual(table.deck)
  })

  it("adds two more to a player who is attacked already", () => {
    const table = rig(3, { hands: { ana: ["tacocat"] }, owed: 2, attacked: true })
    const next = command("attackMe")(table)
    expect([next.owed, next.attacked]).toEqual([4, true])
  })

  it("gives what an Attack gives to the player after the one who plays it", () => {
    const attacked = playThrough(rig(3, { hands: { ana: ["attack"], bob: ["tacocat"] }, deck: CATS }), "ana", "attack")
    const rigged = command("attackMe")(rig(3, { hands: { bob: ["tacocat"] }, deck: CATS, turn: "bob" }))
    expect([rigged.turn, rigged.owed, rigged.attacked]).toEqual([attacked.turn, attacked.owed, attacked.attacked])
  })
})

describe("closeWindow", () => {
  it("is what a timer would do: resolveWindow", () => {
    expect(command("closeWindow")(reaction)).toStrictEqual(resolveWindow(ORIGINAL_RULES, reaction).state)
  })

  it("lets the card go through when nobody has played a Nope", () => {
    const next = command("closeWindow")(reaction)
    expect(next.phase).toEqual({ kind: "turn" })
    expect(next.turn).toBe(next.seats.indexOf("cleo"))
  })

  it("cancels the card when the Nopes played are odd", () => {
    const next = command("closeWindow")(run(reaction, nope("dan")))
    expect(next.phase).toEqual({ kind: "turn" })
    expect(next.turn).toBe(next.seats.indexOf("bob"))
    expect(discardTitles(next).slice(0, 2)).toEqual(["nope", "skip"])
  })

  it("lets the card go through when the Nopes played are even", () => {
    const next = command("closeWindow")(run(reaction, nope("dan"), nope("ana")))
    expect(next.turn).toBe(next.seats.indexOf("cleo"))
    expect(discardTitles(next).slice(0, 3)).toEqual(["nope", "nope", "skip"])
  })

  it.each(TABLES.filter(([phase]) => phase !== "reaction"))("changes nothing when no window is open, in phase %s", (_phase, table) => {
    expect(command("closeWindow")(table)).toStrictEqual(table)
  })
})

describe("the commands that rig the table", () => {
  const seen = playThrough(
    rig(3, {
      hands: { ana: ["see-the-future", "tacocat"], bob: ["nope", "defuse"] },
      deck: ["beard-cat", "cattermelon", "exploding-kitten", "skip", "nope", "defuse"],
      discard: ["nope", "defuse"],
    }),
    "ana",
    "see-the-future",
  )

  it("act between two plays only: in the middle of a window, a Kitten, a Favor or a pick they change nothing", () => {
    for (const name of RIGGING) {
      for (const [phase, table] of HELD_UP) expect(command(name)(table), `${name} in phase ${phase}`).toStrictEqual(table)
    }
  })

  it("leave the draw pile, the Kittens in it and the cards of the players who are not named as they were found", () => {
    for (const name of RIGGING.filter((n) => n !== "kittenOnTop")) {
      const next = command(name)(turn)
      expect(kittensInPlay(next), name).toBe(kittensInPlay(turn))
    }
    expect(kittensInPlay(command("kittenOnTop")(turn))).toBe(kittensInPlay(turn))
  })

  it.each(RIGGING)("%s makes nobody remember what the top of the draw pile was", (name) => {
    expect(viewOf(seen, "ana").me?.top).toHaveLength(3)
    const next = command(name)(seen)
    expect(next.known).toEqual({})
    for (const viewer of [null, ...next.seats]) expect(viewOf(next, viewer).me?.top ?? [], `${name}, ${String(viewer)}`).toEqual([])
  })
})
