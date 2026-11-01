// What the badge of an achievement is drawn from, for `@pbgo/ui/platform/achievement-tile`: which of its shapes and which of its marks. No React in this file, so that it is tested as it is. A game does not give art for its
// achievements yet, so the badge of each is chosen from the text that stands for it (its id): the same one every time, and not the same for every achievement.

/** How many shapes the badge has to choose from: a hexagon, a shield, a seal, a diamond and an octagon. */
export const BADGE_SHAPES = 5

/** How many marks it has to choose from, drawn in the middle of the shape: an award, a trophy, a star, a crown, a target and a flash. */
export const BADGE_MARKS = 6

/** The shape and the mark of a badge, by their place in the lists above, from the text that stands for the achievement. */
export function badgeOf(seed: string): { shape: number; mark: number } {
  // FNV-1a, 32 bits: a text always gives the same number, and two texts that look alike do not
  let hash = 0x811c9dc5
  for (let index = 0; index < seed.length; index++) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return { shape: hash % BADGE_SHAPES, mark: Math.floor(hash / BADGE_SHAPES) % BADGE_MARKS }
}
