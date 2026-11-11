import type { GameSkinDefaults } from "@pbgo/core/lib/skin"

/**
 * Default skin, replaced field by field by Sanity (`interface`): the player colours and the behaviour, never a text or an image. One colour for each of the 8 seats a table of Flip 7 can have, light enough to be read on the dark mat
 * and none of them the yellow of the accent, which the buttons and the glows wear.
 */
export const DEFAULT_SKIN: GameSkinDefaults = {
  playerColors: ["#e8795a", "#9d8cf2", "#e56fa4", "#6fb4e5", "#6fd3a8", "#f0a77c", "#b7d65a", "#d9b8f2"],
}
