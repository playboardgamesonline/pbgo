import { weight } from "./deck"
import type { Statuses } from "./scoring"
import { FAMILIES, type Comparator, type Condition, type Courtier, type CardFilter, type GameState, type CountMode } from "./types"

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
