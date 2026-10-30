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

/**
 * What a person did on a game: the credits of BoardGameGeek, in its words (an "editor" there edits the text, the rules or the cards;
 * the publisher of a game is a `publisher`). A person can have several on one game, and the same person is a designer of one game
 * and an artist of another: the roles belong to the line of the game, not to the person.
 */
export const CREATOR_ROLES = [
  { title: "Designer", value: "designer" },
  { title: "Solo designer", value: "soloDesigner" },
  { title: "Developer", value: "developer" },
  { title: "Artist", value: "artist" },
  { title: "Graphic designer", value: "graphicDesigner" },
  { title: "Editor", value: "editor" },
  { title: "Sculptor", value: "sculptor" },
  { title: "Writer", value: "writer" },
  { title: "Insert designer", value: "insertDesigner" },
] as const

export type CreatorRole = (typeof CREATOR_ROLES)[number]["value"]

/** The title of a role as the Studio shows it; a value the list does not have (a role removed since) is shown as it is. */
export const roleTitle = (role: string): string => CREATOR_ROLES.find((entry) => entry.value === role)?.title ?? role

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
