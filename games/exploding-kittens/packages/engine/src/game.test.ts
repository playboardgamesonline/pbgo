import { type OptionValues, canPlayFor, defaultOptions, isEngineError, playFor, playOn, waitingPlayers } from "@pbgo/engine-kit"
import { afterEach, describe, expect, it, vi } from "vitest"
import { step } from "./actions"
import { GAME, createGame } from "./game"
import { OPTIONS } from "./options"
import { ORIGINAL_RULES } from "./rules"
import {
  CATS,
  PLAYER_IDS,
  type Move,
  codeOf,
  combo,
  comboThrough,
  deckTitles,
  deepFreeze,
  defuse,
  discardTitles,
  draw,
  expectIntegrity,
  expectSerializable,
  handTitles,
  kittensInPlay,
  living,
  newState,
  nope,
  pass,
  passAll,
  play,
  playThrough,
  players,
  problems,
  reorderKeys,
  rig,
  run,
  seedOf,
} from "./test-utils"
import { type Action, CLIENT_ACTIONS, type State } from "./types"
import { resolveWindow } from "./window"

/**
 * The game as the platform sees it (`GAME`): what @pbgo/core calls, through the helpers of the kit that core uses to know who the
 * game waits for and to play for an absent player. The rules themselves are tested in the files of each part of the game.
 */

const REST = ["cattermelon", "cattermelon", "hairy-potato-cat", "hairy-potato-cat"]
const FIVE = ["tacocat", "beard-cat", "skip", "favor", "shuffle"]
/** The Exploding Kittens of a table of `n`: one fewer than players. */
const kittens = (n: number): string[] => Array.from({ length: n - 1 }, () => "exploding-kitten")

// One table in each phase of the game. Every pile holds the Kittens a table of its size has, so that a game played on from there ends

/** Four players, bob to play: a Skip and a Defuse in his hand, a Nope in the hands of ana and dan. */
const turn = rig(4, {
  hands: { ana: ["nope", "tacocat"], bob: ["skip", "defuse"], cleo: ["beard-cat"], dan: ["nope", "defuse"] },
  deck: [...CATS, ...kittens(4)],
  turn: "bob",
})
/** bob played the Skip: ana, cleo and dan may answer. */
const reaction = run(turn, play("bob", "skip"))
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

const waiting = (state: State): string[] => waitingPlayers(GAME, state)
/** What the server does for an absent player. */
const playedFor = (state: State, playerId: string): State => playFor(GAME, state, playerId)
const act = (state: State, move: Move): Action => (typeof move === "function" ? move(state) : move)

describe("the definition", () => {
  it("is Exploding Kittens, for 2 to 5 players", () => {
    expect(GAME.id).toBe("exploding-kittens")
    expect(GAME.name).toBe("Exploding Kittens")
    expect([GAME.minPlayers, GAME.maxPlayers]).toEqual([2, 5])
  })

  it("lets a client send the eight actions of a player, and nothing else", () => {
    expect([...GAME.clientActions].sort()).toEqual(["combo", "defuse", "draw", "give", "nope", "pass", "pick", "play"])
    expect(GAME.clientActions).toBe(CLIENT_ACTIONS)
  })

  it("knows who it waits for and can play for them (engine contract v2)", () => {
    expect(GAME.waitingFor).toBeTypeOf("function")
    expect(GAME.autoPlayFor).toBeTypeOf("function")
    expect(canPlayFor(GAME)).toBe(true)
  })

  it("does not carry the deprecated hooks", () => {
    expect(GAME.activePlayer).toBeUndefined()
    expect(GAME.autoPlay).toBeUndefined()
  })

  it("offers the options of OPTIONS, with the Original rules on by default", () => {
    expect(GAME.options).toBe(OPTIONS)
    expect(Object.keys(GAME.options).sort()).toEqual(["classicDeal", "fasterGame", "fiveDifferent"])
    expect(defaultOptions(GAME.options)).toEqual({ fiveDifferent: true, fasterGame: false, classicDeal: false })
  })

  it("offers the debug commands of the contract", () => {
    expect(GAME.debug?.turn).toBeTypeOf("function")
    expect(GAME.debug?.over).toBeTypeOf("function")
  })

  it("is what createGame makes of the Original rules", () => {
    const made = createGame(ORIGINAL_RULES)
    expect(Object.keys(made).sort()).toEqual(Object.keys(GAME).sort())
    const args = { players: players(3), options: {}, seed: seedOf(4) }
    expect(made.setup(args)).toStrictEqual(GAME.setup(args))
    for (const [, table] of TABLES) expect(playOn(made, table)).toStrictEqual(playOn(GAME, table))
  })
})

