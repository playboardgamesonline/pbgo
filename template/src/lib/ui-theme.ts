import type { UiTheme } from "@pbgo/core/lib/binding"

/**
 * Look of the shared in-game UI for the template: paper & ink. A printed card on a dark table: warm paper for the letters and the
 * end-of-game panel, ink for the lines and the text on paper, one vermilion for the accents. Square stamps for the seats, serif
 * type from the skin (`styles.css`), calm motion (fades and short slides, no confetti).
 *
 * It is the second universe next to Courtisans' banquet (`games/courtisans/src/lib/ui-theme.ts`): same components and logic, other
 * values. A new game copies this file and changes the values. The table itself (colors and fonts) is the skin, `skin.ts`.
 */
const PAPER = "#f3ead7"
const INK = "#17140f"
/** The accent on the dark table, and its deeper twin on paper (4.9:1 against ink, 5:1 against paper) */
const VERMILION = "#e5543a"
const VERMILION_ON_PAPER = "#b8321b"

export const UI_THEME: UiTheme = {
  motion: "calm",
  announcement: {
    font: "var(--font-title)",
    color: PAPER,
    outline: null,
    shadow: INK,
    veil: INK,
    rule: VERMILION,
    confetti: null,
  },
  seat: {
    shape: "square",
    ring: "rgb(243 234 215 / 0.6)",
    font: "var(--font-title)",
    name: "ink",
  },
  gameOver: {
    surface: `radial-gradient(120% 90% at 50% 0%, #f8f1e1 0%, ${PAPER} 55%, #eadfc4 100%)`,
    border: INK,
    radius: "0.25rem",
    ink: INK,
    accent: VERMILION_ON_PAPER,
    frame: "#fffdf6",
  },
}
