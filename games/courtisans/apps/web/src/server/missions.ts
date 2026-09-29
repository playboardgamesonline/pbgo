import "server-only"
import type { Condition, Family, Mission, Role } from "@courtisans/engine"
import { translate } from "@pgo/core/lib/i18n"
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
      throw new Error(`Condition inconnue : ${c.type}`)
  }
}

export const FALLBACK_MISSIONS: Mission[] = DEFAULT_MISSIONS

export async function loadMissions(playerCount: number): Promise<Mission[]> {
  let fromSanity: Mission[] = []
  try {
    const { missions } = await getCatalog()
    fromSanity = missions.flatMap((m) => {
      try {
        return [
          {
            id: m._id,
            color: m.color as Mission["color"],
            text: translate(m.text) ?? "",
            condition: toCondition(m.condition as ConditionSanity),
          },
        ]
      } catch {
        return []
      }
    })
  } catch (error) {
    console.error("Catalogue Sanity indisponible", error)
  }

  return (["white", "blue"] as const).flatMap((color) => {
    const valid = fromSanity.filter((m) => m.color === color)
    const texts = new Set(valid.map((m) => m.text))
    const fillers = FALLBACK_MISSIONS.filter((m) => m.color === color && !texts.has(m.text))
    return [...valid, ...fillers.slice(0, Math.max(0, playerCount - valid.length))]
  })
}
