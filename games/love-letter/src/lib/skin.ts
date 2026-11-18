import type { GameSkinDefaults } from "@pbgo/core/lib/skin"

/**
 * Default skin, replaced field by field by Sanity (`interface`): the player colours and the behaviour, never a text or an image. One colour for each of the 6 seats a table of Love Letter can have, light enough to be read on the dark wine table, at least 40 degrees
 * of hue apart so that two players are told apart at a glance, and none of them the gold of the accent (which the buttons, the selection and the glows wear) or the wine of the table.
 */
export const DEFAULT_SKIN: GameSkinDefaults = {
  playerColors: ["#6fd3a8", "#c28cf2", "#b7d65a", "#8c9cf5", "#f08ab8", "#62cfe6"],
}
