import type { UiTheme } from "@pbgo/core/lib/binding"

/**
 * Look of the shared in-game UI for Courtisans: the banquet. Gold lines on a teal table, white letters in the accent font
 * (Typey) over a black veil, round seat badges, a gold-edged panel with a cream polaroid at the end, and lively motion
 * (confetti, springs, the emoji burst). The table's own colors and fonts are the skin edited in the admin (Visual); these values
 * are the ones the UI had before games could tune it, written out so that nothing the other games change can move Courtisans.
 */
export const UI_THEME: UiTheme = {
  motion: "lively",
  announcement: {
    font: "var(--font-accent, var(--font-title))",
    color: "#ffffff",
    outline: "#f2b705",
    shadow: "#000000",
    veil: "#000000",
    rule: "#f5c542",
    confetti: { color: "#ffd35c", shape: "star" },
  },
  seat: {
    shape: "disc",
    ring: "rgb(255 255 255 / 0.45)",
    font: "var(--font-title)",
    name: "seat",
  },
  gameOver: {
    surface: "var(--surface)",
    border: "color-mix(in oklab, var(--accent-game) 60%, transparent)",
    radius: "1.5rem",
    ink: "var(--foreground)",
    accent: "var(--accent-game)",
    frame: "#f3ecd6",
  },
}
