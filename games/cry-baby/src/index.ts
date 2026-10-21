import type { SettingsDefaults } from "@pbgo/core/lib/binding"

/** The game for @pbgo/core, shared by the server and the client: site constants. No engine (`GAME`) yet, so its home page says "coming soon". */
export * from "./lib/site"

/** Colors of the game until they are set in /gamemaster/<slug>. */
export const SETTINGS_DEFAULTS: SettingsDefaults = {
  theme: {
    background: "#f7f1e3",
    foreground: "#141414",
    accent: "#e0a82e",
    surface: "#fbf8f1",
    surfaceDark: "#e8e3d5",
  },
}
