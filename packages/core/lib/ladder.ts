import { TIERS, type Division, type Rank, type Tier } from "@pbgo/ui/ranks"

/**
 * The ladder of the ranks as the database tells it (PLT-105, migration 0009): a rank is a score, 100 for each of the 24 steps from Apprentice I (0) to Grandmaster III (2399) and, inside a step, the points of how far the player is through
 * their division (0 to 99); Legend, the top of the board, is 2400. The database works the score out from the place of a player among the players of the game (`ladder_score_of`); this file reads it into the tier and the division, and the points,
 * that the pages draw. The rating that the place comes from is never here.
 */

/** The points a division holds: a player moves up a division at this many (`RankProgress.needed`). */
export const DIVISION_POINTS = 100

/** The score of Legend: the 24 steps below it hold `DIVISION_POINTS` each. */
export const LEGEND_SCORE = 24 * DIVISION_POINTS

/** The rank at a score on the ladder. A score below the first step reads as Apprentice I, one above the last as Legend. */
export function rankOfScore(score: number): Rank {
  const step = Math.max(0, Math.floor(score / DIVISION_POINTS))
  if (step >= LEGEND_SCORE / DIVISION_POINTS) return { tier: "Legend" }
  return { tier: TIERS[Math.floor(step / 3)] as Exclude<Tier, "Legend">, division: ((step % 3) + 1) as Division }
}

/** How far a score is through its division, in points out of `DIVISION_POINTS`; null for Legend, where a rank is a place and not a score. */
export function progressOfScore(score: number): { points: number; needed: number } | null {
  if (score >= LEGEND_SCORE) return null
  return { points: Math.min(Math.max(Math.floor(score) % DIVISION_POINTS, 0), DIVISION_POINTS - 1), needed: DIVISION_POINTS }
}
