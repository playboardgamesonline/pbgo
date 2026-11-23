import { FAMILIES } from "./catalogue"
import { typeOf, weightOf } from "./machine"
import type { FamilyDetail, State, Status, Statuses } from "./types"

/**
 * Where the Queen's table leaves each family: what the cards of the family weigh above the mat and below it (a noble weighs two), and which side wins. A family is in the light when more of it lies above
 * the mat, in disgrace when more lies below, and neutral when both sides weigh the same. A spy counts for its own family.
 */
export function computeStatuses(s: Pick<State, "ids" | "table">): Statuses {
  const statuses = Object.fromEntries(FAMILIES.map((family) => [family, { up: 0, down: 0, status: "neutral" }])) as Statuses
  for (const { card, level } of s.table) statuses[typeOf(s, card).family][level] += weightOf(s, card)
  for (const standing of Object.values(statuses)) {
    standing.status = standing.up > standing.down ? "light" : standing.down > standing.up ? "disgrace" : "neutral"
  }
  return statuses
}

/** What a card of a family is worth in a domain: one point in the light, minus one in disgrace, nothing at a tie. */
export function statusValue(status: Status): number {
  return status === "light" ? 1 : status === "disgrace" ? -1 : 0
}

/** The points of a domain: for each family it holds, the weight of its cards times what the family is worth now. */
export function domainPoints(s: Pick<State, "ids">, domain: readonly number[], statuses: Statuses): { total: number; detail: FamilyDetail[] } {
  const detail = FAMILIES.map((family) => {
    const held = domain.filter((id) => typeOf(s, id).family === family).reduce((sum, id) => sum + weightOf(s, id), 0)
    return { family, weight: held, points: held * statusValue(statuses[family].status) }
  }).filter((line) => line.weight > 0)
  return { total: detail.reduce((sum, line) => sum + line.points, 0), detail }
}
