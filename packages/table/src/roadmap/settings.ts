/**
 * The numbers a `RoadMap` reads on every frame, which the debug panel edits (`ROAD_MAP_FIELDS`): how thick a road is, how big a place is, how much room each leaves to the pointer, and how a ring that offers a choice pulses.
 */
export const ROAD_MAP_SETTINGS = {
  /** How wide the line of a road is, in world units */
  roadWidth: 0.14,
  /** How many times wider a road is drawn when it belongs to somebody (when the game gives it a colour) */
  ownedGrow: 1.9,
  /** The diameter of a place */
  placeSize: 0.46,
  /** How many times the line a road answers the pointer across, and the least it answers across: a thin road is still easy to press */
  hitGrow: 2.6,
  minHit: 0.36,
  /** How far outside a place its ring stands, as a multiple of its radius, and how wide the ring is */
  ringGrow: 1.5,
  ringWidth: 0.12,
  /** How fast a ring or a strip that offers a choice pulses, in radians a second */
  pulseSpeed: 3.2,
  /** How opaque a road that nobody has is drawn, and how opaque a ring or a strip is at its dimmest and at its brightest */
  faint: 0.3,
  haloLow: 0.3,
  haloHigh: 0.9,
}

type Knob = [label: string, min: number, max: number, step: number]

/** The knobs a debug panel can offer for `ROAD_MAP_SETTINGS`, one for each of its fields */
export const ROAD_MAP_FIELDS = {
  roadWidth: ["road width", 0.04, 0.5, 0.01],
  ownedGrow: ["owned road grows", 1, 4, 0.05],
  placeSize: ["place size", 0.1, 1.2, 0.01],
  hitGrow: ["road hit area", 1, 6, 0.1],
  minHit: ["least road hit width", 0.1, 1, 0.01],
  ringGrow: ["ring reach", 1, 3, 0.01],
  ringWidth: ["ring width", 0.02, 0.4, 0.01],
  pulseSpeed: ["ring pulse speed", 0, 10, 0.1],
  faint: ["road with no owner opacity", 0, 1, 0.01],
  haloLow: ["ring dimmest", 0, 1, 0.01],
  haloHigh: ["ring brightest", 0, 1, 0.01],
} satisfies Record<keyof typeof ROAD_MAP_SETTINGS, Knob>
