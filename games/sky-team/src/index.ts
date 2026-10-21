import type { SettingsDefaults } from "@pbgo/core/lib/binding"

/** The game for @pbgo/core, shared by the server and the client: site constants. No engine (`GAME`) yet, so its home page says "coming soon". */
export * from "./lib/site"

/** Colors of the game until they are set in /gamemaster/<slug>. */
export const SETTINGS_DEFAULTS: SettingsDefaults = {
  theme: {
    background: "#16243f",
    foreground: "#f5f2ea",
    accent: "#f2b134",
    surface: "#213356",
    surfaceDark: "#0f192c",
  },
}
