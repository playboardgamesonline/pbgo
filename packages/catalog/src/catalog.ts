// The hub catalog as a pure model: the games of the Notion Games database, each one joined with the flags the registry holds for it
// (is it playable here, may search engines in), into one list. No I/O and no framework in this file, so that Node
// (`pnpm catalog:list`), the tests and Next read it as it is. The Notion reader is `notion.ts`, the cached one for apps/web is
// `server.ts` (see docs/catalog.md).

import type { GameEntry } from "@pbgo/core/lib/binding"
import type { Locale } from "@pbgo/core/lib/i18n"
import { LANGUAGES } from "@pbgo/studio-kit/constants"

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
 * A game of the Notion Games database: everything the hub and its page show, for a live game as for one to come. Plain data
 * (strings, numbers, arrays), so it travels through the cache and into a client component as it is. The pictures are only flagged:
 * Notion's own links expire after about an hour, so a picture is fetched fresh when it is served (`notionPageId` finds its row,
 * `editedAt` changes the URL when the row changes).
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

/**
 * The `v` of a picture URL: it changes when the Notion row does (its last edit in minutes, in base 36; "0" without a date), so a
 * picture that is cached for a long time under its URL is fetched again after an edit, and the route can tell a stale URL.
 */
export function pictureVersion(editedAt: string): string {
  const time = Date.parse(editedAt)
  return Number.isFinite(time) ? Math.floor(time / 60_000).toString(36) : "0"
}

/** The URL of a game's picture (`/api/catalog/<slug>/<slot>`, see `route.ts`), or null when its row has none: a missing picture is a plain frame, nothing else. */
export function pictureUrl(game: Pick<NotionGame, "slug" | "art" | "editedAt">, slot: ArtSlot): string | null {
  return game.art[slot] ? `/api/catalog/${game.slug}/${slot}?v=${pictureVersion(game.editedAt)}` : null
}

/**
 * The URL of the icon of a game's n-th publisher (`/api/catalog/<slug>/publisher-<n>`, see `route.ts`), or null when that publisher has no website to take it from.
 * It carries the version of the game's row like a picture does, so an edit of the row sends the page to a new address. The address names a place in the row and never
 * a website: the server finds the website in the row itself.
 */
export function publisherIconUrl(game: Pick<NotionGame, "slug" | "publishers" | "editedAt">, index: number): string | null {
  return game.publishers[index]?.url ? `/api/catalog/${game.slug}/publisher-${index}?v=${pictureVersion(game.editedAt)}` : null
}

/** One line of the credits of a game's page: what the people are to it, and who they are. A publisher whose row has a website is a link to it, with its icon. */
export type CreditLine = { label: string; values: { text: string; href?: string; icon?: string }[] }

const plural = (count: number, one: string, many: string) => (count === 1 ? one : many)

/**
 * The credits a game's page shows, in this order and only the lines that have somebody: its designers, its artists and its publishers, the label in the singular for
 * one and in the plural for more. A publisher whose row has a website is a link to it (`href`) with its icon (`icon`, `publisherIconUrl`); one with none is a name.
 */
export function creditLines(game: Pick<NotionGame, "slug" | "authors" | "illustrators" | "publishers" | "editedAt">): CreditLine[] {
  const lines: CreditLine[] = [
    { label: plural(game.authors.length, "Designer", "Designers"), values: game.authors.map((text) => ({ text })) },
    { label: plural(game.illustrators.length, "Artist", "Artists"), values: game.illustrators.map((text) => ({ text })) },
    {
      label: plural(game.publishers.length, "Publisher", "Publishers"),
      values: game.publishers.map(({ name, url }, index) => {
        const icon = publisherIconUrl(game, index)
        return url ? { text: name, href: url, ...(icon ? { icon } : {}) } : { text: name }
      }),
    },
  ]
  return lines.filter((line) => line.values.length > 0)
}

/** The picture of a game's card on the hub: its logo, else its icon, else none (the card is then a plain frame, nothing else). The background is the game page's. */
export function cardPictureUrl(game: Pick<NotionGame, "slug" | "art" | "editedAt">): string | null {
  return pictureUrl(game, "logo") ?? pictureUrl(game, "icon")
}

/**
 * The picture a game's page shares (social cards, JSON-LD): its background, which is wide, else its logo or icon, which is
 * small and often transparent, else none. `wide` says which, since a social card only goes large with a wide picture.
 */
export function sharePicture(game: Pick<NotionGame, "slug" | "art" | "editedAt">): { url: string; wide: boolean } | null {
  const background = pictureUrl(game, "background")
  if (background) return { url: background, wide: true }
  const logo = cardPictureUrl(game)
  return logo ? { url: logo, wide: false } : null
}

/**
 * One line of the catalog: a game of the hub and the values its card and its page show (`game`, its Notion row, for a live game as
 * for one to come).
 * - `live` is the registry's flag and the only thing that makes the game playable from its page ("Create a game", else a greyed
 *   "Coming soon"). `indexable` is the registry's too, false for a game the registry does not know.
 * - `related` is the slugs of the games its page recommends (`rankRelated`), the most relevant first, never its own slug, only games that are
 *   listed (a page for each) and at most `RELATED_MAX`. First its family, the games it is linked to whichever side of the link Notion has
 *   (its related games, its base game, the games that name it as theirs), in catalog order; then the games that look like it, by their
 *   categories and by the players that play both.
 */
