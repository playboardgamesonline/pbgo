// The level of a member, worked out from their experience (XP, the `xp` column of `profiles`, migration 0023). Only the points are stored; the table of levels is this file's, so that it can change with no migration.
// Level 0 is where everybody starts, with 0 XP, and every level takes the same: `XP_PER_LEVEL` points, so level `n` begins at `XP_PER_LEVEL * n`. A member earns one point for each action they play, in any game and any mode.

/** The points a level takes: the same for every level. */
export const XP_PER_LEVEL = 300

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
export const xpToReach = (level: number): number => XP_PER_LEVEL * level

/** The level of a member with this many points. Anything that is not a whole number of points, zero or more, counts as 0. */
export function levelOf(xp: number): Level {
  const points = Number.isSafeInteger(xp) && xp > 0 ? xp : 0
  const level = Math.floor(points / XP_PER_LEVEL)
  return { level, xp: points, from: xpToReach(level), to: xpToReach(level + 1) }
}

/** How far a member is from their level to the next, from 0 to 1. */
export const levelProgress = ({ xp, from, to }: Level): number => (to > from ? (xp - from) / (to - from) : 0)
