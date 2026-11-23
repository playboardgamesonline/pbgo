import { describe, expect, it } from "vitest"
import { FAMILIES, type Family, type Role } from "./catalogue"
import { MISSIONS, evaluateCondition, missionOf } from "./missions"
import { computeStatuses } from "./scoring"
import { type CardSpec, card, layout } from "./test-utils"
import type { CardFilter, Condition, State } from "./types"

/** A condition read for Ana, the first player: where the Queen's table leaves the families, and what each domain holds. */
function holds(state: State, condition: Condition, seat = 0): boolean {
  return evaluateCondition(condition, { s: state, seat, statuses: computeStatuses(state) })
}

describe("evaluateCondition", () => {
  const state = layout({
    players: 3,
    table: [
      [card("hare"), "down"],
      [card("nightingale"), "down"],
      [card("stag"), "up"],
    ],
    domains: { ana: [card("butterfly"), card("stag", "noble"), card("stag", "assassin")], bob: [card("butterfly"), card("butterfly")], cleo: [] },
  })
  const filter = (family?: Family, role?: CardFilter["role"]): CardFilter => ({ ...(family ? { family } : {}), ...(role ? { role } : {}) })

  const cases: [string, Condition, boolean][] = [
    ["familyStatus", { type: "familyStatus", family: "hare", status: "disgrace" }, true],
    ["familiesWithStatus", { type: "familiesWithStatus", status: "disgrace", comparator: "gte", value: 2 }, true],
    ["familiesWithStatus neutral", { type: "familiesWithStatus", status: "neutral", comparator: "eq", value: 3 }, true],
    ["domain cards", { type: "domainCards", filter: filter("stag"), comparator: "eq", value: 2 }, true],
    ["domain weight", { type: "domainCards", filter: filter("stag"), comparator: "eq", value: 3, mode: "weight" }, true],
    ["domain role", { type: "domainCards", filter: filter(undefined, "assassin"), comparator: "gte", value: 1 }, true],
    ["domain without role", { type: "domainCards", filter: filter(undefined, "noRole"), comparator: "eq", value: 1 }, true],
    ["table level", { type: "tableCards", filter: {}, level: "down", comparator: "eq", value: 2 }, true],
    ["fewer butterflies than left neighbor", { type: "playerComparison", filter: filter("butterfly"), comparator: "lt", opponent: "leftNeighbor" }, true],
    ["fewer butterflies than right neighbor", { type: "playerComparison", filter: filter("butterfly"), comparator: "lt", opponent: "rightNeighbor" }, false],
    ["more cards than everyone", { type: "playerComparison", filter: {}, comparator: "gt", opponent: "allOpponents" }, true],
    ["at least one opponent", { type: "playerComparison", filter: filter("butterfly"), comparator: "gt", opponent: "anyOpponent" }, true],
    ["and", { type: "and", conditions: [{ type: "familyStatus", family: "stag", status: "light" }, { type: "familyStatus", family: "carp", status: "light" }] }, false],
    ["or", { type: "or", conditions: [{ type: "familyStatus", family: "stag", status: "light" }, { type: "familyStatus", family: "carp", status: "light" }] }, true],
    ["not", { type: "not", condition: { type: "familyStatus", family: "carp", status: "light" } }, true],
  ]

  it.each(cases)("%s", (_, condition, expected) => {
    expect(holds(state, condition)).toBe(expected)
  })

  it("reads the neighbours of the seat of the player whose mission it is, going round the table", () => {
    const left: Condition = { type: "playerComparison", filter: filter("butterfly"), comparator: "lt", opponent: "leftNeighbor" }
    // Cleo's left neighbour is Ana (the table closes up), who holds one butterfly against none of her own
    expect(holds(state, left, 2)).toBe(true)
    expect(holds(state, { ...left, opponent: "rightNeighbor" }, 0)).toBe(false)
    // at a table of two both neighbours are the other player
    const two = layout({ players: 2, domains: { ana: [card("hare")], bob: [card("hare"), card("hare")] } })
    expect(holds(two, { type: "playerComparison", filter: filter("hare"), comparator: "lt", opponent: "leftNeighbor" })).toBe(true)
    expect(holds(two, { type: "playerComparison", filter: filter("hare"), comparator: "lt", opponent: "rightNeighbor" })).toBe(true)
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
function table(options: { mine?: CardSpec[]; left?: CardSpec[]; above?: CardSpec[]; below?: CardSpec[] }): State {
  return layout({
    players: 3,
    domains: { ana: options.mine ?? [], bob: options.left ?? [] },
    table: [...(options.above ?? []).map((c) => [c, "up"] as const), ...(options.below ?? []).map((c) => [c, "down"] as const)],
  })
}

const holdsFor = (id: string, state: State) => holds(state, missionOf(id).condition)

/** Cards of a family that weigh one each, as many as asked (the box holds eleven of them for each family): the plain courtiers, then the guards, spies and assassins. */
function light(count: number, family: Family): CardSpec[] {
  const roles: (Role | null)[] = [null, null, null, null, "guard", "guard", "guard", "spy", "spy", "assassin", "assassin"]
  return roles.slice(0, count).map((role) => card(family, role))
}

describe("each mission", () => {
  it.each([
    ["mission-light-1", "carp"],
    ["mission-light-2", "stag"],
    ["mission-light-3", "toad"],
    ["mission-light-4", "hare"],
    ["mission-light-6", "nightingale"],
  ] as const)("%s: you own less weight of the %s than your left neighbour, a noble counting twice", (id, family) => {
    expect(holdsFor(id, table({ mine: light(1, family), left: light(2, family) }))).toBe(true)
    expect(holdsFor(id, table({ mine: light(2, family), left: light(2, family) }))).toBe(false)
    // one noble weighs two: as much as two courtiers
    expect(holdsFor(id, table({ mine: [card(family, "noble")], left: light(2, family) }))).toBe(false)
    // the right neighbour does not count
    expect(holdsFor(id, layout({ players: 3, domains: { bob: light(2, family) } }))).toBe(true)
    expect(holdsFor(id, layout({ players: 3, domains: { cleo: light(2, family) } }))).toBe(false)
  })

  it("mission-light-5: you own fewer butterflies than your left neighbour, counted as cards (a noble counts once)", () => {
    expect(holdsFor("mission-light-5", table({ mine: [card("butterfly", "noble")], left: light(2, "butterfly") }))).toBe(true)
    expect(holdsFor("mission-light-5", table({ mine: light(2, "butterfly"), left: light(2, "butterfly") }))).toBe(false)
  })

  it.each([
    ["mission-light-7", 3, "spy"],
    ["mission-light-8", 3, "noble"],
    ["mission-light-9", 2, "assassin"],
    ["mission-light-10", 4, "guard"],
  ] as const)("%s: you own at least %i cards of the role %s", (id, count, role) => {
    // a family holds at most three guards: the cards are spread over the families
    const roleCards = (n: number) => Array.from({ length: n }, (_, i) => card(FAMILIES[i % FAMILIES.length]!, role))
    expect(holdsFor(id, table({ mine: roleCards(count) }))).toBe(true)
    expect(holdsFor(id, table({ mine: roleCards(count - 1) }))).toBe(false)
    // only your own domain counts
    expect(holdsFor(id, table({ left: roleCards(count) }))).toBe(false)
  })

  it.each([
    ["mission-dark-1", "carp"],
    ["mission-dark-2", "stag"],
    ["mission-dark-3", "toad"],
    ["mission-dark-4", "hare"],
    ["mission-dark-5", "butterfly"],
    ["mission-dark-6", "nightingale"],
  ] as const)("%s: the %s are in disgrace at the table", (id, family) => {
    expect(holdsFor(id, table({ below: [card(family)] }))).toBe(true)
    expect(holdsFor(id, table({ above: [card(family)] }))).toBe(false)
    expect(holdsFor(id, table({ above: [card(family)], below: [card(family)] }))).toBe(false)
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
    expect(holdsFor("mission-dark-9", table({ below: light(5, "toad") }))).toBe(true)
    expect(holdsFor("mission-dark-9", table({ below: [card("toad", "noble"), card("toad", "noble"), card("toad")] }))).toBe(true)
    expect(holdsFor("mission-dark-9", table({ below: light(4, "toad") }))).toBe(false)
    // the families are not added up, and the cards above the mat do not count
    expect(holdsFor("mission-dark-9", table({ below: [...light(3, "toad"), ...light(2, "hare")] }))).toBe(false)
    expect(holdsFor("mission-dark-9", table({ above: light(5, "toad") }))).toBe(false)
  })

  it("mission-dark-10 counts the cards below the mat in total, whatever their family (its French text says one of each family: to settle)", () => {
    expect(holdsFor("mission-dark-10", table({ below: [card("carp")] }))).toBe(true)
    expect(holdsFor("mission-dark-10", table({ above: [card("carp")] }))).toBe(false)
    expect(holdsFor("mission-dark-10", table({}))).toBe(false)
  })
})
