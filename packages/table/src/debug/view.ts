import { notifySettings, type Field } from "./settings"

/**
 * What the debug panel draws over the table, read by the pieces that draw it (a `Zone`, a `Seat`, the card under the pointer). Everything is off until the panel
 * switches it on, and closing the panel puts it all back, so a table that is not being debugged draws none of it.
 */
export const DEBUG_VIEW = {
  /** The three axes at the middle of the table: x to the right, y up, z toward the viewer */
  axes: false,
  /** The frame of each zone, and the place of each of its slots, the size of a card */
  zones: false,
  /** The spot each seat is given on the ring, the middle of its plate, and the line between them */
  seats: false,
  /** The card under the pointer is read in the Inspector folder */
  inspector: false,
}
export type DebugView = typeof DEBUG_VIEW

/** The knobs of the View folder */
export const VIEW_FIELDS = {
  axes: "axes",
  zones: "zone frames and slots",
  seats: "seat spots and plates",
  inspector: "inspect the card under the pointer",
} satisfies Record<keyof DebugView, Field>

/** The slow motion of the table: `speed` is the share of real time a frame lasts (1 plays as usual), `freeze` stops it */
export const TIME = { speed: 1, freeze: false }

/** The knobs of the Time folder */
export const TIME_FIELDS = {
  speed: ["speed ×", 0.05, 1, 0.05],
  freeze: "freeze",
} satisfies Record<keyof typeof TIME, Field>

/** Puts the view and the time back to normal: what closing the panel does */
export function resetView() {
  Object.assign(DEBUG_VIEW, { axes: false, zones: false, seats: false, inspector: false } satisfies DebugView)
  Object.assign(TIME, { speed: 1, freeze: false })
  notifySettings()
}
