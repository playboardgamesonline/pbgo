import type { SettingsDefaults } from "@pbgo/core/lib/binding"
import type { ThemeColors } from "@pbgo/core/lib/settings"
import type { GameSkinDefaults } from "@pbgo/core/lib/skin"

/** Default skin of Courtisans, replaced field by field by Sanity (`interface`): the player colours and the behaviour, never a text or an image. The texts (`texts`) and the art (decor, character, host icon) come from Sanity. */
export const DEFAULT_SKIN: GameSkinDefaults = {
  playerColors: ["#a8603a", "#6f5b99", "#9c4c72", "#4f6478", "#7a5a3a"],
  desktopOnly: true,
}

const THEME: ThemeColors = { background: "#0e3940", foreground: "#f0e9ce", accent: "#e2b54a", surface: "#185058", surfaceDark: "#031622" }

/** Default settings (when the Sanity document "settings" is empty). */
export const SETTINGS_DEFAULTS: SettingsDefaults = {
  theme: THEME,
  credits: {
    publisher: "Catch Up Games",
    publisherUrl: "https://catchupgames.com/nos-jeux/courtisans/",
  },
}
