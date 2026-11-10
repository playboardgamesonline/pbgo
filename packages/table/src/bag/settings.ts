import type { Field } from "../debug/settings"

/** The width of a bag across its belly when the game does not say, in world units: room for the pieces that come out of it, which are half that wide */
export const BAG_SIZE = 1.8

/**
 * The settings every `Bag` reads, live, on every frame: one object for all the bags of the page, so a debug panel can tune them while the game runs. How far a bag rocks when a hand rummages in it and for how long, how fast it slumps
 * as it empties, and its shadow.
 */
export const BAG_SETTINGS = {
  /** How far a bag rocks when it is shaken, in radians */
  wiggle: 0.14,
  /** Seconds the rocking lasts */
  wiggleSeconds: 0.55,
  /** Seconds a bag takes to slump or to swell as it empties or fills, about */
  slump: 0.3,
  /** Opacity of its shadow on the table */
  shadow: 0.4,
}

/** The knobs a debug panel offers for `BAG_SETTINGS` */
export const BAG_FIELDS = {
  wiggle: ["rocking (rad)", 0, 0.6, 0.01],
  wiggleSeconds: ["rocking (s)", 0.1, 2, 0.05],
  slump: ["slump (s)", 0.02, 1, 0.01],
  shadow: ["shadow", 0, 1, 0.01],
} satisfies Partial<Record<keyof typeof BAG_SETTINGS, Field>>
