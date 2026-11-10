import type { Field } from "../debug/settings"

/**
 * The settings every `Slider` reads, live: one object for all the sliders of the page, so a debug panel can tune them while the game runs. How far the knob rises when the pointer is over it and when it is held, and how thick the rail is.
 */
export const SLIDER_SETTINGS = {
  /** How far the knob rises when the pointer is over it, in world units */
  rise: 0.05,
  /** How far it rises while it is held */
  held: 0.14,
  /** The thickness of the rail, in heights of the knob */
  rail: 0.3,
}

/** The knobs a debug panel offers for `SLIDER_SETTINGS` */
export const SLIDER_FIELDS = {
  rise: ["rise under the pointer", 0, 0.3, 0.005],
  held: ["rise when held", 0, 0.5, 0.01],
  rail: ["rail thickness (knobs)", 0.1, 0.8, 0.01],
} satisfies Partial<Record<keyof typeof SLIDER_SETTINGS, Field>>
