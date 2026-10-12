import type { UiTheme } from "@pbgo/core/lib/binding"

/**
 * Look of the shared in-game UI (scores, announcements, ticker, takeover, chat): the gold of the banquet on the deep navy of
 * its skin, announcements in the accent font, lively motion (confetti, springs, emoji burst). Values are CSS strings, so the
 * colors follow the skin edited in the admin (Visual).
 */
export const UI_THEME: UiTheme = {
  accent: "var(--accent-game)",
  onAccent: "var(--surface-dark)",
  surface: "var(--surface-dark)",
  titleFont: "var(--font-accent, var(--font-title))",
  motion: "lively",
}
