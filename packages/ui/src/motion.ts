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
  /**
   * The die: an exponential in and out (slow to wake up, all at once, a long gentle stop), `turns` whole turns (at random, from `min` to `max`) and the quarter turns it takes to land on the side it `lands` on that it does not show (a three and a six: it switches from one to the other), `secondsATurn` a turn,
   * and it swells toward the viewer at the fastest moment, scale 1 → `swell` → 1 over the roll.
   */
  die: { ease: [0.87, 0, 0.13, 1], secondsATurn: 0.75, turns: { min: 2, max: 3 }, lands: [3, 6], swell: 1.12 },
  /**
   * The coin: a cubic in and out, `turns` whole turns (at random, from `min` to `max`, so that it always lands on its profile), `secondsATurn` each, and a toss: it dips as if gathering itself (scale 1 → `dip`), swells
   * toward the viewer at the top of the toss (`swell`, half way), and lands with a squash (`squash`, 0.07 s) that springs back.
   */
  coin: { ease: [0.65, 0, 0.35, 1], secondsATurn: 0.9, turns: { min: 1, max: 2 }, dip: 0.95, swell: 1.4, squash: 0.94, landing: { type: "spring", stiffness: 320, damping: 14 } },
  /**
   * The cards: the two backs of a deck after "games" fold up and open again. The fan closes in `fold` seconds, an ease in and out: the cards straighten to `closed.turn` degrees each and come within `closed.gap` ems of each other;
   * they stay closed for `hold` seconds; and the fan opens again on a spring (`open`), a little wider than it stands before it settles.
   */
  cards: { fold: 0.35, ease: [0.65, 0, 0.35, 1], hold: 0.3, closed: { turn: 2, gap: 0.04 }, open: { type: "spring", stiffness: 280, damping: 15 } },
  /**
   * The suits: a wheel, like the reel of a slot machine, that scrolls up through the four suits (a red one and a white one in turn) and always stops on the heart it started on: `laps` of the four suits, from `min` to `max` (whole
   * laps, so that it comes back to the heart), `secondsAPlace` a place on average, with a wind-up and a long ease-out (it starts at the average speed, is twice and a half as fast a fifth of the way through, and stops slowly), a little past
   * its stop (`overshoot`, in places) and back on a spring (`settle`). It is faded at the top and at the bottom of its window (the stylesheet), and the faster it goes the more it is blurred, up and down only: a deviation of
   * `blur.perPlaceASecond` ems a place a second, `blur.max` at most. The suits are also stretched a little (`stretch` a place a second, `maxStretch` at most), as a shutter would drag them.
   */
  suit: {
    wheel: {
      ease: [0.3, 0.3, 0.2, 1],
      secondsAPlace: 0.32,
      laps: { min: 2, max: 3 },
      overshoot: 0.1,
      settle: { type: "spring", stiffness: 240, damping: 15 },
      stretch: 0.02,
      maxStretch: 0.2,
      blur: { perPlaceASecond: 0.012, max: 0.1 },
    },
  },
} as const

/**
 * Something that moves to a place it was not, and has to feel attached to the hand that asked: the indicator that glides from one tab of
 * the navbar to the next. A stiff spring (a damping ratio of about 0.9, so no overshoot worth seeing) that settles in about 0.25 s.
 */
export const SPRING_TRAVEL = { type: "spring", stiffness: 520, damping: 42 } as const
