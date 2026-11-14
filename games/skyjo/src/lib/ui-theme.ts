import type { UiTheme } from "@pbgo/core/lib/binding"

/**
 * Look of the shared in-game UI for Skyjo, all of it from the game's settings: no colour of its own, every value points at a token of the theme set in the gamemaster (Visual), so changing the theme changes the announcements, the avatars and the end-of-game
 * panel with it. A calm card game: calm motion and round avatars.
 */
export const UI_THEME: UiTheme = {
  motion: "calm",
  announcement: {
    font: "var(--font-title)",
    color: "var(--foreground)",
    outline: null,
    shadow: "var(--surface-dark)",
    veil: "var(--surface-dark)",
    rule: "var(--accent-game)",
  },
  seat: {
    shape: "disc",
    ring: "var(--foreground)",
    font: "var(--font-title)",
  },
  gameOver: {
    surface: "var(--surface)",
    border: "var(--accent-game)",
    radius: "1.5rem",
    ink: "var(--foreground)",
    accent: "var(--accent-game)",
    frame: "var(--foreground)",
  },
}