describe("setup", () => {
  afterEach(() => vi.restoreAllMocks())

  const setup = (n: number, options: OptionValues = {}, seed: number = seedOf(n)): State => GAME.setup({ players: players(n), options, seed })

  it.each([2, 3, 4, 5])("sets up a table of %i, ready for the first player", (n) => {
    const state = setup(n)
    expect(state.seats).toEqual(PLAYER_IDS.slice(0, n))
    expect(state.phase).toEqual({ kind: "turn" })
    expect(GAME.isOver(state)).toBe(false)
    expect(kittensInPlay(state)).toBe(n - 1)
    expect(waiting(state)).toEqual([state.seats[state.turn]])
    expectIntegrity(state)
    expectSerializable(state)
  })

  it("falls back on the default options when the lobby sends none", () => {
    expect(setup(3, {}).options).toEqual({ fiveDifferent: true, fasterGame: false, classicDeal: false })
    expect(setup(3, {})).toStrictEqual(setup(3, defaultOptions(GAME.options)))
  })

  it("takes the options of the table", () => {
    expect(setup(2, { fasterGame: true, fiveDifferent: false }).options).toEqual({ fiveDifferent: false, fasterGame: true, classicDeal: false })
    expect(setup(4, { classicDeal: true }).options).toEqual({ fiveDifferent: true, fasterGame: false, classicDeal: true })
  })

  it("refuses a table that is too small, too big, or whose players are not different", () => {
    const six = [...players(5), { id: "fay", nickname: "FAY" }]
    const twins = [{ id: "ana", nickname: "A" }, { id: "ana", nickname: "B" }]
    for (const list of [[], players(1), six, twins]) {
      expect(codeOf(() => GAME.setup({ players: list, options: {}, seed: seedOf(0) })), String(list.length)).toBe("INVALID_PLAYERS")
    }
  })

  it("deals the same game from the same seed, and another from another seed", () => {
    expect(setup(4, {}, seedOf(9))).toStrictEqual(setup(4, {}, seedOf(9)))
    expect(deckTitles(setup(4, {}, seedOf(9)))).not.toEqual(deckTitles(setup(4, {}, seedOf(10))))
  })

  it("draws a seed when it is not given, and it is the only thing that is random", () => {
    const random = vi.spyOn(Math, "random").mockReturnValue(0.25)
    const first = GAME.setup({ players: players(3), options: {} })
    expect(random).toHaveBeenCalled()
    expect(GAME.setup({ players: players(3), options: {} })).toStrictEqual(first)
    expectIntegrity(first)
  })

  it("does not look at the clock or at Math.random when it has a seed", () => {
    const random = vi.spyOn(Math, "random")
    const now = vi.spyOn(Date, "now")
    for (const n of [2, 3, 4, 5]) setup(n)
    expect(random).not.toHaveBeenCalled()
    expect(now).not.toHaveBeenCalled()
  })
})

