import type { SettingsDefaults } from "@pbgo/core/lib/binding"

/**
 * The game for @pbgo/core, shared by the server and the client: the engine (`GAME`), the site constants, the skin, the look of the in-game UI and the sounds. The board is `Game` of `ui.tsx`, loaded on demand.
 */
export { GAME } from "@flip-7/engine"
export * from "./lib/site"
export { DEFAULT_SKIN } from "./lib/skin"
export { SOUNDS } from "./lib/sounds"
export { UI_THEME } from "./lib/ui-theme"

/** Colors of the game until they are set in /gamemaster/<slug>. The board, the buttons, the announcements and the game over all read them: nothing else in the game holds a colour. */
export const SETTINGS_DEFAULTS: SettingsDefaults = {
  theme: {
    background: "#021c22",
    foreground: "#f5f2ea",
    accent: "#f9dc4f",
    surface: "#094f5d",
    surfaceDark: "#043039",
  },
}
