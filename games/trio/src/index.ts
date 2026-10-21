import type { SettingsDefaults } from "@pbgo/core/lib/binding"

/** The game for @pbgo/core, shared by the server and the client: site constants. No engine (`GAME`) yet, so its home page says "coming soon". */
export * from "./lib/site"

/** Colors of the game until they are set in /gamemaster/<slug>. */
export const SETTINGS_DEFAULTS: SettingsDefaults = {
  theme: {
    background: "#1d2a4d",
    foreground: "#f5f2ea",
    accent: "#e82d8f",
    surface: "#2a3b68",
    surfaceDark: "#141d36",
  },
}
