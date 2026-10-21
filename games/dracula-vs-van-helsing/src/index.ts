import type { SettingsDefaults } from "@pbgo/core/lib/binding"

/** The game for @pbgo/core, shared by the server and the client: site constants. No engine (`GAME`) yet, so its home page says "coming soon". */
export * from "./lib/site"

/** Colors of the game until they are set in /gamemaster/<slug>. */
export const SETTINGS_DEFAULTS: SettingsDefaults = {
  theme: {
    background: "#150d14",
    foreground: "#f5f2ea",
    accent: "#ea5a2a",
    surface: "#1f151e",
    surfaceDark: "#0f090e",
  },
}