describe("apply", () => {
  it("is the state of a step", () => {
    expect(GAME.apply(turn, draw("bob"))).toStrictEqual(step(ORIGINAL_RULES, turn, draw("bob")).state)
    expect(GAME.apply(reaction, act(reaction, nope("dan")))).toStrictEqual(step(ORIGINAL_RULES, reaction, act(reaction, nope("dan"))).state)
  })

  it("moves the game on, one action after the other", () => {
    let state = turn
    state = GAME.apply(state, act(state, play("bob", "skip")))
    expect(state.phase.kind).toBe("reaction")
    state = GAME.apply(state, act(state, nope("dan")))
    state = GAME.apply(state, act(state, pass("ana")))
    state = GAME.apply(state, act(state, pass("bob")))
    state = GAME.apply(state, act(state, pass("cleo")))
    // the Nope cancelled the Skip: bob still has to draw
    expect(state.phase).toEqual({ kind: "turn" })
    expect(waiting(state)).toEqual(["bob"])
    expectIntegrity(state)
  })

  it("refuses what the rules refuse with an EngineError, and leaves the state as it was", () => {
    const before = structuredClone(turn)
    const refused = (state: State, action: unknown) => codeOf(() => GAME.apply(state, action as Action))
    expect(refused(turn, draw("ana"))).toBe("NOT_YOUR_TURN")
    expect(refused(turn, { type: "draw", playerId: "zoe" })).toBe("NOT_YOUR_TURN")
    expect(refused(turn, { type: "defuse", playerId: "bob", position: 0 })).toBe("INVALID_ACTION")
    expect(refused(turn, { type: "dance", playerId: "bob" })).toBe("INVALID_ACTION")
    expect(refused(reaction, draw("bob"))).toBe("REACTION_OPEN")
    expect(turn).toStrictEqual(before)
  })

  it("refuses any action once the game is over", () => {
    expect(codeOf(() => GAME.apply(over, draw("bob")))).toBe("GAME_OVER")
    expect(codeOf(() => GAME.apply(over, draw("ana")))).toBe("GAME_OVER")
  })

  it("says the game is over exactly in the phase over", () => {
    for (const [name, table] of TABLES) expect(GAME.isOver(table), name).toBe(name === "over")
  })
})

describe("waitingFor", () => {
  it("is the player whose turn it is", () => {
    expect(waiting(turn)).toEqual(["bob"])
    for (const n of [2, 3, 4, 5]) {
      for (let i = 0; i < 10; i++) {
        const state = newState(n, seedOf(i))
        expect(waiting(state), `${n} players, game ${i}`).toEqual([state.seats[state.turn]])
      }
    }
  })

  it("is everybody who may answer a card, in the order of the seats", () => {
    expect(waiting(reaction)).toEqual(["ana", "cleo", "dan"])
    expect(GAME.waitingFor!(reaction)).toEqual(["ana", "cleo", "dan"])
  })

  it("keeps the order of the seats, not the order in which the players answered", () => {
    expect(waiting(run(reaction, pass("dan")))).toEqual(["ana", "cleo", "dan"])
    expect(waiting(run(reaction, pass("dan"), pass("ana")))).toEqual(["ana", "cleo", "dan"])
  })

  it("does not drop a player who passed: who passed is hidden", () => {
    const passed = run(reaction, pass("cleo"))
    expect(waiting(passed)).toEqual(waiting(reaction))
    // …and they may still change their mind while the window is open
    expect(run(passed, nope("ana"), pass("bob")).phase.kind).toBe("reaction")
    const changed = run(passed, nope("ana"))
    expect(changed.phase.kind === "reaction" && changed.phase.nopes.map(({ by }) => by)).toEqual(["ana"])
  })

  it("is everybody but the last to play a card, once a Nope has been played: the player who began is back in", () => {
    expect(waiting(run(reaction, nope("dan")))).toEqual(["ana", "bob", "cleo"])
    expect(waiting(run(reaction, nope("dan"), nope("ana")))).toEqual(["bob", "cleo", "dan"])
  })

  it("is exactly the players who may answer", () => {
    for (const id of reaction.seats) {
      const accepted = ((): boolean => {
        try {
          run(reaction, pass(id))
          return true
        } catch {
          return false
        }
      })()
      expect(accepted, id).toBe(waiting(reaction).includes(id))
    }
  })

  it("never lists a player who is out", () => {
    const table = rig(4, {
      hands: { ana: ["nope"], cleo: ["skip"], dan: ["nope", "defuse"] },
      out: ["bob"],
      deck: [...CATS, ...kittens(3)],
      turn: "cleo",
    })
    expect(waiting(table)).toEqual(["cleo"])
    const window = run(table, play("cleo", "skip"))
    expect(waiting(window)).toEqual(["ana", "dan"])
    expect(waiting(run(window, nope("dan")))).toEqual(["ana", "cleo"])
  })

  it("is the player who puts the Kitten back", () => {
    expect(waiting(defusing)).toEqual(["ana"])
  })

  it("is the player who gives the card of a Favor, not the one who asked", () => {
    expect(giving.phase).toEqual({ kind: "give", from: "bob", to: "ana" })
    expect(waiting(giving)).toEqual(["bob"])
  })

  it("is the player who takes a card of the discard", () => {
    expect(waiting(picking)).toEqual(["ana"])
  })

  it("is nobody once the game is over", () => {
    expect(GAME.waitingFor!(over)).toEqual([])
    expect(waiting(over)).toEqual([])
  })

  it("holds players of the table, once each, and never reads the order of the keys", () => {
    for (const [name, table] of TABLES) {
      const list = waiting(table)
      expect(new Set(list).size, name).toBe(list.length)
      expect(list.every((id) => table.seats.includes(id) && !table.out.includes(id)), name).toBe(true)
      expect(list, name).toEqual(table.seats.filter((id) => list.includes(id)))
      expect(waiting(reorderKeys(JSON.parse(JSON.stringify(table)))), name).toEqual(list)
    }
  })
})

