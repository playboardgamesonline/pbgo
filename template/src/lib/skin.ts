import type { SettingsDefaults } from "@pbgo/core/lib/binding"
import type { ThemeColors } from "@pbgo/core/lib/settings"
import type { GameSkinDefaults } from "@pbgo/core/lib/skin"

/** Paper & ink: the table is warm black, the text paper, the accent vermilion (see `ui-theme.ts` for the in-game UI) */
const THEME: ThemeColors = { background: "#17140f", foreground: "#f3ead7", accent: "#e5543a", surface: "#231e17", surfaceDark: "#0f0d0a" }

/** Default settings (when the Sanity document "settings" is empty), replaced field by field by what is saved in the gamemaster (Visual). */
export const SETTINGS_DEFAULTS: SettingsDefaults = {
  theme: THEME,
}

/**
 * Default skin, replaced field by field by Sanity (`interface`): the player colours and the behaviour, never a text or an image. Seat colors in printing inks, one per seat of a 6-player
 * table, none of them the vermilion of the accent: mustard, jade, blue, plum, olive, rose. The initial on a seat badge picks its own ink.
 */
export const DEFAULT_SKIN: GameSkinDefaults = {
  playerColors: ["#e0a43a", "#3e9a86", "#4d7fc7", "#a85c9c", "#8c9a3e", "#d9798f"],
}
