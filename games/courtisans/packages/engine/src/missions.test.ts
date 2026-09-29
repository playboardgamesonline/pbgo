import { describe, expect, it } from "vitest"
import { evaluateCondition } from "./missions"
import { computeStatuses } from "./scoring"
import { card, makeState, player, place } from "./test-utils"
import type { Condition, GameState } from "./types"

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
    ["nombreFamillesStatut neutre", { type: "familiesWithStatus", status: "neutral", comparator: "eq", value: 3 }, true],
    ["domain cards", { type: "domainCards", filter: { family: "stag" }, comparator: "eq", value: 2 }, true],
    ["domaine poids", { type: "domainCards", filter: { family: "stag" }, comparator: "eq", value: 3, mode: "weight" }, true],
    ["domaine role", { type: "domainCards", filter: { role: "assassin" }, comparator: "gte", value: 1 }, true],
    ["domaine sans role", { type: "domainCards", filter: { role: "noRole" }, comparator: "eq", value: 1 }, true],
    ["table niveau", { type: "tableCards", filter: {}, level: "down", comparator: "eq", value: 2 }, true],
    ["moins de papillons que voisin de gauche", { type: "playerComparison", filter: { family: "butterfly" }, comparator: "lt", opponent: "leftNeighbor" }, true],
    ["moins de papillons que voisin de droite", { type: "playerComparison", filter: { family: "butterfly" }, comparator: "lt", opponent: "rightNeighbor" }, false],
    ["more cards than everyone", { type: "playerComparison", filter: {}, comparator: "gt", opponent: "allOpponents" }, true],
    ["au moins un adversaire", { type: "playerComparison", filter: { family: "butterfly" }, comparator: "gt", opponent: "anyOpponent" }, true],
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
