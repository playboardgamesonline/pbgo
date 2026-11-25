// The pure half of a glide, a group of the table that moves to where it is asked to lie: where it is after a moment. No three.js and no React: `glide.tsx` moves the group and `glide-step.test.ts` holds this.

/** How fast the group closes on its place, per second: it covers about 95 % of the way in under half a second (`ln 20 / 7`), a little slower than a card gliding to a slot, since it has more to carry */
export const GLIDE_RATE = 7

/** How near the target an axis has to be for it to land on it, in world units: a group never creeps toward its place for ever */
const LANDED = 0.001

/**
 * Where one axis of the group is after `dt` seconds of heading for `target`: it closes a share of the distance that does not depend on how long a frame took, so the same time covers the same way at any frame rate, and it never goes past the target. With reduced motion the group
 * is there at once: it lies where it is asked to, never on its way.
 */
export function glideStep(current: number, target: number, dt: number, reduced: boolean): number {
  if (reduced) return target
  const next = current + (target - current) * (1 - Math.exp(-GLIDE_RATE * Math.max(0, dt)))
  return Math.abs(target - next) < LANDED ? target : next
}
