import type { UiTheme } from "@pbgo/core/lib/binding"

/**
 * Look of the shared in-game UI for Flip 7: felt and chips. Ivory letters with a coral line on the green table, round seats ringed
 * in ivory, a felt panel with a coral hairline, lively motion (springs and confetti dots). The table itself (colours, fonts) is the
 * skin, `skin.ts`; the other universes are Courtisans' banquet and the template's paper & ink.
 */
const IVORY = "#f7f1e1"
const CORAL = "#ff5a4d"
const FELT_DARK = "#0b2418"

export const UI_THEME: UiTheme = {
  motion: "lively",
  announcement: {
    font: "var(--font-accent, var(--font-title))",
    color: IVORY,
    outline: CORAL,
    shadow: FELT_DARK,
    veil: FELT_DARK,
    rule: CORAL,
    confetti: { color: CORAL, shape: "dot" },
  },
  seat: {
    shape: "disc",
    ring: "rgb(247 241 225 / 0.55)",
    font: "var(--font-title)",
    name: "seat",
  },
  gameOver: {
    surface: "var(--surface)",
    border: "color-mix(in oklab, var(--accent-game) 60%, transparent)",
    radius: "1.25rem",
    ink: "var(--foreground)",
    accent: "var(--accent-game)",
    frame: "#fffdf6",
  },
}