export type CatalogEntry = { slug: string; live: boolean; indexable: boolean; game: NotionGame; related: string[] }

/**
 * The catalog and where it came from. `notion`: "off" without a token, "ok" when Notion answered, "unavailable" when it did not
 * (the failure is logged). Without Notion the catalog is the live games of the registry, each one a `registryRow`.
 */
export type Catalog = { entries: CatalogEntry[]; notion: "off" | "ok" | "unavailable" }

/** What else `buildCatalog` can be asked for. */
export type CatalogOptions = {
  /**
   * List the games of the registry that are not live and that Notion has no row for too, each as its `registryRow` that says "Coming soon", after
   * the other games and in registry order. For development with no Notion token: the hub can then be seen with all its games, names and figures
   * but no picture. The catalog of a deployment never does, since a game that Notion does not announce is not announced.
   */
  registryGames?: boolean
  /**
   * For each game, how many of its players also played each other game (`AlsoPlayed`): the signal "players of this game also play" that ranks the games a page recommends after its family. Nothing feeds it yet, since
   * no account has a history to count: without it the games that look like a game are ranked by their categories alone.
   */
  alsoPlayed?: AlsoPlayed
}

/** Games of the registry that are not in the catalog: the template is the demo of the shared base, not a game. */
export const UNLISTED_SLUGS: ReadonlySet<string> = new Set(["template"])

/**
 * The row of a live game that Notion has none for, or that Notion cannot be read for: what the registry knows (its name, its players
 * and its duration when that is one figure) and nothing else. The card is then a plain frame and the page has no description, but the
 * game stays listed and can be entered. `art` is all false, so no picture is asked for; `editedAt` and `notionPageId` are empty, there
 * is no row.
 */
export function registryRow(game: GameEntry): NotionGame {
  const { players, duration } = game
  return {
    slug: game.slug,
    name: game.name,
    descriptions: {},
    players: players ? { min: players.min, max: players.max } : null,
    duration: duration && duration.min === duration.max ? duration.min : null,
    complexity: null,
    bggId: null,
    releaseDate: null,
    age: null,
    categories: [],
    authors: [],
    illustrators: [],
    publishers: [],
    rules: {},
    art: { logo: false, icon: false, background: false },
    development: { priority: null, status: null, effort: null },
    standaloneOf: null,
    related: [],
    editedAt: "",
    notionPageId: "",
  }
}

// "6 nimmt!" before "7 Wonders", "Skyjo" and "Skull King" in the order a reader expects
const NAMES = new Intl.Collator("en", { sensitivity: "base", numeric: true })

/** Two ranks in one direction (1: the first option first, -1: the last one first). A game with no value goes after every game that has one, whichever the direction. */
function compareRanks(a: Rank | null, b: Rank | null, direction: 1 | -1): number {
  if (a === null || b === null) return Number(a === null) - Number(b === null)
  return direction * (a.position - b.position)
}

/**
 * The order of the coming-soon games: the one of the "Table" view of the Games Development database in Notion, copied here (the
 * reader does not read the sort of a view). Priority first (P1 before P2), then Status (the last option first, so the game that is
 * furthest along comes first), then Effort (the lowest first), then the name, case and accents aside, numbers in their order.
 * A game with no value for a column comes after the games that have one.
 */
export function comparePlanned(a: NotionGame, b: NotionGame): number {
  return (
    compareRanks(a.development.priority, b.development.priority, 1) ||
    compareRanks(a.development.status, b.development.status, -1) ||
    compareRanks(a.development.effort, b.development.effort, 1) ||
    NAMES.compare(a.name, b.name)
  )
}

// The games a game's page recommends: its family first, then the games that look like it. They are in this file and not in a file of their own because `pnpm catalog:list` runs this one under plain Node, which strips the types
// and resolves no other file of the package.

/** The most games a page recommends: the grid is 2, 3, 4 or 5 cards wide, and twelve fill whole rows of the first three. */
export const RELATED_MAX = 12

/**
 * For each game, how many of its players also played each other game: the signal "players of this game also play". Counts of distinct players, never who they are. The catalog does not have it yet
 * (no account has a history to count), so `buildCatalog` takes it as an option and ranks by categories alone while it is not given.
 */
export type AlsoPlayed = ReadonlyMap<string, ReadonlyMap<string, number>>

/** How alike two games are by their categories, from 0 (nothing in common, or one has none) to 1 (the same ones): the share of the categories of the two that both have (Jaccard). */
export function categorySimilarity(a: readonly string[], b: readonly string[]): number {
  const left = new Set(a)
  const right = new Set(b)
  if (left.size === 0 || right.size === 0) return 0
  let shared = 0
  for (const category of left) if (right.has(category)) shared++
  return shared / (left.size + right.size - shared)
}

type Listed = { slug: string; game: Pick<NotionGame, "categories"> }

