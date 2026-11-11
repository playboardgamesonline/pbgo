/**
 * The numbers a `Sheet` paints with, which the debug panel edits (`SHEET_FIELDS`): how round and how thick the boxes are, how loud a box that can be chosen and a box under the pointer are, how big the writing and the marks are.
 */
export const SHEET_SETTINGS = {
  /** How round the corners of a cell are, as a part of its smaller side */
  radius: 0.14,
  /** How thick the border of a cell is, in pixels of the picture, and how opaque */
  border: 1.6,
  borderOpacity: 0.5,
  /** The ring of a cell that can be chosen: how thick it is, in pixels, and how much of the cell it tints */
  haloWidth: 3.6,
  haloTint: 0.12,
  /** How much the pointer tints the cell it is over */
  hoverTint: 0.22,
  /** How big the writing in a cell is, as a part of its height, and how opaque a suggestion is */
  textSize: 0.6,
  faint: 0.4,
  /** How thick the line of a mark is, as a part of the smaller side of its cell, and how much of the cell the mark covers */
  markWidth: 0.09,
  markSize: 0.72,
}

type Knob = [label: string, min: number, max: number, step: number]

/** The knobs a debug panel can offer for `SHEET_SETTINGS`, one for each of its fields */
export const SHEET_FIELDS = {
  radius: ["cell corner radius", 0, 0.5, 0.01],
  border: ["cell border width", 0, 6, 0.1],
  borderOpacity: ["cell border opacity", 0, 1, 0.01],
  haloWidth: ["choice ring width", 0, 10, 0.1],
  haloTint: ["choice tint", 0, 1, 0.01],
  hoverTint: ["pointer tint", 0, 1, 0.01],
  textSize: ["writing size", 0.2, 1, 0.01],
  faint: ["suggestion opacity", 0, 1, 0.01],
  markWidth: ["mark width", 0.02, 0.3, 0.01],
  markSize: ["mark size", 0.3, 1, 0.01],
} satisfies Record<keyof typeof SHEET_SETTINGS, Knob>
