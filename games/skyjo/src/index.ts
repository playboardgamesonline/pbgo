import type { SettingsDefaults } from "@pbgo/core/lib/binding"

/**
 * The game for @pbgo/core, shared by the server and the client: the engine (`GAME`), the site constants, the skin and the look of the in-game UI. The board is `Game` of `ui.tsx`, loaded on demand.
 */
export { GAME } from "@skyjo/engine"
export * from "./lib/site"
export { DEFAULT_SKIN } from "./lib/skin"
export { UI_THEME } from "./lib/ui-theme"

/** Colors of the game until they are set in /gamemaster/<slug>. The board, the buttons, the announcements and the game over all read them: nothing else in the game holds a colour. A calm, warm graphite felt: the cards bring the colour. */
export const SETTINGS_DEFAULTS: SettingsDefaults = {
  theme: {
    background: "#161513",
    foreground: "#f4f1ea",
    accent: "#8fd0ee",
    surface: "#2a2824",
    surfaceDark: "#191816",
  },
}
