import { EngineError, ID_SPACE, type PlayerInfo } from "@pbgo/engine-kit"
import { describe, expect, it } from "vitest"
import { CARDS } from "./catalogue"
import { ORIGINAL_RULES } from "./rules"
import { MAX_PLAYERS, MIN_PLAYERS, setupGame } from "./setup"
import {
  PLAYER_IDS,
  deckTitles,
  expectIntegrity,
  expectSerializable,
  handIds,
  handTitles,
  kittensInPlay,
  newState,
  players,
  seedOf,
  titles,
  typesOf,
} from "./test-utils"
import type { State } from "./types"

function count(list: readonly string[], title: string): number {
  return list.filter((item) => item === title).length
}

/** The ids of the cards that are in a hand or in the draw pile. */
function placed(state: State): number[] {
  return [...state.hands.flat(), ...state.deck]
}

/** What is dealt, by title and not by id: who plays first, what each player holds and the draw pile. */
function dealt(state: State): string {
  return JSON.stringify([deckTitles(state), state.hands.map((hand) => titles(state, hand)), state.turn])
}

describe("setup", () => {
  it("knows the sizes of a table", () => {
    expect([MIN_PLAYERS, MAX_PLAYERS]).toEqual([2, 5])
  })

  describe.each([
    [2, 35, 5],
    [3, 29, 3],
    [4, 23, 1],
    [5, 16, 0],
  ])("a table of %i players", (n, pile, removed) => {
    const state = newState(n)

    it(`has a draw pile of ${pile} cards`, () => {
      expect(state.deck).toHaveLength(pile)
    })

    it("deals 8 cards to each player: 7 and a Defuse", () => {
      expect(state.hands).toHaveLength(n)
      for (const hand of state.hands) expect(hand).toHaveLength(8)
    })

    it("gives every player a Defuse", () => {
      for (const id of state.seats) expect(count(handTitles(state, id), "defuse"), id).toBeGreaterThanOrEqual(1)
    })

    it("leaves no Exploding Kitten in a hand", () => {
      for (const id of state.seats) expect(count(handTitles(state, id), "exploding-kitten"), id).toBe(0)
    })

    it(`shuffles ${n - 1} Exploding Kitten${n === 2 ? "" : "s"} into the draw pile`, () => {
      expect(count(deckTitles(state), "exploding-kitten")).toBe(n - 1)
      expect(kittensInPlay(state)).toBe(n - 1)
    })

    it("keeps the Defuses of the players and puts the spare ones back, as the booklet says", () => {
      const defuses = count(titles(state, placed(state)), "defuse")
      expect(defuses).toBe(n + Math.min(2, 6 - n))
    })

    it(`takes ${removed} cards out of the game unseen`, () => {
      expect(56 - placed(state).length).toBe(removed)
    })

    it("starts a plain turn of a player at the table", () => {
      expect(state.turn).toBeGreaterThanOrEqual(0)
      expect(state.turn).toBeLessThan(n)
      expect(state.owed).toBe(1)
      expect(state.attacked).toBe(false)
      expect(state.phase).toEqual({ kind: "turn" })
    })

    it("starts with nothing discarded, nobody out, nothing known and no stats", () => {
      expect(state.discard).toEqual([])
      expect(state.out).toEqual([])
      expect(state.known).toEqual({})
      expect(state.stats).toEqual(PLAYER_IDS.slice(0, n).map(() => ({ turns: 0, defused: 0, nopes: 0 })))
    })

    it("seats the players in the order they came", () => {
      expect(state.seats).toEqual(PLAYER_IDS.slice(0, n))
    })

    it("is a state that holds together and survives JSON", () => {
      expectIntegrity(state)
      expectSerializable(state)
    })

    it("holds each card in one place only", () => {
      const all = placed(state)
      expect(new Set(all).size).toBe(all.length)
      for (const id of all) expect(state.ids).toContain(id)
    })
  })

  it("holds every card of the deck, each with an id of its own", () => {
    const state = newState(3)
    expect(state.ids).toHaveLength(56)
    expect(new Set(state.ids).size).toBe(56)
    for (const id of state.ids) {
      expect(Number.isInteger(id)).toBe(true)
      expect(id).toBeGreaterThanOrEqual(0)
      expect(id).toBeLessThan(ID_SPACE)
    }
  })

  it("keeps the names of the cards out of the state", () => {
    const text = JSON.stringify(newState(4))
    for (const title of Object.keys(CARDS)) expect(text, title).not.toContain(`"${title}"`)
  })

  it("does not give a hand the same card twice", () => {
    const state = newState(5)
    for (const seat of state.seats) {
      const hand = handIds(state, seat)
      expect(new Set(hand).size).toBe(hand.length)
    }
  })

  describe("options", () => {
    it("defaults to the rules of the booklet: five different cards on, the faster game and the classic deal off", () => {
      expect(newState(3).options).toEqual({ fiveDifferent: true, fasterGame: false, classicDeal: false })
    })

    it("keeps the options it is given", () => {
      expect(newState(2, seedOf(1), { fiveDifferent: false, fasterGame: true }).options).toEqual({
        fiveDifferent: false,
        fasterGame: true,
        classicDeal: false,
      })
    })

    it("falls back to the default of an option that is not a yes or a no", () => {
      expect(newState(3, seedOf(1), { fiveDifferent: "yes", fasterGame: 1, classicDeal: null }).options).toEqual({
        fiveDifferent: true,
        fasterGame: false,
        classicDeal: false,
      })
    })

    it("ignores options that do not exist, and options that are not an object", () => {
      expect(newState(3, seedOf(1), { nope: true }).options).toEqual(newState(3).options)
      expect(newState(3, seedOf(1), "fasterGame").options).toEqual(newState(3).options)
      expect(newState(3, seedOf(1), null).options).toEqual(newState(3).options)
    })

    describe.each([
      [2, 24],
      [3, 20],
    ])("the faster game at %i players", (n, pile) => {
      const state = newState(n, seedOf(2), { fasterGame: true })

      it(`leaves a draw pile of ${pile} cards, Kittens included`, () => {
        expect(state.deck).toHaveLength(pile)
        expect(count(deckTitles(state), "exploding-kitten")).toBe(n - 1)
      })

      it("deals the same hands", () => {
        for (const hand of state.hands) expect(hand).toHaveLength(8)
      })

      it("keeps the cards of the game apart", () => {
        expectIntegrity(state)
      })
    })

    it("refuses the faster game at 4 and 5 players", () => {
      for (const n of [4, 5]) {
        const state = newState(n, seedOf(2), { fasterGame: true })
        expect(state.options.fasterGame, String(n)).toBe(false)
        expect(state.deck, String(n)).toHaveLength(n === 4 ? 23 : 16)
      }
    })

    describe.each([
      [2, 43],
      [3, 39],
      [4, 35],
      [5, 31],
    ])("the classic deal at %i players", (n, pile) => {
      const state = newState(n, seedOf(3), { classicDeal: true })

      it("deals a Defuse and 4 cards", () => {
        for (const hand of state.hands) expect(hand).toHaveLength(5)
        for (const id of state.seats) expect(count(handTitles(state, id), "defuse"), id).toBeGreaterThanOrEqual(1)
      })

      it(`leaves a draw pile of ${pile} cards, Kittens included`, () => {
        expect(state.deck).toHaveLength(pile)
        expect(count(deckTitles(state), "exploding-kitten")).toBe(n - 1)
      })

      it("puts every spare Defuse back into the cards", () => {
        expect(count(titles(state, placed(state)), "defuse")).toBe(6)
      })
    })

    it("lets the faster game win when it conflicts with the classic deal", () => {
      const state = newState(2, seedOf(4), { fasterGame: true, classicDeal: true })
      expect(state.options.fasterGame).toBe(true)
      expect(state.options.classicDeal).toBe(false)
      expect(state.deck).toHaveLength(24)
    })
  })

  describe("the seed", () => {
    it("deals the same game from the same seed", () => {
      for (const n of [2, 3, 4, 5]) expect(newState(n, seedOf(7))).toStrictEqual(newState(n, seedOf(7)))
    })

    it("deals a different game from another seed", () => {
      // By title: the ids differ from one seed to the next anyway
      const seen = new Set<string>()
      for (let i = 0; i < 40; i++) seen.add(dealt(newState(4, seedOf(i))))
      expect(seen.size).toBe(40)
    })

    it("draws a seed when it is not given", () => {
      const state = setupGame(ORIGINAL_RULES, { players: players(3) })
      expectIntegrity(state)
      expect(state.deck).toHaveLength(29)
    })

    it("does not let the number of players move the ids of the cards", () => {
      expect(newState(2, seedOf(5)).ids).toEqual(newState(5, seedOf(5)).ids)
    })

    it("lets every seat start", () => {
      for (const n of [2, 3, 4, 5]) {
        const starters = new Set<number>()
        for (let i = 0; i < 60; i++) starters.add(newState(n, seedOf(i)).turn)
        expect([...starters].sort(), String(n)).toEqual(Array.from({ length: n }, (_, seat) => seat))
      }
    })

    it("shuffles the Kittens in, not at the bottom or the top", () => {
      const types = typesOf(newState(5))
      let onTop = 0
      let atBottom = 0
      const games = 200
      for (let i = 0; i < games; i++) {
        const { deck, ids } = newState(5, seedOf(i))
        if (types[ids.indexOf(deck[0]!)] === "exploding-kitten") onTop++
        if (types[ids.indexOf(deck.at(-1)!)] === "exploding-kitten") atBottom++
      }
      // 4 Kittens in 16 cards: a quarter of the games each
      for (const found of [onTop, atBottom]) {
        expect(found / games).toBeGreaterThan(0.15)
        expect(found / games).toBeLessThan(0.35)
      }
    })
  })

  describe("the ids", () => {
    it("tell nothing of the card they belong to", () => {
      // The mean id of each type, over many games, is the middle of the range: neither high nor low ids belong to a type
      const games = 300
      const sums = new Map<string, number>()
      const seen = new Map<string, number>()
      for (let i = 0; i < games; i++) {
        const state = newState(2, seedOf(i))
        typesOf(state).forEach((type, index) => {
          sums.set(type, (sums.get(type) ?? 0) + state.ids[index]! / ID_SPACE)
          seen.set(type, (seen.get(type) ?? 0) + 1)
        })
      }
      expect([...sums.keys()]).toHaveLength(13)
      for (const [type, sum] of sums) expect(Math.abs(sum / seen.get(type)! - 0.5), type).toBeLessThan(0.05)
    })

    it("do not sort the cards by type", () => {
      // Each pair of a Kitten and a Defuse: the Kitten has the smaller id about half of the time
      const games = 100
      let smaller = 0
      let pairs = 0
      for (let i = 0; i < games; i++) {
        const state = newState(2, seedOf(i))
        for (const kitten of state.ids.slice(0, 4)) {
          for (const defuse of state.ids.slice(4, 10)) {
            pairs++
            if (kitten < defuse) smaller++
          }
        }
      }
      expect(Math.abs(smaller / pairs - 0.5)).toBeLessThan(0.05)
    })

    it("come from a stream of their own, so that no id leads back to the shuffles", () => {
      // The shuffles read the low half of the seed and the ids its high half: the same deal can come under other ids, and the same
      // ids over another deal. Drawn from the stream of the shuffles, the ids of a table would give away the draws that follow
      const seed = seedOf(3)
      const base = newState(4, seed)
      const otherHigh = newState(4, seed + 7 * 2 ** 32)
      const otherLow = newState(4, Math.floor(seed / 2 ** 32) * 2 ** 32 + 12345)
      expect(dealt(otherHigh)).toBe(dealt(base))
      expect(otherHigh.ids).not.toEqual(base.ids)
      expect(otherLow.ids).toEqual(base.ids)
      expect(dealt(otherLow)).not.toBe(dealt(base))
    })
  })

  describe("the players", () => {
    const some = (n: number): PlayerInfo[] => players(n)

    it("takes 2 to 5 of them", () => {
      for (const n of [2, 3, 4, 5]) expect(() => setupGame(ORIGINAL_RULES, { players: some(n), seed: seedOf(0) })).not.toThrow()
    })

    it("refuses 1 player and 6 players", () => {
      for (const list of [some(1), [...some(5), { id: "fay", nickname: "FAY" }], []]) {
        expect(() => setupGame(ORIGINAL_RULES, { players: list, seed: seedOf(0) }), String(list.length)).toThrow(
          expect.objectContaining({ code: "INVALID_PLAYERS" }),
        )
      }
    })

    it("refuses the same id twice", () => {
      expect(() => setupGame(ORIGINAL_RULES, { players: [{ id: "ana", nickname: "A" }, { id: "ana", nickname: "B" }], seed: seedOf(0) })).toThrow(
        EngineError,
      )
    })

    it("refuses an id that is empty or not a string", () => {
      const bad = [{ id: "", nickname: "A" }, { id: 7, nickname: "A" }, { nickname: "A" }, null, undefined]
      for (const entry of bad) {
        const list = [{ id: "ana", nickname: "ANA" }, entry] as unknown as PlayerInfo[]
        expect(() => setupGame(ORIGINAL_RULES, { players: list, seed: seedOf(0) }), String(entry)).toThrow(
          expect.objectContaining({ code: "INVALID_PLAYERS" }),
        )
      }
    })

    it("refuses a list that is not a list", () => {
      for (const list of [undefined, null, "ana", { length: 2 }, 3]) {
        expect(() => setupGame(ORIGINAL_RULES, { players: list as unknown as PlayerInfo[], seed: seedOf(0) }), String(list)).toThrow(
          expect.objectContaining({ code: "INVALID_PLAYERS" }),
        )
      }
    })
  })
})
