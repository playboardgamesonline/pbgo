// The level of a member, worked out from their experience (XP, the `xp` column of `profiles`, migration 0023). Only the points are stored; the table of levels is this file's, so that it can change with no migration.
// Level 0 is where everybody starts, with 0 XP. Reaching level `n` takes `LEVEL_STEP * n * (n + 1) / 2` points in all (100, 300, 600, 1000…): each level asks `LEVEL_STEP` more than the one before. A first draft, for the owner to tune.

/** The points that level 1 takes, and by how much each level after it asks more. */
export const LEVEL_STEP = 100

/** The level of a member, and where their points stand between it and the next one. */
export type Level = {
  level: number
  /** Their points in all. */
  xp: number
  /** The points at which this level began. */
  from: number
  /** The points at which the next level begins. */
  to: number
}

/** The points a member needs in all to be at `level`. */
export const xpToReach = (level: number): number => (LEVEL_STEP * level * (level + 1)) / 2

/** The level of a member with this many points. Anything that is not a whole number of points, zero or more, counts as 0. */
export function levelOf(xp: number): Level {
  const points = Number.isSafeInteger(xp) && xp > 0 ? xp : 0
  let level = Math.floor((Math.sqrt(1 + (8 * points) / LEVEL_STEP) - 1) / 2)
  // The square root can be a hair off at the edges: settle on the level whose range holds the points
  while (xpToReach(level + 1) <= points) level += 1
  while (level > 0 && xpToReach(level) > points) level -= 1
  return { level, xp: points, from: xpToReach(level), to: xpToReach(level + 1) }
}

/** How far a member is from their level to the next, from 0 to 1. */
export const levelProgress = ({ xp, from, to }: Level): number => (to > from ? (xp - from) / (to - from) : 0)
