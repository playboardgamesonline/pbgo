import type { Field } from "../debug/settings"

/**
 * The settings every drag and every zone reads, live: one object for all the tables of the page, so a debug panel can tune them while the game runs. How far the pointer goes before a press is a drag, how a thing that is held floats and follows, and how
 * a zone shows that it can be dropped on.
 */
export const DRAG_SETTINGS = {
  /** How far, in pixels, the pointer goes from where it went down before the press is a drag and no longer a click */
  threshold: 6,
  /** How high a dragged thing floats above its place, in world units */
  lift: 0.5,
  /** Seconds a dragged thing takes to catch up with the pointer, about */
  follow: 0.05,
  /** How much bigger a dragged card is than when it lies */
  grow: 1.06,
  /** The farthest from the middle of the table a thing is dragged, in world units: a pointer just under the horizon meets the table very far away */
  reach: 40,
  /** How wide the line round a zone is, in world units */
  line: 0.08,
  /** The opacity of the line round a zone the dragged thing may be let go on, and how much it pulses */
  glow: 0.6,
  pulse: 0.2,
  /** The opacity of the inside of the zone the thing is over */
  fill: 0.22,
}

/** The knobs a debug panel offers for `DRAG_SETTINGS` */
export const DRAG_FIELDS = {
  threshold: ["threshold (px)", 0, 30, 1],
  lift: ["lift", 0, 2, 0.05],
  follow: ["follow (s)", 0.001, 0.5, 0.005],
  grow: ["card growth", 1, 1.5, 0.01],
  reach: ["reach", 5, 100, 1],
  line: ["zone line", 0.01, 0.4, 0.01],
  glow: ["zone glow", 0, 1, 0.01],
  pulse: ["zone pulse", 0, 0.5, 0.01],
  fill: ["zone fill", 0, 1, 0.01],
} satisfies Partial<Record<keyof typeof DRAG_SETTINGS, Field>>

/** The seconds a held thing takes to catch up with the pointer: none to speak of for a visitor who asks for less motion, so it is where the pointer is */
export const followSeconds = (reduced: boolean): number => (reduced ? 0.001 : DRAG_SETTINGS.follow)
