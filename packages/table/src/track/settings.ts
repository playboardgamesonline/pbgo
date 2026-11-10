import type { Field } from "../debug/settings"

/**
 * The settings every `TrackMarker` reads, live: one object for all the markers of the page, so a debug panel can tune them while the game runs. How long a marker takes for each space it goes through, the most a walk may take whatever
 * its length, and how high the marker hops at each step.
 */
export const TRACK_SETTINGS = {
  /** Seconds a marker takes for one space */
  stepSeconds: 0.24,
  /** The most seconds a walk takes however many spaces it goes through: a long walk takes its steps quicker */
  maxSeconds: 1.6,
  /** How high a marker hops at each step, in widths of the marker */
  hop: 0.6,
}

/** The knobs a debug panel offers for `TRACK_SETTINGS` */
export const TRACK_FIELDS = {
  stepSeconds: ["step (s)", 0.05, 1, 0.01],
  maxSeconds: ["longest walk (s)", 0.2, 5, 0.05],
  hop: ["step hop (widths)", 0, 2, 0.05],
} satisfies Partial<Record<keyof typeof TRACK_SETTINGS, Field>>
