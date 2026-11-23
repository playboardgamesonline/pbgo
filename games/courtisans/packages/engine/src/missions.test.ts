import { describe, expect, it } from "vitest"
import { MISSIONS, evaluateCondition, missionOf } from "./missions"
import { computeStatuses } from "./scoring"
import { card, makeState, player, place } from "./test-utils"
import type { Condition, Courtier, Family, GameState, Role } from "./types"

function context(state: GameState, playerIndex = 0) {
  return { state, playerIndex, statuses: computeStatuses(state.table) }
}

const state = makeState({
  table: [place(card("hare"), "down"), place(card("nightingale"), "down"), place(card("stag"), "up")],
  players: [
    player("a", { domain: [card("butterfly"), card("stag", "noble"), card("stag", "assassin")] }),
    player("b", { domain: [card("butterfly"), card("butterfly")] }),
    player("c", { domain: [] }),
  ],
})

describe("evaluateCondition", () => {
  const cases: [string, Condition, boolean][] = [
    ["familyStatus", { type: "familyStatus", family: "hare", status: "disgrace" }, true],
    ["familiesWithStatus", { type: "familiesWithStatus", status: "disgrace", comparator: "gte", value: 2 }, true],
    ["familiesWithStatus neutral", { type: "familiesWithStatus", status: "neutral", comparator: "eq", value: 3 }, true],
    ["domain cards", { type: "domainCards", filter: { family: "stag" }, comparator: "eq", value: 2 }, true],
    ["domain weight", { type: "domainCards", filter: { family: "stag" }, comparator: "eq", value: 3, mode: "weight" }, true],
    ["domain role", { type: "domainCards", filter: { role: "assassin" }, comparator: "gte", value: 1 }, true],
    ["domain without role", { type: "domainCards", filter: { role: "noRole" }, comparator: "eq", value: 1 }, true],
    ["table level", { type: "tableCards", filter: {}, level: "down", comparator: "eq", value: 2 }, true],
    ["fewer butterflies than left neighbor", { type: "playerComparison", filter: { family: "butterfly" }, comparator: "lt", opponent: "leftNeighbor" }, true],
    ["fewer butterflies than right neighbor", { type: "playerComparison", filter: { family: "butterfly" }, comparator: "lt", opponent: "rightNeighbor" }, false],
    ["more cards than everyone", { type: "playerComparison", filter: {}, comparator: "gt", opponent: "allOpponents" }, true],
    ["at least one opponent", { type: "playerComparison", filter: { family: "butterfly" }, comparator: "gt", opponent: "anyOpponent" }, true],
    [
      "and",
      { type: "and", conditions: [{ type: "familyStatus", family: "stag", status: "light" }, { type: "familyStatus", family: "carp", status: "light" }] },
      false,
    ],
    [
      "or",
      { type: "or", conditions: [{ type: "familyStatus", family: "stag", status: "light" }, { type: "familyStatus", family: "carp", status: "light" }] },
      true,
    ],
    ["not", { type: "not", condition: { type: "familyStatus", family: "carp", status: "light" } }, true],
  ]

  it.each(cases)("%s", (_, condition, expected) => {
    expect(evaluateCondition(condition, context(state))).toBe(expected)
  })
})

describe("MISSIONS", () => {
  it("holds the twenty missions of the game: ten white, then ten blue, each by number", () => {
    expect(MISSIONS).toHaveLength(20)
    expect(new Set(MISSIONS.map((m) => m.id)).size).toBe(20)
    expect(MISSIONS.map((m) => m.color)).toEqual([...Array(10).fill("white"), ...Array(10).fill("blue")])
    expect(MISSIONS.map((m) => m.id)).toEqual([...Array.from({ length: 10 }, (_, i) => `mission-light-${i + 1}`), ...Array.from({ length: 10 }, (_, i) => `mission-dark-${i + 1}`)])
  })

  it("refuses an id that is no mission: it is a bug of the engine, never a move", () => {
    expect(() => missionOf("mission-nope")).toThrow(RangeError)
  })
})

/** A table of three, the player of the test first: their left neighbour is the second player. */
function table(options: { mine?: Courtier[]; left?: Courtier[]; above?: Courtier[]; below?: Courtier[] }): GameState {
  return makeState({
    players: [player("a", { domain: options.mine ?? [] }), player("b", { domain: options.left ?? [] }), player("c")],
    table: [...(options.above ?? []).map((c) => place(c, "up")), ...(options.below ?? []).map((c) => place(c, "down"))],
  })
}

const holdsFor = (id: string, state: GameState) => evaluateCondition(missionOf(id).condition, context(state))

