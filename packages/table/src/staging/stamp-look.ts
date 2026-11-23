// The pure half of a stamp, something that lands on the table with a thump: from nothing it grows past its size and settles back to it while it comes down onto its place. No three.js and no React: `stamp.tsx` draws it and
// `staging.test.ts` holds it.

/** How long a stamp waits before it lands and takes to land, in seconds, how far above its place it starts, in world units, and how far past its size it grows (the overshoot of an ease-out-back), unless a game says another */
export const STAMP = { delay: 0, duration: 0.45, drop: 0.9, overshoot: 1.9 } as const

/** How long a stamp waits and takes, in seconds, and how far above its place it starts */
export type StampTiming = { delay?: number; duration?: number; drop?: number }

/**
 * What a stamp is `elapsed` seconds after it began: it is not seen until `delay` has passed, then it grows from nothing to a little too big and back to its size over `duration`, and comes down from `drop` above its place, fast at first and settling. An
 * `elapsed` of infinity is a stamp that has landed.
 */
export function stampAt(elapsed: number, { delay = STAMP.delay, duration = STAMP.duration, drop = STAMP.drop }: StampTiming = {}): { visible: boolean; scale: number; lift: number } {
  const t = Math.min(1, Math.max(0, (elapsed - delay) / Math.max(1e-6, duration)))
  const c1 = STAMP.overshoot
  const c3 = c1 + 1
  return { visible: elapsed >= delay, scale: Math.max(0.001, 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2), lift: (1 - t) ** 2 * drop }
}
