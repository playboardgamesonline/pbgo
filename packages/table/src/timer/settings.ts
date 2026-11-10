import type { Field } from "../debug/settings"

/** The height of an hourglass when the game does not say, in world units: tall enough to be read from the far side of the table */
export const TIMER_SIZE = 2.2

/**
 * The settings every `Timer` reads, live, on every frame: one object for all the timers of the page, so a debug panel can tune them while the game runs. How long the hourglass takes to turn over when a new step starts, how high it hops as it does,
 * when the sand begins to warn that time is running out and how the hourglass trembles then, and its shadow.
 */
export const TIMER_SETTINGS = {
  /** Seconds the hourglass takes to turn over when a new step starts its clock */
  flip: 0.7,
  /** How high it rises as it turns, in its own heights */
  hop: 0.2,
  /** How many seconds before the end the sand begins to turn red and the hourglass to tremble */
  warn: 5,
  /** How far the hourglass trembles at the end of its warning, in radians */
  tremble: 0.05,
  /** Opacity of its shadow on the table */
  shadow: 0.4,
}

/** The knobs a debug panel offers for `TIMER_SETTINGS` */
export const TIMER_FIELDS = {
  flip: ["turn over (s)", 0.1, 2, 0.05],
  hop: ["hop (heights)", 0, 1, 0.01],
  warn: ["warning (s)", 0, 30, 0.5],
  tremble: ["tremble (rad)", 0, 0.2, 0.005],
  shadow: ["shadow", 0, 1, 0.01],
} satisfies Partial<Record<keyof typeof TIMER_SETTINGS, Field>>
