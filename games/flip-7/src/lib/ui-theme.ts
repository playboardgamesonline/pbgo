import type { UiTheme } from "@pbgo/core/lib/binding"

/**
 * Look of the shared in-game UI for Flip 7, all of it from the game's settings: no colour of its own, every value points at a token of the theme set in the gamemaster (Visual), so changing the theme changes the announcements, the avatars
 * and the end-of-game panel with it. A game of luck and nerve, played fast: lively motion (confetti, springs and the emoji burst; reduced motion still wins) and round avatars.
 */
export const UI_THEME: UiTheme = {
  motion: "lively",
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
  // The buttons on the table: a luminous blue-green for the action that goes on (Deal) and a pale cool grey with a hint of it for the quieter one (Stay), both read against the teal table and belong together. The settings' theme has no slot for them, so they are named here, in the theme of the game, once
  button: { primary: "#4fe0c0", neutral: "#b4c6d8" },
  gameOver: {
    surface: "var(--surface)",
    border: "var(--accent-game)",
    radius: "1.5rem",
    ink: "var(--foreground)",
    accent: "var(--accent-game)",
    frame: "var(--foreground)",
  },
}
