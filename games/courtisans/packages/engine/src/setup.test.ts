import { describe, expect, it } from "vitest"
import { CARDS, CATALOGUE, COMPOSITION, FAMILIES, ROLES, SET_ASIDE_CARDS, cardKey, weight } from "./catalogue"
import { phaseOf } from "./machine"
import { missionOf } from "./missions"
import { setupGame } from "./setup"
import { kinds, newState, players, problems, seedOf } from "./test-utils"
import { playerView } from "./view"

describe("the box", () => {
  it("holds 90 cards, 15 per family with the right roles", () => {
    expect(CATALOGUE).toHaveLength(90)
    for (const family of FAMILIES) {
      const held = CATALOGUE.filter((key) => CARDS[key].family === family)
      expect(held).toHaveLength(15)
      for (const { role, count } of COMPOSITION) expect(held.filter((key) => CARDS[key].role === role)).toHaveLength(count)
    }
  })

  it("keys every kind of card by its role and its family, `base` standing for no role", () => {
    expect(Object.keys(CARDS)).toHaveLength(FAMILIES.length * (ROLES.length + 1))
    expect(cardKey("hare", "noble")).toBe("noble-hare")
    expect(cardKey("hare", null)).toBe("base-hare")
    expect(CARDS["spy-carp"]).toEqual({ family: "carp", role: "spy" })
  })

  it("makes a noble count twice and every other card once", () => {
    expect(weight("noble")).toBe(2)
    for (const role of [null, "spy", "assassin", "guard"] as const) expect(weight(role)).toBe(1)
  })
})

describe("setupGame", () => {
  it.each([2, 3, 4, 5])("with %i players sets aside what the table asks and deals three cards to each", (n) => {
    const state = newState(n, seedOf(n))
    const setAside = SET_ASIDE_CARDS[n]!
    expect(state.setAside).toHaveLength(setAside)
    expect(state.deck).toHaveLength(90 - setAside - 3 * n)
    for (const hand of state.hands) expect(hand).toHaveLength(3)
    for (const own of state.missions) expect(own.map((id) => missionOf(id).color)).toEqual(["white", "blue"])
    expect(new Set(state.missions.flat()).size).toBe(2 * n)
    expect(phaseOf(state)).toBe("missions")
    expect(state.read.every((flag) => !flag)).toBe(true)
    expect(state.active).toBeGreaterThanOrEqual(0)
    expect(state.active).toBeLessThan(n)
    expect(problems(state)).toEqual([])
  })

  it("gives every card an opaque id, a number that says nothing of its kind, the same for a given seed", () => {
    const state = newState(5, 2 ** 33 + 5)
    expect(new Set(state.ids).size).toBe(90)
    for (const id of state.ids) expect(Number.isInteger(id)).toBe(true)
    expect(newState(5, 2 ** 33 + 5)).toEqual(state)
    expect(newState(5, 2 ** 33 + 6)).not.toEqual(state)
  })

  it("keeps the deal a seed has always given (pinned before the engine moved onto the kit)", () => {
    const five = newState(5, 2 ** 33 + 5)
    expect(five.hands.map((hand) => kinds(five, hand))).toEqual([
      ["base-nightingale", "noble-carp", "guard-carp"],
      ["base-nightingale", "guard-butterfly", "base-butterfly"],
      ["noble-hare", "noble-nightingale", "base-hare"],
      ["noble-stag", "guard-toad", "guard-toad"],
      ["base-butterfly", "spy-butterfly", "guard-hare"],
    ])
    expect(kinds(five, five.deck.slice(0, 3))).toEqual(["noble-nightingale", "guard-nightingale", "noble-hare"])
    expect(kinds(five, five.deck.slice(-1))).toEqual(["assassin-stag"])
    expect(five.active).toBe(2)

    const two = newState(2, 7 * 2 ** 32 + 99)
    expect(two.hands.map((hand) => kinds(two, hand))).toEqual([
      ["guard-toad", "base-hare", "noble-butterfly"],
      ["base-carp", "spy-toad", "spy-toad"],
    ])
    expect(kinds(two, two.deck.slice(0, 3))).toEqual(["base-hare", "base-toad", "noble-butterfly"])
    expect(kinds(two, two.deck.slice(-1))).toEqual(["base-nightingale"])
    expect(kinds(two, two.setAside.slice(0, 3))).toEqual(["noble-toad", "assassin-butterfly", "guard-toad"])
    expect(two.active).toBe(0)
  })

  it("refuses a table it cannot play with INVALID_PLAYERS: too few, too many, the same id twice, an empty id", () => {
    const code = (table: { id: string; nickname: string }[]) => {
      try {
        setupGame({ players: table, seed: 1 })
      } catch (error) {
        return (error as { code?: string }).code
      }
      return null
    }
    expect(code([])).toBe("INVALID_PLAYERS")
    expect(code(players(1))).toBe("INVALID_PLAYERS")
    expect(code([...players(5), { id: "fay", nickname: "FAY" }])).toBe("INVALID_PLAYERS")
    expect(code([players(2)[0]!, players(2)[0]!])).toBe("INVALID_PLAYERS")
    expect(code([{ id: "", nickname: "Nobody" }, ...players(2)])).toBe("INVALID_PLAYERS")
    expect(code(players(2))).toBeNull()
  })

  it("keeps no name in the state: the nicknames are the table's", () => {
    expect(JSON.stringify(newState(3))).not.toMatch(/ANA|BOB|CLEO/)
    expect(JSON.stringify(playerView(newState(3), "ana"))).not.toMatch(/ANA|BOB|CLEO/)
  })
})
