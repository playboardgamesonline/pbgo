// The lists the Studio's forms and the seed share. No import from Sanity: the seed (run by Node) and its tests read this file too.

/**
 * What a game of the catalog is. A `game` stands on its own; a `reimplementation` is a game of its own that rebuilds or extends another
 * one (what Notion calls a standalone expansion, a new edition). What needs another game to be played is not a kind of game: it is an
 * `expansion`, a document type of its own.
 */
export const GAME_KINDS = [
  { title: "Game", value: "game" },
  { title: "Reimplementation", value: "reimplementation" },
] as const

export type GameKind = (typeof GAME_KINDS)[number]["value"]

// What a person did on a game: the credits of BoardGameGeek. The list is the studio kit's, which the hub words its credit lines from too.
export { CREATOR_ROLES, GALLERY_MAX, roleTitle } from "@pbgo/studio-kit/constants"
export type { CreatorRole } from "@pbgo/studio-kit/constants"

/**
 * The kinds of value a translated field holds: a core type of Sanity, or a custom one that `translations.ts` defines (a description is a
 * long text, a name in a language is a name that English leaves empty). The type of a field of a kind is `translatedType(kind)` of the
 * studio kit, and the type of one of its rows `translatedRowType(kind)`.
 */
export const TRANSLATED_KINDS = ["string", "url", "image", "description", "localizedName"] as const

export type TranslatedKind = (typeof TRANSLATED_KINDS)[number]

/**
 * The translated fields of each type of document and the kind of value of each (PLT-104): one array of rows `{ language, value }` instead
 * of one value. What the seed writes and what the migration converts, and `model.test.ts` keeps it the list of the Studio's own fields. The
 * English `name` stays a plain text, the reference of the slug, the order and the search; `names` holds the name in the other languages.
 * Everything else (the figures, the credits, the references, the `icon` and the `background`) is shared by the languages.
 */
export const TRANSLATED_FIELDS = {
  game: { names: "localizedName", tagline: "string", description: "description", rules: "url", logo: "image", cover: "image", boxFront: "image" },
  expansion: { names: "localizedName", description: "description", rules: "url", cover: "image", boxFront: "image" },
  category: { names: "localizedName" },
} as const satisfies Record<string, Record<string, TranslatedKind>>

export type TranslatedDocumentType = keyof typeof TRANSLATED_FIELDS

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
