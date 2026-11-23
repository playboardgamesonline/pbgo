import { weight } from "./deck"
import type { Statuses } from "./scoring"
import { FAMILIES, type Comparator, type Condition, type Courtier, type CardFilter, type GameState, type CountMode, type Mission } from "./types"

/**
 * The twenty missions of the game, as rules. Each player is dealt a white one and a blue one, and each that holds at the end is worth `MISSION_POINTS`. What a player reads on a mission card, its text and its
 * picture, is the game's own, in its Sanity, under the same `id`; the rule is here and nowhere else.
 *
 * The order is the one the missions are shuffled in (the white ones, then the blue ones, each by number), so a seed deals the same missions to the same players whatever Sanity lists.
 *
 * Transcribed as they were in Sanity, three of them for the owner to settle against the rulebook:
 * - `mission-dark-10` counts the cards below the mat in total, whatever their family, where its French text says at least one card of each family.
 * - `mission-dark-9` counts the weight of a family below the mat (a noble counts twice), where its French text says cards.
 * - `mission-light-5` counts the butterflies as cards, where the five missions of its kind count the weight of the family.
 */
export const MISSIONS: readonly Mission[] = [
  { id: "mission-light-1", color: "white", condition: { type: "playerComparison", filter: { family: "carp" }, comparator: "lt", opponent: "leftNeighbor", mode: "weight" } },
  { id: "mission-light-2", color: "white", condition: { type: "playerComparison", filter: { family: "stag" }, comparator: "lt", opponent: "leftNeighbor", mode: "weight" } },
  { id: "mission-light-3", color: "white", condition: { type: "playerComparison", filter: { family: "toad" }, comparator: "lt", opponent: "leftNeighbor", mode: "weight" } },
  { id: "mission-light-4", color: "white", condition: { type: "playerComparison", filter: { family: "hare" }, comparator: "lt", opponent: "leftNeighbor", mode: "weight" } },
  { id: "mission-light-5", color: "white", condition: { type: "playerComparison", filter: { family: "butterfly" }, comparator: "lt", opponent: "leftNeighbor", mode: "cards" } },
  { id: "mission-light-6", color: "white", condition: { type: "playerComparison", filter: { family: "nightingale" }, comparator: "lt", opponent: "leftNeighbor", mode: "weight" } },
  { id: "mission-light-7", color: "white", condition: { type: "domainCards", filter: { role: "spy" }, comparator: "gte", value: 3, mode: "cards" } },
  { id: "mission-light-8", color: "white", condition: { type: "domainCards", filter: { role: "noble" }, comparator: "gte", value: 3, mode: "cards" } },
  { id: "mission-light-9", color: "white", condition: { type: "domainCards", filter: { role: "assassin" }, comparator: "gte", value: 2, mode: "cards" } },
  { id: "mission-light-10", color: "white", condition: { type: "domainCards", filter: { role: "guard" }, comparator: "gte", value: 4, mode: "cards" } },
  { id: "mission-dark-1", color: "blue", condition: { type: "familyStatus", family: "carp", status: "disgrace" } },
  { id: "mission-dark-2", color: "blue", condition: { type: "familyStatus", family: "stag", status: "disgrace" } },
  { id: "mission-dark-3", color: "blue", condition: { type: "familyStatus", family: "toad", status: "disgrace" } },
  { id: "mission-dark-4", color: "blue", condition: { type: "familyStatus", family: "hare", status: "disgrace" } },
  { id: "mission-dark-5", color: "blue", condition: { type: "familyStatus", family: "butterfly", status: "disgrace" } },
  { id: "mission-dark-6", color: "blue", condition: { type: "familyStatus", family: "nightingale", status: "disgrace" } },
  { id: "mission-dark-7", color: "blue", condition: { type: "familiesWithStatus", status: "disgrace", comparator: "gte", value: 2 } },
  { id: "mission-dark-8", color: "blue", condition: { type: "familiesWithStatus", status: "light", comparator: "lte", value: 3 } },
  {
    id: "mission-dark-9",
    color: "blue",
    condition: {
      type: "or",
      conditions: FAMILIES.map((family): Condition => ({ type: "tableCards", filter: { family }, level: "down", comparator: "gte", value: 5, mode: "weight" })),
    },
  },
  { id: "mission-dark-10", color: "blue", condition: { type: "tableCards", filter: {}, level: "down", comparator: "gte", value: 1, mode: "cards" } },
]

/** The mission with this id. An id nobody holds is a bug of the engine: a game only deals the missions of `MISSIONS`. */
export function missionOf(id: string): Mission {
  const mission = MISSIONS.find((m) => m.id === id)
  if (!mission) throw new RangeError(`There is no mission ${id}`)
  return mission
}

export type MissionContext = {
  state: GameState
  playerIndex: number
  statuses: Statuses
}

export function compare(a: number, comparator: Comparator, b: number): boolean {
  switch (comparator) {
    case "eq":
      return a === b
    case "gte":
      return a >= b
    case "lte":
      return a <= b
    case "gt":
      return a > b
    case "lt":
      return a < b
  }
}

export function matches(card: Courtier, filter: CardFilter): boolean {
  if (filter.family && card.family !== filter.family) return false
  if (filter.role === "noRole") return card.role === null
  if (filter.role && card.role !== filter.role) return false
  return true
}

export function countCards(cards: Courtier[], filter: CardFilter, mode: CountMode = "cards"): number {
  return cards.filter((c) => matches(c, filter)).reduce((sum, c) => sum + (mode === "weight" ? weight(c) : 1), 0)
}

export function evaluateCondition(condition: Condition, ctx: MissionContext): boolean {
  const { state, playerIndex, statuses } = ctx
  const players = state.players
  const me = players[playerIndex]!

  switch (condition.type) {
    case "familyStatus":
      return statuses[condition.family].status === condition.status

    case "familiesWithStatus": {
      const n = FAMILIES.filter((f) => statuses[f].status === condition.status).length
      return compare(n, condition.comparator, condition.value)
    }

    case "domainCards":
      return compare(countCards(me.domain, condition.filter, condition.mode), condition.comparator, condition.value)

    case "tableCards": {
      const cards = state.table.filter((p) => !condition.level || p.level === condition.level).map((p) => p.card)
      return compare(countCards(cards, condition.filter, condition.mode), condition.comparator, condition.value)
    }

    case "playerComparison": {
      const mine = countCards(me.domain, condition.filter, condition.mode)
      const other = (i: number) => countCards(players[(i + players.length) % players.length]!.domain, condition.filter, condition.mode)
      const opponents = players.map((_, i) => i).filter((i) => i !== playerIndex)
      switch (condition.opponent) {
        case "leftNeighbor":
          return compare(mine, condition.comparator, other(playerIndex + 1))
        case "rightNeighbor":
          return compare(mine, condition.comparator, other(playerIndex - 1))
        case "allOpponents":
          return opponents.every((i) => compare(mine, condition.comparator, other(i)))
        case "anyOpponent":
          return opponents.some((i) => compare(mine, condition.comparator, other(i)))
      }
    }

    case "and":
      return condition.conditions.every((c) => evaluateCondition(c, ctx))
    case "or":
      return condition.conditions.some((c) => evaluateCondition(c, ctx))
    case "not":
      return !evaluateCondition(condition.condition, ctx)
  }
}
