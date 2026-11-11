import type { SettingsDefaults } from "@pbgo/core/lib/binding"

/**
 * The game for @pbgo/core, shared by the server and the client: the engine (`GAME`) and the site constants. With the engine the game is playable outside production, but it has no board yet (`ui.tsx`), so a table that starts has nothing to show:
 * in production the game stays "coming soon" until `live` is set in the registry.
 */
export { GAME } from "@flip-7/engine"
export * from "./lib/site"

/** Colors of the game until they are set in /gamemaster/<slug>. */
export const SETTINGS_DEFAULTS: SettingsDefaults = {
  theme: {
    background: "#1d1f5c",
    foreground: "#f5f2ea",
    accent: "#f9dc4f",
    surface: "#2a2c7c",
    surfaceDark: "#141640",
  },
}
