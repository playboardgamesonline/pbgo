import type { Field } from "../debug/settings"
import type { CupPose } from "./poses"

/** The width of a cup across its mouth when the game does not say, in world units: room for five of the template's dice under it */
export const CUP_SIZE = 1.8

/**
 * The settings every `Cup` reads, live, on every frame: one object for all the cups of the page, so a debug panel can tune them while the game runs. How long a cup takes to reach each pose (the slam onto the table is the quickest), and how
 * it rattles when it is shaken.
 */
export const CUP_SETTINGS = {
  /** Seconds a cup takes to come down over what it covers, about: the slam */
  cover: 0.07,
  /** Seconds it takes to tilt, to be looked under */
  peek: 0.2,
  /** Seconds it takes to be lifted away */
  lift: 0.3,
  /** Seconds it takes to be taken up and shaken */
  shake: 0.22,
  /** Seconds it takes to be tipped over, to pour */
  pour: 0.28,
  /** Seconds it takes to be put down on its mouth, or taken to its place */
  rest: 0.3,
  /** How far the cup rattles when it is shaken, in widths of the cup */
  rattle: 0.05,
  /** How many rattles a second */
  rattleHz: 9,
  /** Opacity of its shadow on the table */
  shadow: 0.4,
}

/** The setting that says how long a cup takes to reach each pose */
export const CUP_SPEED: Record<CupPose, "cover" | "peek" | "lift" | "shake" | "pour" | "rest"> = { covering: "cover", peeking: "peek", lifted: "lift", shaking: "shake", pouring: "pour", rest: "rest" }

/** The knobs a debug panel offers for `CUP_SETTINGS` */
export const CUP_FIELDS = {
  cover: ["slam (s)", 0.02, 0.5, 0.01],
  peek: ["peek (s)", 0.05, 1, 0.01],
  lift: ["lift (s)", 0.05, 1, 0.01],
  shake: ["take up (s)", 0.05, 1, 0.01],
  pour: ["tip over (s)", 0.05, 1, 0.01],
  rest: ["put down (s)", 0.05, 1, 0.01],
  rattle: ["rattle (widths)", 0, 0.3, 0.005],
  rattleHz: ["rattles per second", 2, 20, 0.5],
  shadow: ["shadow", 0, 1, 0.01],
} satisfies Partial<Record<keyof typeof CUP_SETTINGS, Field>>
