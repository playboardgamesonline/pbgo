import type { Field } from "../debug/settings"

/**
 * The settings every `Counter` reads, live: one object for all the counters of the page, so a debug panel can tune them while the game runs. How long a counter takes to count, how many numbers it shows on the way, how much a number swells
 * each time it changes, and how a change floats up beside it.
 */
export const COUNTER_SETTINGS = {
  /** The most seconds a change takes to count up or down: a long change takes this long, a short one less */
  seconds: 0.8,
  /** The most seconds one number stays up on average: a change of a few counts is quick */
  tick: 0.09,
  /** The most numbers shown on the way: a jump of a hundred shows this many, not a hundred */
  maxSteps: 30,
  /** How much the number swells each time it changes, as a part of its size */
  pop: 0.18,
  /** Seconds the swelling takes to go */
  popSeconds: 0.22,
  /** Seconds the change ("+3") takes to float up and fade */
  floatSeconds: 1.2,
  /** How far the change floats up, in heights of the number */
  floatRise: 0.9,
}

/** The knobs a debug panel offers for `COUNTER_SETTINGS` */
export const COUNTER_FIELDS = {
  seconds: ["counting time (s)", 0.1, 4, 0.05],
  tick: ["time per number (s)", 0.02, 0.3, 0.01],
  maxSteps: ["most numbers shown", 1, 100, 1],
  pop: ["pop", 0, 0.8, 0.01],
  popSeconds: ["pop (s)", 0.05, 1, 0.01],
  floatSeconds: ["change floats (s)", 0.2, 3, 0.05],
  floatRise: ["change rises (heights)", 0, 3, 0.05],
} satisfies Partial<Record<keyof typeof COUNTER_SETTINGS, Field>>
