import type { UiTheme } from "./binding"

/**
 * How much the in-game UI moves, for this visitor on this game:
 * - `reduced`: the visitor asks for less motion (`prefers-reduced-motion`). Opacity fades of 150 ms at most; no travel, springs,
 *   confetti, emoji burst or looping effect. It always wins over the game's choice.
 * - `calm` (default): fades and short slides.
 * - `lively`: what the game asks for through `UI_THEME.motion`: also springs, confetti and the emoji burst.
 */
export type Motion = "reduced" | "calm" | "lively"

export function resolveMotion(prefersReduced: boolean, theme: UiTheme["motion"]): Motion {
  if (prefersReduced) return "reduced"
  return theme === "lively" ? "lively" : "calm"
}

/** Longest fade under reduced motion, in seconds (the `duration-base` token of the platform) */
export const REDUCED_FADE = 0.15

/** The `--ease-standard` token of the platform (`platform.css`) as a `motion` curve, for the transitions CSS cannot run */
export const EASE_STANDARD = [0.2, 0, 0, 1] as const

/** Seconds of a transition: under reduced motion a fade is never longer than `REDUCED_FADE` */
export const fade = (motion: Motion, seconds: number) => (motion === "reduced" ? Math.min(seconds, REDUCED_FADE) : seconds)

/** Offset (px) an element travels while it enters or leaves: none under reduced motion, which only fades */
export const travel = (motion: Motion, px: number) => (motion === "reduced" ? 0 : px)
