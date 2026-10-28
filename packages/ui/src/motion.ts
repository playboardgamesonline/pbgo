// The platform's motion for what CSS cannot do (a layout animation, a sequence, a spring): the same numbers as `styles/platform.css`, in the
// units that `motion/react` takes (seconds, and an easing as the four numbers of a cubic bezier). `motion.test.ts` reads the stylesheet and
// fails when a copy has drifted. The games' own UI uses the same easing (`EASE_STANDARD` of `@pbgo/core/lib/motion-preference`).

/** `--transition-duration-fast|base|slow`: an overlay entering or leaving, a hover or a focus, something that travels. In seconds. */
export const DURATION = { fast: 0.1, base: 0.15, slow: 0.25 } as const

/** `--ease-standard`: the one easing, quick to leave and slow to settle. `cubic-bezier(0.2, 0, 0, 1)`. */
export const EASE_STANDARD = [0.2, 0, 0, 1] as const

/**
 * Something that moves to a place it was not, and has to feel attached to the hand that asked: the indicator that glides from one tab of
 * the navbar to the next. A stiff spring (a damping ratio of about 0.9, so no overshoot worth seeing) that settles in about 0.25 s.
 */
export const SPRING_TRAVEL = { type: "spring", stiffness: 520, damping: 42 } as const