describe("autoPlayFor", () => {
  describe("is refused when the game is not waiting for the player", () => {
    it.each<[string, State, string[]]>([
      ["turn", turn, ["ana", "cleo", "dan", "zoe"]],
      ["reaction", reaction, ["bob", "zoe"]],
      ["defuse", defusing, ["bob", "cleo", "zoe"]],
      ["give", giving, ["ana", "cleo", "zoe"]],
      ["pick", picking, ["bob", "cleo", "zoe"]],
      ["over", over, ["ana", "bob", "zoe"]],
    ])("in phase %s", (_phase, state, others) => {
      const before = structuredClone(state)
      for (const id of others) {
        expect(codeOf(() => GAME.autoPlayFor!(state, id)), id).toBe("NOT_WAITING")
        expect(codeOf(() => playFor(GAME, state, id)), id).toBe("NOT_WAITING")
      }
      expect(state).toStrictEqual(before)
    })
  })

  describe("a turn", () => {
    it("draws, as the player would have if they had nothing to play", () => {
      expect(playedFor(turn, "bob")).toStrictEqual(GAME.apply(turn, draw("bob")))
    })

    it("plays no card: the hand grows by the card drawn and the turn goes on to the next player", () => {
      const after = playedFor(turn, "bob")
      expect(handTitles(after, "bob")).toEqual(["cattermelon", "defuse", "skip"])
      expect(after.discard).toEqual(turn.discard)
      expect(waiting(after)).toEqual(["cleo"])
    })

    it("leaves the player waiting again when they owe another turn: that is a new step", () => {
      const attacked = rig(3, { hands: { ana: ["skip"], bob: ["skip"], cleo: ["skip"] }, deck: [...CATS, ...kittens(3)], turn: "bob", owed: 2, attacked: true })
      const after = playedFor(attacked, "bob")
      expect(after.owed).toBe(1)
      expect(waiting(after)).toEqual(["bob"])
    })
  })

  describe("a Nope window", () => {
    it("closes it for everybody: whoever has not answered is taken to have passed", () => {
      const closed = playedFor(reaction, "ana")
      expect(closed.phase).toEqual({ kind: "turn" })
      expect(closed).toStrictEqual(passAll(reaction))
      expect(closed).toStrictEqual(resolveWindow(ORIGINAL_RULES, reaction).state)
      // the Skip resolved: bob's turn is over
      expect(waiting(closed)).toEqual(["cleo"])
      expect(discardTitles(closed)).toEqual(["skip"])
    })

    it("closes the same window whichever of the responders is played for", () => {
      const closed = waiting(reaction).map((id) => playedFor(reaction, id))
      expect(closed).toHaveLength(3)
      for (const state of closed) expect(state).toStrictEqual(closed[0])
    })

    it("lets a Nope that was played cancel the card, as a window closed by hand does", () => {
      const noped = run(reaction, nope("dan"))
      for (const id of waiting(noped)) {
        const closed = playedFor(noped, id)
        expect(closed, id).toStrictEqual(passAll(noped))
        expect(closed.phase, id).toEqual({ kind: "turn" })
        // the Skip was cancelled: bob still has to draw
        expect(waiting(closed), id).toEqual(["bob"])
        expect(discardTitles(closed), id).toEqual(["nope", "skip"])
        expect(handTitles(closed, "bob"), id).toEqual(["defuse"])
        expectIntegrity(closed)
      }
    })

    it("lets a Nope that was Noped through", () => {
      const closed = playedFor(run(reaction, nope("dan"), nope("ana")), "cleo")
      expect(discardTitles(closed)).toEqual(["nope", "nope", "skip"])
      expect(waiting(closed)).toEqual(["cleo"])
    })
  })

  describe("a Kitten to put back", () => {
    it("puts it back into the pile and ends the turn", () => {
      const after = playedFor(defusing, "ana")
      expect(after.phase).toEqual({ kind: "turn" })
      expect(after.deck).toHaveLength(defusing.deck.length + 1)
      expect(kittensInPlay(after)).toBe(2)
      expect(handTitles(after, "ana")).toEqual(["tacocat"])
      expect(discardTitles(after)).toEqual(["defuse"])
      expect(after.stats[0]!.defused).toBe(1)
      expect(waiting(after)).toEqual(["bob"])
      expectIntegrity(after)
    })

    it("puts it at a position of the pile that the game's stream picks, and any position can come out", () => {
      const positions = new Set<number>()
      for (let i = 0; i < 60; i++) {
        const drawn = run(
          rig(2, { hands: { ana: ["defuse", "tacocat"], bob: ["skip"] }, deck: ["exploding-kitten", ...REST], turn: "ana", seed: seedOf(i) }),
          draw("ana"),
        )
        const after = playedFor(drawn, "ana")
        expect(after.deck).toHaveLength(5)
        positions.add(deckTitles(after).indexOf("exploding-kitten"))
      }
      expect([...positions].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4])
    })

    it("is asked after a draw that turns up a Kitten, to a player who holds a Defuse", () => {
      const table = rig(3, { hands: { ana: ["defuse"], bob: ["skip"] }, deck: ["exploding-kitten", ...REST, "exploding-kitten"], turn: "ana" })
      const drawn = playedFor(table, "ana")
      expect(drawn.phase.kind).toBe("defuse")
      expect(waiting(drawn)).toEqual(["ana"])
      const back = playedFor(drawn, "ana")
      expect(back.phase.kind).toBe("turn")
      expect(waiting(back)).toEqual(["bob"])
    })

    it("lets a player who holds no Defuse explode, and the game goes on without them", () => {
      const table = rig(3, {
        hands: { ana: ["tacocat"], bob: ["skip"], cleo: ["beard-cat"] },
        deck: ["exploding-kitten", ...REST, "exploding-kitten"],
        turn: "ana",
      })
      const after = playedFor(table, "ana")
      expect(after.out).toEqual(["ana"])
      expect(after.phase.kind).toBe("turn")
      expect(waiting(after)).toEqual(["bob"])
      expectIntegrity(after)
    })
  })

  describe("a Favor", () => {
    const seen = new Set<string>()

    /** ana asked bob, who holds `hand`. */
    function asking(hand: string[], seed: number = seedOf(0)): State {
      return playThrough(
        rig(3, { hands: { ana: ["favor"], bob: hand, cleo: ["beard-cat"] }, deck: [...CATS, ...kittens(3)], turn: "ana", seed }),
        "ana",
        "favor",
        "bob",
      )
    }

    it.each<[string[], string]>([
      [["tacocat", "skip", "nope", "defuse"], "tacocat"],
      [["skip", "nope", "defuse"], "skip"],
      [["nope", "defuse"], "nope"],
      [["defuse"], "defuse"],
    ])("makes bob give the card he needs least: %j gives %s", (hand, given) => {
      const state = asking(hand)
      const after = playedFor(state, "bob")
      const kept = [...hand]
      kept.splice(kept.indexOf(given), 1)
      expect(handTitles(after, "ana")).toEqual([given])
      expect(handTitles(after, "bob")).toEqual(kept.sort())
      // the Favor does not end ana's turn
      expect(after.phase).toEqual({ kind: "turn" })
      expect(waiting(after)).toEqual(["ana"])
      expect([after.turn, after.owed, after.attacked]).toEqual([state.turn, state.owed, state.attacked])
      expectIntegrity(after)
    })

    it("picks among the cards of that kind with the game's stream, so that any of them can go", () => {
      for (let i = 0; i < 40; i++) {
        const after = playedFor(asking(["tacocat", "beard-cat", "rainbow-ralphing-cat", "skip"], seedOf(i)), "bob")
        expect(handTitles(after, "bob"), String(i)).toContain("skip")
        seen.add(handTitles(after, "ana")[0]!)
      }
      expect([...seen].sort()).toEqual(["beard-cat", "rainbow-ralphing-cat", "tacocat"])
    })
  })

  describe("five different cards", () => {
    /** ana played five different cards, over a discard that already holds `older`. */
    function choosing(older: string[]): State {
      return comboThrough(
        rig(3, {
          hands: { ana: [...FIVE, "nope"], bob: ["defuse"], cleo: ["see-the-future"] },
          discard: older,
          deck: [...CATS, ...kittens(3)],
          turn: "ana",
        }),
        "ana",
        FIVE,
      )
    }

    it.each<[string[], string]>([
      [["tacocat", "attack", "nope", "defuse"], "defuse"],
      [["tacocat", "attack", "nope"], "nope"],
      [["tacocat", "attack"], "attack"],
      [["tacocat"], "tacocat"],
      [["exploding-kitten", "tacocat"], "tacocat"],
    ])("makes ana take the card she needs most: %j gives %s", (older, taken) => {
      const state = choosing(older)
      expect(state.phase.kind).toBe("pick")
      const after = playedFor(state, "ana")
      expect(handTitles(after, "ana")).toEqual([taken, "nope"].sort())
      // it left the discard, and the five cards just played did not move
      const left = discardTitles(state)
      left.splice(left.indexOf(taken), 1)
      expect(discardTitles(after).sort()).toEqual(left.sort())
      expect(after.discard.slice(0, 5)).toEqual(state.discard.slice(0, 5))
      expect(after.phase).toEqual({ kind: "turn" })
      expect(waiting(after)).toEqual(["ana"])
      expectIntegrity(after)
    })

    it("never takes a card it has just played, even when an older card of the discard has the same title", () => {
      const state = choosing(["tacocat"])
      const after = playedFor(state, "ana")
      const played = state.phase.kind === "pick" ? state.phase.played : []
      expect(played.some((id) => after.discard.includes(id))).toBe(true)
      expect(played.every((id) => after.discard.includes(id))).toBe(true)
    })
  })

  it("is deterministic: the same state is played the same way", () => {
    for (const [name, table] of TABLES) {
      for (const id of waiting(table)) expect(playedFor(table, id), `${name}: ${id}`).toStrictEqual(playedFor(structuredClone(table), id))
    }
  })

  it("does something: the state it returns is not the state it was given", () => {
    for (const [name, table] of TABLES) {
      for (const id of waiting(table)) expect(playedFor(table, id), `${name}: ${id}`).not.toStrictEqual(table)
    }
  })
})

