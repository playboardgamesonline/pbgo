import type { SettingsDefaults } from "@pbgo/core/lib/binding"
import type { ThemeColors } from "@pbgo/core/lib/settings"
import type { GameSkinDefaults } from "@pbgo/core/lib/skin"

/**
 * Default skin of Flip 7, replaced field by field by Sanity (`interface`): the player colours and the behaviour, never a text or an
 * image. Eight seats on a green felt, so no green among them, and each one tells itself from the others at the size of a seat disc.
 */
export const DEFAULT_SKIN: GameSkinDefaults = {
  playerColors: ["#ff6b5e", "#f6b73c", "#5bb8ff", "#b18cff", "#ff82b2", "#46d6d0", "#e9e2d0", "#ff9f4a"],
  desktopOnly: true,
}

/** A card table: dark felt, ivory cards and chips, one coral accent. */
const THEME: ThemeColors = { background: "#10301f", foreground: "#f7f1e1", accent: "#ff5a4d", surface: "#1a4d35", surfaceDark: "#0b2418" }

/** Default settings (when the Sanity document "settings" is empty). */
export const SETTINGS_DEFAULTS: SettingsDefaults = { theme: THEME }
