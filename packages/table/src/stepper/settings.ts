import type { Field } from "../debug/settings"

/**
 * The settings every `Stepper` reads, live: one object for all the steppers of the page, so a debug panel can tune them while the game runs. How a held arrow repeats, and how far an arrow rises under the pointer and sinks when it is pressed.
 */
export const STEPPER_SETTINGS = {
  /** Seconds a held arrow waits before it repeats */
  delay: 0.4,
  /** Seconds between the first repeats */
  every: 0.16,
  /** The fewest seconds between two repeats, which they speed up to */
  fastest: 0.04,
  /** What each wait is multiplied by to get the next one: below 1 the repeats come faster and faster */
  faster: 0.88,
  /** How far an arrow rises when the pointer is over it, in world units */
  rise: 0.05,
  /** How far an arrow sinks into the table while it is pressed */
  sink: 0.04,
}

/** The knobs a debug panel offers for `STEPPER_SETTINGS` */
export const STEPPER_FIELDS = {
  delay: ["hold before it repeats (s)", 0.1, 1.5, 0.05],
  every: ["first repeats every (s)", 0.04, 0.6, 0.01],
  fastest: ["fastest repeats (s)", 0.01, 0.2, 0.005],
  faster: ["speed-up of each repeat", 0.5, 1, 0.01],
  rise: ["rise under the pointer", 0, 0.2, 0.005],
  sink: ["sink when pressed", 0, 0.1, 0.005],
} satisfies Partial<Record<keyof typeof STEPPER_SETTINGS, Field>>
