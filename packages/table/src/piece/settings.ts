import type { Field } from "../debug/settings"

/** The width of a piece when the game does not say, in world units: a little over a third of the width of the template's cards */
export const PIECE_SIZE = 0.5

/**
 * The settings every `Piece` reads, live, on every frame: one object for all the pieces of the page, so a debug panel can tune them while the game runs. How a piece flies when it jumps far is the card's (`CARD_SETTINGS`), so that
 * everything crosses the table the same way.
 */
export const PIECE_SETTINGS = {
  /** Seconds a piece takes to settle on a new place, about: the smaller, the snappier */
  glide: 0.16,
  /** Opacity of its shadow on the table */
  shadow: 0.4,
  /** How high a piece hops when it is turned over, in widths of the piece */
  hop: 0.9,
  /** Seconds a hop lasts */
  hopSeconds: 0.4,
}

/** The knobs a debug panel offers for `PIECE_SETTINGS` */
export const PIECE_FIELDS = {
  glide: ["glide (s)", 0.02, 1, 0.01],
  shadow: ["shadow", 0, 1, 0.01],
  hop: ["flip hop (widths)", 0, 3, 0.05],
  hopSeconds: ["flip hop (s)", 0.1, 1.5, 0.05],
} satisfies Partial<Record<keyof typeof PIECE_SETTINGS, Field>>
