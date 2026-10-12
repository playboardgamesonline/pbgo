import type { SettingsDefaults } from "@pbgo/core/lib/binding"
import { asset } from "./lib/site"

/** The game for @pbgo/core, shared by the server and the client: site constants. No engine (`GAME`) yet, so its home page says "coming soon". */
export * from "./lib/site"

/** Look of the game until it is set in /<slug>/admin: logo, icons and colors of its former site. */
export const SETTINGS_DEFAULTS: SettingsDefaults = {
  logo: asset("/LOGO.webp"),
  favicon: asset("/ICON.png"),
  shareImage: asset("/SHARE_IMAGE.png"),
  theme: {
    background: "#3a1320",
    foreground: "#f5f2ea",
    accent: "#d9b377",
    surface: "#4f1d2e",
    surfaceDark: "#290d16",
  },
}
