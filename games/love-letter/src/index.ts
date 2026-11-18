import type { SettingsDefaults } from "@pbgo/core/lib/binding"

/**
 * The game for @pbgo/core, shared by the server and the client: the engine (`GAME`) and the site constants. The board is `Game` of `ui.tsx`, which does not exist yet: outside production a table can be opened and started, and the page of a
 * started table stays on "Loading the table". In production the game is not live, so its page says "coming soon".
 */
export { GAME } from "@love-letter/engine"
export * from "./lib/site"

/** Colors of the game until they are set in /gamemaster/<slug>. */
export const SETTINGS_DEFAULTS: SettingsDefaults = {
  theme: {
    background: "#3a1320",
    foreground: "#f5f2ea",
    accent: "#d9b377",
    surface: "#4f1d2e",
    surfaceDark: "#290d16",
  },
}
