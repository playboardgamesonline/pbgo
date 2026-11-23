// The pure half of an entrance, how far something that comes onto the table has come: it waits, then comes in over a time, fast at first and settling. No three.js and no React: `appear.tsx` draws it and `staging.test.ts` holds it.

/** How long an entrance waits before it begins and takes to come in, in seconds, unless a game says another */
export const APPEAR = { delay: 0, duration: 0.6 } as const

/** How long an entrance waits and takes, in seconds */
export type AppearTiming = { delay?: number; duration?: number }

/** How far an entrance has come `elapsed` seconds after it began: it is not seen until `delay` has passed, then it comes in over `duration` (a cubic ease-out: fast at first, settling slowly). An `elapsed` of infinity is an entrance that is over */
export function appearAt(elapsed: number, { delay = APPEAR.delay, duration = APPEAR.duration }: AppearTiming = {}): { visible: boolean; progress: number } {
  const t = Math.min(1, Math.max(0, (elapsed - delay) / Math.max(1e-6, duration)))
  return { visible: elapsed >= delay, progress: 1 - (1 - t) ** 3 }
}
