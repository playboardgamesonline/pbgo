import { TIERS, type Division, type Rank, type Tier } from "@pbgo/ui/ranks"

/**
 * The ladder of the ranks (PLT-105): a player reaches a rank by reaching a number of points. They earn the rank points by playing the game, more for a win over a stronger player and less for a win over a weaker one, and lose them
 * by losing, more to a weaker player than to a stronger one (`rate_game`, migration 0007); the rank is read from the total by the steps below, the same for every player of every game, whatever the number of players. A division holds
 * `DIVISION_POINTS`, a tier three divisions, so the 24 steps from Apprentice I to Grandmaster III hold 2,400 points, and Legend, the top, has no division. The hidden rating the points come from is never here.
 */

/** The points a division holds: a player moves up a division at this many (`RankProgress.needed`). */
export const DIVISION_POINTS = 100

/** The points of Legend: the 24 steps below it hold `DIVISION_POINTS` each. */
export const LEGEND_POINTS = 24 * DIVISION_POINTS

/** The rank at a number of points. Fewer than none read as Apprentice I, and the points of Legend or more as Legend. */
export function rankOfPoints(points: number): Rank {
  const step = Math.max(0, Math.floor(points / DIVISION_POINTS))
  if (step >= LEGEND_POINTS / DIVISION_POINTS) return { tier: "Legend" }
  return { tier: TIERS[Math.floor(step / 3)] as Exclude<Tier, "Legend">, division: ((step % 3) + 1) as Division }
}

/** How far a number of points is through its division, out of `DIVISION_POINTS`; null for Legend, where a rank is a place and not a score. */
export function progressOfPoints(points: number): { points: number; needed: number } | null {
  if (points >= LEGEND_POINTS) return null
  return { points: Math.min(Math.max(Math.floor(points) % DIVISION_POINTS, 0), DIVISION_POINTS - 1), needed: DIVISION_POINTS }
}
