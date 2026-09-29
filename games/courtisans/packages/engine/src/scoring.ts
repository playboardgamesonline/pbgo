import type { PlayerResult, Results } from "@pgo/engine-kit"
import { MISSION_POINTS, weight } from "./deck"
import { evaluateCondition } from "./missions"
import { FAMILIES, type Courtier, type Family, type GameState, type Placement, type Status } from "./types"

export type FamilyStatus = { up: number; down: number; status: Status }
export type Statuses = Record<Family, FamilyStatus>

export type FamilyDetail = { family: Family; weight: number; points: number }

/** Résultat d'un joueur : contrat commun (`detail` générique) + détail propre à Courtisans (familles, missions). */
export type CourtisansPlayerResult = PlayerResult & {
  domainPoints: number
  families: FamilyDetail[]
  missions: { missionId: string; done: boolean; points: number }[]
}

export type CourtisansResults = Omit<Results, "players"> & {
  statuses: Statuses
  players: CourtisansPlayerResult[]
}

export function computeStatuses(table: Placement[]): Statuses {
  const statuses = Object.fromEntries(FAMILIES.map((f) => [f, { up: 0, down: 0, status: "neutral" }])) as Statuses
  for (const { card, level } of table) statuses[card.family][level] += weight(card)
  for (const s of Object.values(statuses)) {
    s.status = s.up > s.down ? "light" : s.down > s.up ? "disgrace" : "neutral"
  }
  return statuses
}

export function statusValue(status: Status): number {
  return status === "light" ? 1 : status === "disgrace" ? -1 : 0
}

export function domainPoints(domain: Courtier[], statuses: Statuses): { total: number; detail: FamilyDetail[] } {
  const detail = FAMILIES.map((family) => {
    const p = domain.filter((c) => c.family === family).reduce((sum, c) => sum + weight(c), 0)
    return { family, weight: p, points: p * statusValue(statuses[family].status) }
  }).filter((d) => d.weight > 0)
  return { total: detail.reduce((sum, d) => sum + d.points, 0), detail }
}

export function computeResults(state: GameState): CourtisansResults {
  const statuses = computeStatuses(state.table)
  const players: CourtisansPlayerResult[] = state.players.map((player, index) => {
    const domain = domainPoints(player.domain, statuses)
    const missions = player.missions.map((m) => {
      const done = evaluateCondition(m.condition, { state, playerIndex: index, statuses })
      return { missionId: m.id, done, points: done ? MISSION_POINTS : 0 }
    })
    const total = domain.total + missions.reduce((sum, m) => sum + m.points, 0)
    const missionPoints = missions.reduce((sum, m) => sum + m.points, 0)
    const detail = [
      ...domain.detail.map((d) => ({ key: d.family, label: d.family, points: d.points })),
      ...(missions.length ? [{ key: "missions", label: "Missions", points: missionPoints }] : []),
    ]
    return { playerId: player.id, domainPoints: domain.total, families: domain.detail, missions, detail, total, rank: 0 }
  })

  players.sort((a, b) => b.total - a.total)
  for (const j of players) j.rank = 1 + players.filter((o) => o.total > j.total).length

  const best = players[0]?.total
  return { statuses, players, winners: players.filter((j) => j.total === best).map((j) => j.playerId) }
}