describe("a game played for the players who are not there", () => {
  it.each([2, 3, 4, 5])("ends a table of %i, one legal step after the other", (n) => {
    for (let i = 0; i < 25; i++) {
      let state = GAME.setup({ players: players(n), options: {}, seed: seedOf(i) })
      for (let steps = 0; !GAME.isOver(state); steps++) {
        expect(steps, `game ${i}`).toBeLessThan(400)
        // Nobody plays a card, so no window ever opens: one player waits, and it is always somebody who is in
        expect(waiting(state)).toHaveLength(1)
        const before = state
        state = playedFor(before, waiting(before)[0]!)
        expect(state, `game ${i}, step ${steps}`).not.toStrictEqual(before)
        expect(problems(state), `game ${i}, step ${steps}`).toEqual([])
        // In a game played from the setup, the pile always holds one Kitten fewer than the players left
        expect(kittensInPlay(state), `game ${i}, step ${steps}`).toBe(living(state).length - 1)
      }
      expect(waiting(state)).toEqual([])
      expect(living(state)).toHaveLength(1)
      expect(state.out).toHaveLength(n - 1)
      expect(kittensInPlay(state)).toBe(0)
    }
  })

  it.each(TABLES)("ends from a table in phase %s", (_phase, table) => {
    const end = playOn(GAME, table)
    expect(GAME.isOver(end)).toBe(true)
    expect(problems(end)).toEqual([])
    expect(kittensInPlay(end)).toBe(0)
    // Nobody waits any more: playing on changes nothing
    expect(playOn(GAME, end)).toBe(end)
  })

  it("leaves the winner on the table, and the others out in the order they left", () => {
    const end = playOn(GAME, newState(4, seedOf(3)))
    const [winner] = living(end)
    expect(end.out).toHaveLength(3)
    expect(new Set([...end.out, winner]).size).toBe(4)
  })
})

