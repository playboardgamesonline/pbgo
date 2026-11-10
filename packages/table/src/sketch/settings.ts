import type { Field } from "../debug/settings"

/**
 * The settings every `Sketch` reads, live: one object for all the sheets of the page, so a debug panel can tune them while the game runs. How a stroke is thinned before it is sent (the points kept, in units of the sheet's grid), and when
 * the strokes a player has finished are sent to the board, in batches, so that a fast drawer does not make a request for each stroke.
 */
export const SKETCH_SETTINGS = {
  /** How far, in grid units, the stroke may be from the line the player drew when its points are thinned out: the larger, the fewer points and the more angular the line */
  tolerance: 2.5,
  /** The least distance, in grid units, between two points the pen records */
  spacing: 3,
  /** Seconds after a stroke is finished before the strokes not yet sent go to the board, when no other stroke follows */
  settle: 0.4,
  /** The most seconds a finished stroke waits to be sent, however fast the next ones follow */
  flush: 1.5,
  /** Seconds a stroke that was sent is still drawn from the sheet's own memory while the board has not given it back: after that it is taken to be refused */
  pending: 4,
}

/** The knobs a debug panel offers for `SKETCH_SETTINGS` */
export const SKETCH_FIELDS = {
  tolerance: ["thinning (grid units)", 0, 12, 0.1],
  spacing: ["point spacing (grid units)", 0, 20, 0.5],
  settle: ["send after a pause (s)", 0, 2, 0.05],
  flush: ["send at the latest (s)", 0.2, 5, 0.1],
  pending: ["wait for the board (s)", 0.5, 15, 0.5],
} satisfies Partial<Record<keyof typeof SKETCH_SETTINGS, Field>>
