import type { SettingsDefaults } from "@pbgo/core/lib/binding"

/**
 * The game for @pbgo/core, shared by the server and the client: the engine (`GAME`), the site constants, the skin and the look of the in-game UI. The board is `Game` of `ui.tsx`, loaded on demand.
 */
export { GAME } from "@love-letter/engine"
export * from "./lib/site"
export { DEFAULT_SKIN } from "./lib/skin"
export { UI_THEME } from "./lib/ui-theme"

/**
 * Colors and fonts of the game until they are set in /gamemaster/<slug>. The board, the buttons, the announcements and the game over all read them: nothing else in the game holds a colour. A wine, the hue of the medallions and of the back of the cards: `surface`
 * is the middle of the table, lit, `surfaceDark` its edge and everything beyond, `background` the screen behind the HUD, and the gold `accent` is the gold of the faces. The faces' lettering and the table's read in Cinzel (the names, an old-style capital that
 * suits a court) and Alegreya (the text, an old-style serif), both in the platform's own list of fonts (`FONT_CHOICES`, Google Fonts under the SIL Open Font License).
 */
export const SETTINGS_DEFAULTS: SettingsDefaults = {
  theme: {
    background: "#1e050d",
    foreground: "#f5f2ea",
    accent: "#d9b377",
    surface: "#5f112d",
    surfaceDark: "#370918",
  },
  displayFont: "Cinzel",
  bodyFont: "Alegreya",
}
