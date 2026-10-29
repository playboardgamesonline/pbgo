// The platform's motion for what CSS cannot do (a layout animation, a sequence, a spring): the same numbers as `styles/platform.css`, in the
// units that `motion/react` takes (seconds, and an easing as the four numbers of a cubic bezier). `motion.test.ts` reads the stylesheet and
// fails when a copy has drifted. The games' own UI uses the same easing (`EASE_STANDARD` of `@pbgo/core/lib/motion-preference`).

/** `--transition-duration-fast|base|slow`: an overlay entering or leaving, a hover or a focus, something that travels. In seconds. */
export const DURATION = { fast: 0.1, base: 0.15, slow: 0.25 } as const

/** `--ease-standard`: the one easing, quick to leave and slow to settle. `cubic-bezier(0.2, 0, 0, 1)`. */
export const EASE_STANDARD = [0.2, 0, 0, 1] as const

/**
 * How the pieces of the home's title play, chosen on `/design` (section `playful-motion`) among five ways each, and calmed a little after that: a die that rolls (`TitleDie`), a coin that is tossed
 * (`TitleCoin`) and a wheel of suits (`TitleSuits`). The platform's own motion is calm on purpose (the durations and the easing above); this is where it may play, and nowhere else. A piece
 * gets a curve, the seconds that a turn takes, and what it adds to the turn: a swell, a dip, a landing, a pop. Seconds, and degrees; `em` for a distance, so that it follows the size of the title.
 */
export const PLAYFUL = {
  /** The die: an exponential in and out (slow to wake up, all at once, a long gentle stop), and it swells toward the viewer at the fastest moment, scale 1 → `swell` → 1 over the roll. */
  die: { ease: [0.87, 0, 0.13, 1], secondsATurn: 0.75, swell: 1.12 },
  /**
   * The coin: a cubic in and out, and a toss: it dips as if gathering itself (scale 1 → `dip`), swells toward the viewer at the top of the toss (`swell`, half way), and lands with a squash
   * (`squash`, 0.07 s) that springs back.
   */
  coin: { ease: [0.65, 0, 0.35, 1], secondsATurn: 0.9, dip: 0.95, swell: 1.12, squash: 0.94, landing: { type: "spring", stiffness: 320, damping: 14 } },
  /**
   * The suits: a wheel, like the reel of a slot machine, that scrolls up through the four suits (a red one and a black one in turn) and stops on a random one: from `min` to `max` places (never a whole turn of the four,
   * so it never stops where it was), `secondsAPlace` each on average, with a long ease-out, a little past its stop (`overshoot`, in places) and back on a spring (`settle`). At speed the suits are stretched (`stretch` a
   * place a second, at most `maxStretch`), as a blur would.
   */
  suit: {
    wheel: { ease: [0.12, 0.75, 0.2, 1], secondsAPlace: 0.17, min: 9, max: 17, overshoot: 0.14, settle: { type: "spring", stiffness: 240, damping: 15 }, stretch: 0.012, maxStretch: 0.35 },
  },
} as const

/**
 * Something that moves to a place it was not, and has to feel attached to the hand that asked: the indicator that glides from one tab of
 * the navbar to the next. A stiff spring (a damping ratio of about 0.9, so no overshoot worth seeing) that settles in about 0.25 s.
 */
export const SPRING_TRAVEL = { type: "spring", stiffness: 520, damping: 42 } as const