/**
 * The slugs of the games to recommend with `entry`, the most relevant first, at most `max`:
 * 1. its family, the games its row or theirs links it to (`family`), in the catalog's order and whatever they look like;
 * 2. then the games that look like it: how alike their categories are (`categorySimilarity`) plus, when it is known, how many of its players also play them (`alsoPlayed`, as a share of the game most played with it).
 * Both signals count, so a game that has both comes before one that has only one, and a game that has neither is not recommended. A tie keeps the catalog's order, which puts the live games first.
 */
export function rankRelated(entry: Listed, listed: readonly Listed[], family: ReadonlySet<string> | undefined, alsoPlayed?: ReadonlyMap<string, number>, max = RELATED_MAX): string[] {
  const others = listed.filter((other) => other.slug !== entry.slug)
  const kin = others.filter((other) => family?.has(other.slug)).map((other) => other.slug)
  const most = Math.max(0, ...(alsoPlayed?.values() ?? []))
  const similar = others
    .filter((other) => !family?.has(other.slug))
    .map((other, order) => ({
      slug: other.slug,
      order,
      score: categorySimilarity(entry.game.categories, other.game.categories) + (most > 0 ? (alsoPlayed?.get(other.slug) ?? 0) / most : 0),
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .map(({ slug }) => slug)
  return [...kin, ...similar].slice(0, max)
}

/** Every link between two games, both ways, from the one side each `NotionGame.related` holds: the slug of a game → the slugs it is linked to. */
function relatedLinks(rows: readonly NotionGame[]): Map<string, Set<string>> {
  const links = new Map<string, Set<string>>()
  const link = (from: string, to: string) => {
    if (from === to) return
    links.set(from, (links.get(from) ?? new Set<string>()).add(to))
  }
  for (const game of rows) {
    for (const other of game.related) {
      link(game.slug, other)
      link(other, game.slug)
    }
  }
  return links
}

/**
 * The catalog: the live games of the registry (in registry order), then the other games of the Notion Games database (sorted by
 * `comparePlanned`). Every game shows the values of its Notion row.
 * - A live game takes its Notion row, and Notion's name with it. With no row (Notion is off, down, or has none for it) it takes
 *   `registryRow`, so a game the site can play is always listed. Its Development rank does not move it: the registry's order holds.
 * - The other rows are the registry's games that are not live and the games the registry does not know. A game of the registry that
 *   is not live and has no row is not listed.
 * - `live` and `indexable` are the registry's, whatever a row says. They are the only things the registry still decides.
 * - `UNLISTED_SLUGS` are never listed.
 * - With `options.registryGames` the registry's games that are not live and have no row are listed too (development with no token).
 * - Two games are family when either row says so, and `related` only names games that are listed; after the family come the games that look like the game (`rankRelated`, with `options.alsoPlayed` when it is known).
 */
export function buildCatalog(games: readonly GameEntry[], rows: readonly NotionGame[], options: CatalogOptions = {}): CatalogEntry[] {
  const known = new Map(games.map((game) => [game.slug, game]))
  const live: CatalogEntry[] = games
    .filter((game) => game.live && !UNLISTED_SLUGS.has(game.slug))
    .map((game) => ({ slug: game.slug, live: true, indexable: game.indexable, game: rows.find((row) => row.slug === game.slug) ?? registryRow(game), related: [] }))
  const taken = new Set(live.map((entry) => entry.slug))
  const comingSoon: CatalogEntry[] = rows
    .filter((row) => !UNLISTED_SLUGS.has(row.slug) && !taken.has(row.slug))
    .sort(comparePlanned)
    .map((row) => ({ slug: row.slug, live: false, indexable: known.get(row.slug)?.indexable ?? false, game: row, related: [] }))
  const fromRegistry: CatalogEntry[] = options.registryGames
    ? games
        .filter((game) => !game.live && !UNLISTED_SLUGS.has(game.slug) && !live.some((entry) => entry.slug === game.slug) && !rows.some((row) => row.slug === game.slug))
        .map((game) => ({ slug: game.slug, live: false, indexable: game.indexable, game: registryRow(game), related: [] }))
    : []
  const listed = [...live, ...comingSoon, ...fromRegistry]
  const links = relatedLinks(rows)
  return listed.map((entry) => ({ ...entry, related: rankRelated(entry, listed, links.get(entry.slug), options.alsoPlayed?.get(entry.slug)) }))
}

// The language to fall back on when the visitor's has no text: English, then French (the language of the games), then the others
const FALLBACK_ORDER: readonly Locale[] = ["en", "fr"]

/**
 * The text of a set of translations for a visitor: their language, else English, else French, else any other. `language` says
 * which one was taken (a page marks the text when it is not the visitor's). Null when no language has a text.
 */
export function pickLocalized(values: Partial<Record<Locale, string>>, locale: Locale): { language: Locale; text: string } | null {
  for (const language of new Set([locale, ...FALLBACK_ORDER, ...LANGUAGES.map((entry) => entry.id)])) {
    const text = values[language]
    if (text) return { language, text }
  }
  return null
}