describe("determinism", () => {
  afterEach(() => vi.restoreAllMocks())

  it("never reads Math.random or the clock once a seed is given", () => {
    const random = vi.spyOn(Math, "random")
    const now = vi.spyOn(Date, "now")
    for (const n of [2, 3, 4, 5]) playOn(GAME, GAME.setup({ players: players(n), options: {}, seed: seedOf(n) }))
    for (const [, table] of TABLES) {
      playOn(GAME, table)
      for (const id of waiting(table)) GAME.autoPlayFor!(table, id)
      for (const command of Object.values(GAME.debug ?? {})) command?.(table)
    }
    expect(random).not.toHaveBeenCalled()
    expect(now).not.toHaveBeenCalled()
  })

  it("plays the same game from the same seed, and not the same from another", () => {
    const ends = new Set<string>()
    for (const n of [2, 3, 4, 5]) {
      const first = playOn(GAME, newState(n, seedOf(n)))
      expect(playOn(GAME, newState(n, seedOf(n))), String(n)).toStrictEqual(first)
    }
    for (let i = 0; i < 20; i++) ends.add(JSON.stringify(playOn(GAME, newState(3, seedOf(i))).out))
    expect(ends.size).toBeGreaterThan(1)
  })

  it("goes on with the random stream where the last step left it: a step that draws on it moves it, any other leaves it", () => {
    const table = rig(3, {
      hands: { ana: ["shuffle", "tacocat", "tacocat", "skip"], bob: ["nope", "favor", "attack"], cleo: ["defuse"] },
      deck: [...CATS, ...kittens(3)],
      turn: "ana",
    })
    const shuffling = run(table, play("ana", "shuffle"))
    const stealing = run(table, combo("ana", ["tacocat", "tacocat"], "bob"))
    const unmoved: [State, State][] = [
      [table, shuffling],
      [shuffling, run(shuffling, pass("bob"))],
      [shuffling, run(shuffling, nope("bob"))],
      [table, run(table, draw("ana"))],
      [defusing, run(defusing, defuse("ana", 1))],
    ]
    const moved: [State, State][] = [
      [run(shuffling, pass("bob")), run(shuffling, pass("bob"), pass("cleo"))],
      [stealing, passAll(stealing)],
      [defusing, playedFor(defusing, "ana")],
    ]
    unmoved.forEach(([before, after], index) => expect(after.rng, `step ${index}`).toBe(before.rng))
    moved.forEach(([before, after], index) => expect(after.rng, `step ${index}`).not.toBe(before.rng))
  })
})