const many = (count: number, family: Family, role: Role | null = null) => Array.from({ length: count }, () => card(family, role))

describe("each mission", () => {
  it.each([
    ["mission-light-1", "carp"],
    ["mission-light-2", "stag"],
    ["mission-light-3", "toad"],
    ["mission-light-4", "hare"],
    ["mission-light-6", "nightingale"],
  ] as const)("%s: you own less weight of the %s than your left neighbour, a noble counting twice", (id, family) => {
    expect(holdsFor(id, table({ mine: many(1, family), left: many(2, family) }))).toBe(true)
    expect(holdsFor(id, table({ mine: many(2, family), left: many(2, family) }))).toBe(false)
    // one noble weighs two: as much as two courtiers
    expect(holdsFor(id, table({ mine: many(1, family, "noble"), left: many(2, family) }))).toBe(false)
    // the right neighbour does not count
    expect(holdsFor(id, makeState({ players: [player("a"), player("b", { domain: many(2, family) }), player("c")] }))).toBe(true)
    expect(holdsFor(id, makeState({ players: [player("a"), player("b"), player("c", { domain: many(2, family) })] }))).toBe(false)
  })

  it("mission-light-5: you own fewer butterflies than your left neighbour, counted as cards (a noble counts once)", () => {
    expect(holdsFor("mission-light-5", table({ mine: many(1, "butterfly", "noble"), left: many(2, "butterfly") }))).toBe(true)
    expect(holdsFor("mission-light-5", table({ mine: many(2, "butterfly"), left: many(2, "butterfly") }))).toBe(false)
  })

  it.each([
    ["mission-light-7", 3, "spy"],
    ["mission-light-8", 3, "noble"],
    ["mission-light-9", 2, "assassin"],
    ["mission-light-10", 4, "guard"],
  ] as const)("%s: you own at least %i cards of the role %s", (id, count, role) => {
    expect(holdsFor(id, table({ mine: many(count, "hare", role) }))).toBe(true)
    expect(holdsFor(id, table({ mine: many(count - 1, "hare", role) }))).toBe(false)
    // only your own domain counts
    expect(holdsFor(id, table({ left: many(count, "hare", role) }))).toBe(false)
  })

  it.each([
    ["mission-dark-1", "carp"],
    ["mission-dark-2", "stag"],
    ["mission-dark-3", "toad"],
    ["mission-dark-4", "hare"],
    ["mission-dark-5", "butterfly"],
    ["mission-dark-6", "nightingale"],
  ] as const)("%s: the %s are in disgrace at the table", (id, family) => {
    expect(holdsFor(id, table({ below: many(1, family) }))).toBe(true)
    expect(holdsFor(id, table({ above: many(1, family) }))).toBe(false)
    expect(holdsFor(id, table({ above: many(1, family), below: many(1, family) }))).toBe(false)
  })

  it("mission-dark-7: at least two families are in disgrace", () => {
    expect(holdsFor("mission-dark-7", table({ below: [card("hare"), card("stag")] }))).toBe(true)
    expect(holdsFor("mission-dark-7", table({ below: [card("hare")], above: [card("stag")] }))).toBe(false)
  })

  it("mission-dark-8: at most three families are in the light", () => {
    expect(holdsFor("mission-dark-8", table({ above: [card("hare"), card("stag"), card("carp")] }))).toBe(true)
    expect(holdsFor("mission-dark-8", table({ above: [card("hare"), card("stag"), card("carp"), card("toad")] }))).toBe(false)
  })

  it("mission-dark-9: one family weighs at least five below the mat, a noble counting twice", () => {
    expect(holdsFor("mission-dark-9", table({ below: many(5, "toad") }))).toBe(true)
    expect(holdsFor("mission-dark-9", table({ below: [card("toad", "noble"), card("toad", "noble"), card("toad")] }))).toBe(true)
    expect(holdsFor("mission-dark-9", table({ below: many(4, "toad") }))).toBe(false)
    // the families are not added up, and the cards above the mat do not count
    expect(holdsFor("mission-dark-9", table({ below: [...many(3, "toad"), ...many(2, "hare")] }))).toBe(false)
    expect(holdsFor("mission-dark-9", table({ above: many(5, "toad") }))).toBe(false)
  })

  it("mission-dark-10 counts the cards below the mat in total, whatever their family (its French text says one of each family: to settle)", () => {
    expect(holdsFor("mission-dark-10", table({ below: [card("carp")] }))).toBe(true)
    expect(holdsFor("mission-dark-10", table({ above: [card("carp")] }))).toBe(false)
    expect(holdsFor("mission-dark-10", table({}))).toBe(false)
  })
})
