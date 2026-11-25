import type { SettingsDefaults } from "@pbgo/core/lib/binding"

/**
 * The game for @pbgo/core, shared by the server and the client: the engine (`GAME`), the site constants, the skin, the look of the in-game UI and the sounds. The board is `Game` of `ui.tsx`, loaded on demand.
 */
export { GAME } from "@skyjo/engine"
export * from "./lib/site"
export { DEFAULT_SKIN } from "./lib/skin"
export { SOUNDS } from "./lib/sounds"
export { UI_THEME } from "./lib/ui-theme"

/**
 * Colors of the game until they are set in /gamemaster/<slug>. The board, the buttons, the announcements and the game over all read them: nothing else in the game holds a colour. Skyjo's own: the table is a gradient, a dark green in the middle (`surface`) that
 * fades into a very dark teal toward the edges (`surfaceDark`), the ink a white with a hint of lilac like the lettering of the logo, and the accent the bright azure the booklet is printed on. The cards carry the full colours (see `lib/palette.ts`).
 */
export const SETTINGS_DEFAULTS: SettingsDefaults = {
  theme: {
    background: "#0b0720",
    foreground: "#f7f3ff",
    accent: "#4aa8f0",
    surface: "#204728",
    surfaceDark: "#002022",
  },
}