describe("a state stored as jsonb", () => {
  it.each(TABLES)("comes back from JSON as it left, in phase %s", (_phase, table) => {
    expectSerializable(table)
  })

  it.each(TABLES)("is played on in the same way from a state whose keys come back in another order, in phase %s", (_phase, table) => {
    const stored = reorderKeys(JSON.parse(JSON.stringify(table)) as State)
    expect(waiting(stored)).toEqual(waiting(table))
    for (const id of waiting(table)) expect(playedFor(stored, id), id).toStrictEqual(playedFor(table, id))
    expect(playOn(GAME, stored)).toStrictEqual(playOn(GAME, table))
  })

  it("applies an action in the same way, whatever the order of the keys", () => {
    const stored = reorderKeys(JSON.parse(JSON.stringify(reaction)) as State)
    for (const move of [nope("dan"), nope("ana"), pass("cleo"), pass("ana")]) {
      expect(GAME.apply(stored, act(stored, move))).toStrictEqual(GAME.apply(reaction, act(reaction, move)))
    }
  })

  it("plays every step of a whole game in the same way, whatever the order of the keys", () => {
    for (const n of [2, 3, 4, 5]) {
      let state = newState(n, seedOf(n))
      while (!GAME.isOver(state)) {
        const [next] = waiting(state)
        const stored = reorderKeys(JSON.parse(JSON.stringify(state)) as State)
        expect(waiting(stored)).toEqual(waiting(state))
        const after = playedFor(state, next!)
        expect(playedFor(stored, next!)).toStrictEqual(after)
        state = after
      }
    }
  })
})

