// The lists the Studio's forms and the seed share. No import from Sanity: the seed (run by Node) and its tests read this file too.

/**
 * What a game of the catalog is. A `game` stands on its own; an `expansion` needs another game to be played; a `reimplementation` is a
 * game of its own that rebuilds or extends another one (what Notion calls a standalone expansion, a new edition).
 */
export const GAME_KINDS = [
  { title: "Game", value: "game" },
  { title: "Expansion", value: "expansion" },
  { title: "Reimplementation", value: "reimplementation" },
] as const

export type GameKind = (typeof GAME_KINDS)[number]["value"]

// What a person did on a game: the credits of BoardGameGeek. The list is the studio kit's, which the hub words its credit lines from too.
export { CREATOR_ROLES, roleTitle } from "@pbgo/studio-kit/constants"
export type { CreatorRole } from "@pbgo/studio-kit/constants"

export const CHANGELOG_KINDS = [
  { title: "New game", value: "newGame" },
  { title: "Feature", value: "feature" },
  { title: "Improvement", value: "improvement" },
  { title: "Fix", value: "fix" },
] as const

export const ANNOUNCEMENT_TONES = [
  { title: "Info", value: "info" },
  { title: "Success", value: "success" },
  { title: "Alert", value: "alert" },
] as const
