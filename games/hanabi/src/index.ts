import type { SettingsDefaults } from "@pbgo/core/lib/binding"

/** The game for @pbgo/core, shared by the server and the client: site constants. No engine (`GAME`) yet, so its home page says "coming soon". */
export * from "./lib/site"

/** Colors of the game until they are set in /gamemaster/<slug>. */
export const SETTINGS_DEFAULTS: SettingsDefaults = {
  theme: {
    background: "#101b3e",
    foreground: "#f0f1f4",
    accent: "#f2d04b",
    surface: "#252846",
    surfaceDark: "#0b132b",
  },
}