/** `call` is accepted or refused by the rules, it does not matter here; any other error (writing into a frozen state is a TypeError) is a bug. */
function attempt(call: () => unknown): void {
  try {
    call()
  } catch (error) {
    expect(isEngineError(error), String(error)).toBe(true)
  }
}

describe("purity", () => {
  it.each(TABLES)("never writes into a state in phase %s", (_phase, table) => {
    const frozen = deepFreeze(structuredClone(table))
    attempt(() => GAME.isOver(frozen))
    attempt(() => GAME.waitingFor!(frozen))
    attempt(() => GAME.view(frozen, null))
    for (const id of frozen.seats) attempt(() => GAME.view(frozen, id))
    for (const id of waiting(frozen)) attempt(() => GAME.autoPlayFor!(frozen, id))
    for (const command of Object.values(GAME.debug ?? {})) attempt(() => command?.(frozen))
    for (const id of frozen.seats) {
      attempt(() => GAME.apply(frozen, draw(id)))
      attempt(() => GAME.apply(frozen, { type: "pass", playerId: id, chain: 0 }))
    }
    expect(frozen).toStrictEqual(table)
  })

  it("leaves a state as it was when it moves on", () => {
    const before = structuredClone(reaction)
    GAME.apply(reaction, act(reaction, nope("dan")))
    playedFor(reaction, "ana")
    GAME.view(reaction, "ana")
    expect(reaction).toStrictEqual(before)
  })
})
