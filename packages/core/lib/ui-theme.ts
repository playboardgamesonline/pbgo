import type { UiTheme } from "./binding"

/**
 * Resolvers of a game's `UI_THEME` (binding): each group of the theme over its defaults, field by field. Pure, so the shared
 * components, the painters of the 3D tables and the `/design` specimens all read a theme the same way.
 */

// A field a game leaves out (or sets to undefined) keeps its default
function over<T extends object>(defaults: T, theme: Partial<T> | undefined): T {
  const merged = { ...defaults }
  for (const key of Object.keys(defaults) as (keyof T)[]) {
    const value = theme?.[key]
    if (value !== undefined) merged[key] = value as T[keyof T]
  }
  return merged
}

export type SeatTheme = Required<NonNullable<UiTheme["seat"]>>

export const DEFAULT_SEAT_THEME: SeatTheme = {
  shape: "disc",
  ring: "rgb(255 255 255 / 0.45)",
  font: "var(--font-title)",
  name: "seat",
}

/** The seat label's look: `UI_THEME.seat` of the game over the defaults. */
export const seatTheme = (theme?: UiTheme["seat"]): SeatTheme => over(DEFAULT_SEAT_THEME, theme)
