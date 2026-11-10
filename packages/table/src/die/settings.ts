import type { Field } from "../debug/settings"

/** The distance across a die from a face to the one opposite when the game does not say, in world units: the edge of a cube. A little under half the width of the template's cards */
export const DIE_SIZE = 0.5

/**
 * The settings every `Die` reads. The physics ones (`gravity` to `spin`) are read when a roll is thrown, so they change the next roll; `speed`, `shadow` and `glide` are read on every frame. One object for all the dice of the
 * page, so a debug panel can tune them while the game runs.
 */
export const DIE_SETTINGS = {
  /** How fast things fall, in world units per second squared */
  gravity: 40,
  /** How much a die bounces back from the table, 0 to 1 */
  restitution: 0.55,
  /** How much a die grips the table */
  friction: 0.35,
  /** How fast a die is thrown, in world units per second */
  throwSpeed: 7,
  /** Multiplier on how fast it spins as it leaves the hand */
  spin: 1.4,
  /** Multiplier on how fast a roll plays back: 1 is as simulated, 0.5 shows it in slow motion */
  speed: 1,
  /** Opacity of its shadow on the table */
  shadow: 0.5,
  /** Seconds a die takes to move to a new place, or to turn onto another face, when it does not roll: about, the smaller the snappier */
  glide: 0.18,
}

/** The knobs a debug panel offers for `DIE_SETTINGS` */
export const DIE_FIELDS = {
  gravity: ["gravity", 10, 300, 1],
  restitution: ["bounce", 0, 0.95, 0.01],
  friction: ["grip", 0, 2, 0.01],
  throwSpeed: ["throw speed", 1, 30, 0.1],
  spin: ["spin (×)", 0, 3, 0.05],
  speed: ["playback speed (×)", 0.1, 2, 0.05],
  shadow: ["shadow", 0, 1, 0.01],
  glide: ["glide (s)", 0.02, 1, 0.01],
} satisfies Partial<Record<keyof typeof DIE_SETTINGS, Field>>

/** What the debug panel asks of every die: `replays` goes up each time its button is pressed, and a die throws again, toward the face it shows, when it sees it change */
export const DIE_DEBUG = { replays: 0 }
