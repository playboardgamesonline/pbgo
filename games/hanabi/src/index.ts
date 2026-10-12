import type { SettingsDefaults } from "@pbgo/core/lib/binding"
import { asset } from "./lib/site"

/** The game for @pbgo/core, shared by the server and the client: site constants. No engine (`GAME`) yet, so its home page says "coming soon". */
export * from "./lib/site"

/** Look of the game until it is set in /gamemaster/<slug>: logo, icons and colors of its former site. */
export const SETTINGS_DEFAULTS: SettingsDefaults = {
  logo: asset("/LOGO.png"),
  favicon: asset("/ICON.png"),
  shareImage: asset("/SHARE_IMAGE.png"),
  theme: {
    background: "#101b3e",
    foreground: "#f0f1f4",
    accent: "#f2d04b",
    surface: "#252846",
    surfaceDark: "#0b132b",
  },
}
