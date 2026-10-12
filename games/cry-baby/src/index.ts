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
    background: "#f7f1e3",
    foreground: "#141414",
    accent: "#e0a82e",
    surface: "#fbf8f1",
    surfaceDark: "#e8e3d5",
  },
}
