import type { SettingsDefaults } from "@pbgo/core/lib/binding"

/** The game for @pbgo/core, shared by the server and the client: site constants. No engine (`GAME`) yet, so its home page says "coming soon". */
export * from "./lib/site"

/** Colors of the game until they are set in /gamemaster/<slug>. */
export const SETTINGS_DEFAULTS: SettingsDefaults = {
  theme: {
    background: "#123a52",
    foreground: "#f5f2ea",
    accent: "#7fd3f0",
    surface: "#1b4f6f",
    surfaceDark: "#0d2939",
  },
}
