import { ranks } from "@pbgo/engine-kit"
import { MISSION_POINTS } from "./catalogue"
import { isOver } from "./machine"
import { evaluateCondition, missionOf } from "./missions"
import { computeStatuses, domainPoints } from "./scoring"
import type { CourtisansPlayerResult, CourtisansResults, State } from "./types"

/**
 * The result of a finished game: for each player the points of their domain, where the Queen's table leaves each family the cards of their domain belong to, and `MISSION_POINTS` for each of their two
 * missions that holds. The best total wins, and a tie for it is shared. The booklet gives no places beyond that, so the ranks follow the totals (1, 2, 2, 4). Gives `null` while the game is on.
 */
export function results(s: State): CourtisansResults | null {
  if (!isOver(s)) return null
  const statuses = computeStatuses(s)
  const rows = s.seats.map((playerId, seat) => {
    const domain = domainPoints(s, s.domains[seat]!, statuses)
    const missions = s.missions[seat]!.map((id) => {
      const done = evaluateCondition(missionOf(id).condition, { s, seat, statuses })
      return { missionId: id, done, points: done ? MISSION_POINTS : 0 }
    })
    const missionPoints = missions.reduce((sum, mission) => sum + mission.points, 0)
    return { playerId, domainPoints: domain.total, families: domain.detail, missions, missionPoints, total: domain.total + missionPoints }
  })
  const rank = ranks(
    rows.map((row) => row.total),
    "high",
  )
  const players: CourtisansPlayerResult[] = rows
    .map(({ missionPoints, ...row }, seat) => ({
      ...row,
      rank: rank[seat]!,
      // The words of each line are `score.<key>` in the game's Sanity; `scoreLines` of the definition lists the keys
      detail: [
        { key: "domain", points: row.domainPoints },
        { key: "missions", points: missionPoints },
      ],
    }))
    // the best total first; the sort is stable: a tie keeps the seat order
    .sort((a, b) => b.total - a.total)
  const best = players[0]?.total
  return { statuses, players, winners: players.filter((player) => player.total === best).map((player) => player.playerId) }
}
