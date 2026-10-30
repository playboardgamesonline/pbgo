import { LANGUAGES } from "@pbgo/studio-kit/constants"

// The row the seed reads of the Notion Games database, and what hangs off it. It is the seed's own: the hub reads the catalog from the
// platform's Sanity project (`@pbgo/catalog`), not from Notion.

export type Locale = (typeof LANGUAGES)[number]["id"]

/** A publisher (an "editor" in Notion) of a game: its name and, when the Editors database has one, its website. */
export type Publisher = { name: string; url: string | null }

/** The three pictures a game can have in its Notion row. */
export const ART_SLOTS = ["logo", "icon", "background"] as const
export type ArtSlot = (typeof ART_SLOTS)[number]

/**
 * What a game chose in a select or a status column of the Games Development database: the option's name and its place among the
 * options the column is configured with (the first one is 0), which is the order Notion itself sorts by. The name is only there to be
 * shown (`pnpm catalog:list`), the position is what orders the games.
 */
export type Rank = { position: number; name: string }

/**
 * Where a game stands in the Games Development database, the columns that order the coming-soon games. A field is null when
 * the game has no row there, its cell is empty, or the option is no longer one of the column's.
 */
export type DevelopmentRank = { priority: Rank | null; status: Rank | null; effort: Rank | null }

/**
 * A game of the Notion Games database: everything the seed copies of a game, for a live game as for one to come. Plain data
 * (strings, numbers, arrays). The pictures are only flagged: Notion's own links expire after about an hour, so a picture is fetched
 * fresh when it is downloaded (`notionPageId` finds its row).
 */
export type NotionGame = {
  slug: string
  name: string
  /** A description per language, only the languages the row fills. Pick one with `pickLocalized`. */
  descriptions: Partial<Record<Locale, string>>
  /** `max: null` is "N or more". */
  players: { min: number; max: number | null } | null
  /** Minutes. */
  duration: number | null
  /** The weight BoardGameGeek gives the game, from 1 (light) to 5 (heavy): what the hub's complexity filter reads. Null when its row has none. */
  complexity: number | null
  /** The id of the game on BoardGameGeek (the number in the address of its page). Null when its row has none. */
  bggId: number | null
  /** The day the game came out, `YYYY-MM-DD`: a year alone is its first of January. Null when its row has none. */
  releaseDate: string | null
  /** The minimum age in years. */
  age: number | null
  /** The categories of the game: the options its `Tags` cell holds, in the order of the row, each one once. What the hub's category filter offers. */
  categories: string[]
  /** The names of the people of the Creators database the row lists as its authors, in the order of the row. */
  authors: string[]
  /** The same for its illustrators. */
  illustrators: string[]
  publishers: Publisher[]
  /** Link to the rulebook per language, only the languages the row fills. */
  rules: Partial<Record<Locale, string>>
  art: Record<ArtSlot, boolean>
  /** How soon the game is to come: what orders the coming-soon games (`comparePlanned`). */
  development: DevelopmentRank
  /** A standalone expansion (it plays without its base game, so it is a game of the catalog): the slug of its base game, the row's `Parent item`. Null for any other game. */
  standaloneOf: string | null
  /**
   * The slugs of the games the row itself points to: its related games and its base game (a standalone expansion), in the order of
   * the row, never its own slug, and only games the reader kept (an expansion has no page). One side of the link: Notion keeps the
   * other side by hand, if at all, so `buildCatalog` makes it go both ways (`CatalogEntry.related`).
   */
  related: string[]
  /** ISO date of the row's last edit. */
  editedAt: string
  notionPageId: string
}
