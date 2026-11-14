import type { GameSkinDefaults } from "@pbgo/core/lib/skin"

/**
 * Default skin, replaced field by field by Sanity (`interface`): the player colours and the behaviour, never a text or an image. One colour for each of the 8 seats a table of Skyjo can have, light enough to be read on the dark felt, and none of them a
 * colour of the cards (green, yellow, red, blue) at full strength.
 */
export const DEFAULT_SKIN: GameSkinDefaults = {
  playerColors: ["#f08a7a", "#f0c36a", "#9fd98a", "#6fcfd0", "#86a8f2", "#b89cf0", "#eb8cc4", "#d6d6d6"],
}
