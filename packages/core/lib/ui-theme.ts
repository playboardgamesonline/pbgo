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

export type AnnouncementTheme = Required<NonNullable<UiTheme["announcement"]>>

/** What the announcements looked like before games could tune them: white letters with a thin gold outline, gold hairlines and stars, a black veil. */
export const DEFAULT_ANNOUNCEMENT_THEME: AnnouncementTheme = {
  font: "var(--font-accent, var(--font-title))",
  color: "#ffffff",
  outline: "#f2b705",
  shadow: "#000000",
  veil: "#000000",
  rule: "#f5c542",
  confetti: { color: "#ffd35c", shape: "star" },
}

/** The announcements' look: `UI_THEME.announcement` of the game over the defaults. `null` (outline, rule, confetti) switches the part off. */
export function announcementTheme(theme?: UiTheme["announcement"]): AnnouncementTheme {
  const merged = over(DEFAULT_ANNOUNCEMENT_THEME, theme)
  return { ...merged, confetti: merged.confetti && { ...merged.confetti } }
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
