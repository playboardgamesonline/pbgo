import { DEFAULT_EASING } from "@pbgo/core/components/game/easing"

/**
 * The settings every `Card` reads, live, on every frame: one object for all the cards of the page, so a debug panel can tune them while the game runs.
 * What a glow looks like (colours, pulses) belongs to the glow itself, see `defineGlows`.
 */
export const CARD_SETTINGS = {
  /** Opacity of the shine that follows the pointer over a hovered card (a card can ask for its own, see `gloss`) */
  gloss: 0.5,
  /** How far that shine slides with the pointer */
  glossMotion: 0.45,
  /** Opacity of the drop shadow */
  shadow: 0.06,
  /** Multiplier on how long a flight lasts */
  flightDuration: 0.64,
  /** Multiplier on how high a flight arches */
  flightHeight: 0.64,
  /** Name of the easing of a flight, one of `EASING_NAMES` */
  easing: DEFAULT_EASING as string,
  /** Thickness of the card, as a fraction of its width */
  thickness: 0.005,
  /** How much the card arches in flight, as a fraction of its half height */
  foldable: 0.04,
}
