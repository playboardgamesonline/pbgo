import "server-only"
import { type Condition, FAMILIES, type Family, type Mission, ROLES, type Role } from "@courtisans/engine"
import { translate } from "@pbgo/core/lib/i18n"
import { DEFAULT_MISSIONS } from "@/lib/default-missions"
import { getCatalog } from "@/sanity/catalog"

type ConditionSanity = {
  type?: string
  family?: string
  status?: string
  familyFilter?: string
  roleFilter?: string
  level?: string
  comparator?: string
  value?: number
  opponent?: string
  mode?: string
  conditions?: ConditionSanity[]
}

function filter(c: ConditionSanity) {
  return {
    ...(c.familyFilter ? { family: c.familyFilter as Family } : {}),
    ...(c.roleFilter ? { role: c.roleFilter as Role | "noRole" } : {}),
  }
}

const STATUSES = ["light", "disgrace", "neutral"]
const COMPARATORS = ["eq", "gte", "lte", "gt", "lt"]
const OPPONENTS = ["leftNeighbor", "rightNeighbor", "allOpponents", "anyOpponent"]
const oneOf = (value: unknown, list: readonly string[], field: string) => {
  if (!list.includes(value as string)) throw new Error(`invalid ${field}: ${JSON.stringify(value)}`)
}

/** Vérifie les valeurs d'une condition Sanity (une faute de saisie ne doit pas produire une mission impossible). */
function checkCondition(c: ConditionSanity) {
  if (c.familyFilter) oneOf(c.familyFilter, FAMILIES, "familyFilter")
  if (c.roleFilter) oneOf(c.roleFilter, [...ROLES, "noRole"], "roleFilter")
  if (c.comparator) oneOf(c.comparator, COMPARATORS, "comparator")
  if (c.level) oneOf(c.level, ["up", "down"], "level")
  if (c.mode) oneOf(c.mode, ["cards", "weight"], "mode")
  if (c.type === "familyStatus") oneOf(c.family, FAMILIES, "family")
  if (c.type === "familyStatus" || c.type === "familiesWithStatus") oneOf(c.status, STATUSES, "status")
  if (c.type === "playerComparison") oneOf(c.opponent, OPPONENTS, "opponent")
  if ((c.type === "and" || c.type === "or") && (c.conditions?.length ?? 0) < 2) throw new Error(`${c.type}: at least 2 conditions`)
  if (c.type === "not" && c.conditions?.length !== 1) throw new Error("not: exactly 1 condition")
  c.conditions?.forEach(checkCondition)
}

export function toCondition(c: ConditionSanity): Condition {
  const comparator = (c.comparator ?? "gte") as Extract<Condition, { comparator: unknown }>["comparator"]
  const mode = (c.mode ?? "cards") as "cards" | "weight"
  switch (c.type) {
    case "familyStatus":
      return { type: "familyStatus", family: c.family as Family, status: c.status as "light" }
    case "familiesWithStatus":
      return { type: "familiesWithStatus", status: c.status as "light", comparator, value: c.value ?? 0 }
    case "domainCards":
      return { type: "domainCards", filter: filter(c), comparator, value: c.value ?? 0, mode }
    case "tableCards":
      return {
        type: "tableCards",
        filter: filter(c),
        comparator,
        value: c.value ?? 0,
        mode,
        ...(c.level ? { level: c.level as "up" | "down" } : {}),
      }
    case "playerComparison":
      return { type: "playerComparison", filter: filter(c), comparator, opponent: c.opponent as "leftNeighbor", mode }
    case "and":
    case "or":
      return { type: c.type, conditions: (c.conditions ?? []).map(toCondition) }
    case "not":
      return { type: "not", condition: toCondition(c.conditions?.[0] ?? {}) }
    default:
      throw new Error(`unknown condition: ${c.type}`)
  }
}

export const FALLBACK_MISSIONS: Mission[] = DEFAULT_MISSIONS

export async function loadMissions(playerCount: number): Promise<Mission[]> {
  let fromSanity: Mission[] = []
  try {
    const { missions } = await getCatalog()
    fromSanity = missions.flatMap((m) => {
      try {
        if (m.color !== "white" && m.color !== "blue") throw new Error(`invalid color: ${JSON.stringify(m.color)}`)
        checkCondition(m.condition as ConditionSanity)
        return [
          {
            id: m._id,
            color: m.color as Mission["color"],
            // Default-language text, frozen into the game state as a fallback only: clients render
            // `catalog.missionTexts[id]` in the player's language (see getClientCatalog).
            text: translate(m.text) ?? "",
            condition: toCondition(m.condition as ConditionSanity),
          },
        ]
      } catch (error) {
        // visible dans les logs Vercel : la mission est ignorée et remplacée par une mission par défaut
        console.warn(`Sanity mission ${m._id} skipped: ${(error as Error).message}`)
        return []
      }
    })
  } catch (error) {
    console.error("Sanity catalog unavailable", error)
  }

  return (["white", "blue"] as const).flatMap((color) => {
    const valid = fromSanity.filter((m) => m.color === color)
    const texts = new Set(valid.map((m) => m.text))
    const fillers = FALLBACK_MISSIONS.filter((m) => m.color === color && !texts.has(m.text))
    return [...valid, ...fillers.slice(0, Math.max(0, playerCount - valid.length))]
  })
}
