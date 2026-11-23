import type { SettingsDefaults } from "@pbgo/core/lib/binding"

/**
 * The game for @pbgo/core, shared by the server and the client: the engine (`GAME`), the site constants, the skin, the look of the in-game UI and the sounds. The board is `Game` of `ui.tsx`, loaded on demand.
 */
export { GAME } from "@love-letter/engine"
export * from "./lib/site"
export { DEFAULT_SKIN } from "./lib/skin"
export { SOUNDS } from "./lib/sounds"
export { UI_THEME } from "./lib/ui-theme"

/**
 * Colors of the game until they are set in /gamemaster/<slug>. The board, the buttons, the announcements and the game over all read them: nothing else in the game holds a colour. A wine, the hue of the medallions and of the back of the cards: `surface` is the middle
 * of the table, lit, `surfaceDark` its edge and everything beyond, `background` the screen behind the HUD, and the gold `accent` is the gold of the faces. No font is named here: the lettering is Cabazon Regular (the names on the faces and the plates, the pads, the counts)
 * and Minion Pro Regular (the card texts and the sentences), the files uploaded to the game's settings, so the page asks no font service for anything.
 */
export const SETTINGS_DEFAULTS: SettingsDefaults = {
  theme: {
    background: "#1e050d",
    foreground: "#f5f2ea",
    accent: "#d9b377",
    surface: "#5f112d",
    surfaceDark: "#370918",
  },
}
