// The hub catalog as a pure model: the games of the platform's Sanity project (`sanity.ts` reads them), each one joined with the flags the
// registry holds for it (is it playable here, may search engines in), into one list. No I/O and no framework in this file, so that Node
// (`pnpm catalog:list`), the tests and Next read it as it is. The reader is `sanity.ts`, the cached one for apps/web is `server.ts` (see
// docs/catalog.md).

import type { GameEntry } from "@pbgo/core/lib/binding"
import type { Locale } from "@pbgo/core/lib/i18n"
import { CREATOR_ROLES, LANGUAGES, type CreatorRole } from "@pbgo/studio-kit/constants"

/** A publisher of a game: its name and, when it has one, its website. */
export type Publisher = { name: string; url: string | null }

/** A person credited on a game, and what they did on it (a person is on one line of a game, with all their roles). */
export type Creator = { name: string; roles: CreatorRole[] }

/** The three pictures a game can have. */
export const ART_SLOTS = ["logo", "icon", "background"] as const
export type ArtSlot = (typeof ART_SLOTS)[number]

/**
 * A game of the catalog: everything the hub and its page show, for a live game as for one to come. It is a published `game` of the
 * platform's Sanity project (`sanity.ts` reads it, `docs/platform-sanity.md` is its model) or, for a live game that has none, what the
 * registry knows (`registryRow`). Plain data (strings, numbers, arrays), so it travels through the cache and into a client component as
 * it is.
 */
export type CatalogGame = {
  slug: string
  name: string
  /** A description per language, only the languages the game has one in: English for now. Pick one with `pickLocalized`. */
  descriptions: Partial<Record<Locale, string>>
  /** `max: null` is "N or more". */
  players: { min: number; max: number | null } | null
  /** Minutes. */
  duration: number | null
  /** The weight BoardGameGeek gives the game, from 1 (light) to 5 (heavy): what the hub's complexity filter reads. Null when it has none. */
  complexity: number | null
  /** The id of the game on BoardGameGeek (the number in the address of its page). Null when it has none. */
  bggId: number | null
  /** The day the game came out, `YYYY-MM-DD`: a year alone is its first of January. Null when it has none. */
  releaseDate: string | null
  /** The minimum age in years. */
  age: number | null
  /** The names of the categories of the game, in the order the Studio lists them: what the hub's category filter offers. */
  categories: string[]
  /** The people credited on the game, in the order the Studio lists them, each with what they did on it. */
  creators: Creator[]
  publishers: Publisher[]
  /** Link to the rulebook per language, only the languages the game has one in. */
  rules: Partial<Record<Locale, string>>
  /** The address of each picture in the image CDN of the platform's Sanity project, the file itself and whole (`pictureUrl` sizes it); null for a picture the game does not have. */
  pictures: Record<ArtSlot, string | null>
  /**
   * The slugs of the games it is related to, in the order the Studio lists them, never its own slug, and only games the reader kept:
   * its related games, then its base game. One side of the link as far as the Studio goes: `buildCatalog` makes it go both ways
   * (`CatalogEntry.related`).
   */
  related: string[]
  /** What orders the games to come, lowest first (`compareGames`); null for a game with none. */
  order: number | null
  /** ISO date of the last edit of the game in the Studio. */
  updatedAt: string
}

/**
 * How wide the image CDN is asked for a picture, in pixels: a card shows a game's logo and icon small and its background across the
 * frame, and the page draws the same ones larger. Never more than the file holds.
 */
const PICTURE_WIDTH: Record<ArtSlot, number> = { logo: 800, icon: 512, background: 1200 }

/**
 * The URL of a game's picture, sized for the page: the address of the file in the image CDN, with a width and `auto=format`, so that a
 * browser that takes WebP or AVIF gets that. A vector picture (SVG) is served as it is. Null when the game has none: a picture it does
 * not have is a plain frame, nothing else.
 */
export function pictureUrl(game: Pick<CatalogGame, "pictures">, slot: ArtSlot): string | null {
  const url = game.pictures[slot]
  if (!url) return null
  return url.endsWith(".svg") ? url : `${url}?w=${PICTURE_WIDTH[slot]}&fit=max&auto=format`
}

/**
 * A short, stable stand-in for a website's address (FNV-1a, in base 36), the `v` of an icon's URL: a publisher whose website changes gets
 * another URL for its icon, and the CDN keeps each one for as long as it likes.
 */
export function iconVersion(website: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < website.length; i++) hash = Math.imul(hash ^ website.charCodeAt(i), 0x01000193)
  return (hash >>> 0).toString(36)
}

/**
 * The URL of the icon of a game's n-th publisher (`/api/catalog/<slug>/publisher-<n>`, see `route.ts`), or null when that publisher has no website to take it from.
 * It carries the version of the website, so that a new website sends the page to a new address. The address names a place in the game and never a website: the server
 * finds the website in the catalog itself.
 */
export function publisherIconUrl(game: Pick<CatalogGame, "slug" | "publishers">, index: number): string | null {
  const website = game.publishers[index]?.url
  return website ? `/api/catalog/${game.slug}/publisher-${index}?v=${iconVersion(website)}` : null
}

/** One line of the credits of a game's page: what the people are to it, and who they are. A publisher whose row has a website is a link to it, with its icon. */
export type CreditLine = { label: string; values: { text: string; href?: string; icon?: string }[] }

const plural = (count: number, one: string, many: string) => (count === 1 ? one : many)

/**
 * The credits a game's page shows, in this order and only the lines that have somebody: a line for each role of `CREATOR_ROLES` (designers,
 * solo designers, developers, artists, graphic designers…, the label in the singular for one person and in the plural for more), then
 * the publishers. A publisher whose game has its website is a link to it (`href`) with its icon (`icon`, `publisherIconUrl`); one with none is a name.
 */
export function creditLines(game: Pick<CatalogGame, "slug" | "creators" | "publishers">): CreditLine[] {
  const lines: CreditLine[] = CREATOR_ROLES.map(({ value, title }) => {
    const people = game.creators.filter((creator) => creator.roles.includes(value))
    return { label: plural(people.length, title, `${title}s`), values: people.map(({ name }) => ({ text: name })) }
  })
  lines.push({
    label: plural(game.publishers.length, "Publisher", "Publishers"),
    values: game.publishers.map(({ name, url }, index) => {
      const icon = publisherIconUrl(game, index)
      return url ? { text: name, href: url, ...(icon ? { icon } : {}) } : { text: name }
    }),
  })
  return lines.filter((line) => line.values.length > 0)
}

/** The picture of a game's card on the hub: its logo, else its icon, else none (the card is then a plain frame, nothing else). The background is the game page's. */
export function cardPictureUrl(game: Pick<CatalogGame, "pictures">): string | null {
  return pictureUrl(game, "logo") ?? pictureUrl(game, "icon")
}

/**
 * The picture a game's page shares (social cards, JSON-LD): its background, which is wide, else its logo or icon, which is
 * small and often transparent, else none. `wide` says which, since a social card only goes large with a wide picture.
 */
export function sharePicture(game: Pick<CatalogGame, "pictures">): { url: string; wide: boolean } | null {
  const background = pictureUrl(game, "background")
  if (background) return { url: background, wide: true }
  const logo = cardPictureUrl(game)
  return logo ? { url: logo, wide: false } : null
}

/**
 * One line of the catalog: a game of the hub and the values its card and its page show (`game`, a game of the platform's Sanity project,
 * for a live game as for one to come).
 * - `live` is the registry's flag and the only thing that makes the game playable from its page ("Create a game", else a greyed
 *   "Coming soon"). `indexable` is the registry's too, false for a game the registry does not know.
 * - `related` is the slugs of the games its page recommends (`rankRelated`), the most relevant first, never its own slug, only games that are
 *   listed (a page for each) and at most `RELATED_MAX`. First its family, the games it is linked to whichever side of the link the Studio has
 *   (its related games, its base game, the games that name it as theirs), in catalog order; then the games that look like it, by their
 *   categories and by the players that play both.
 */
export type CatalogEntry = { slug: string; live: boolean; indexable: boolean; game: CatalogGame; related: string[] }

/**
 * The catalog and where it came from. `source`: "ok" when the platform's Sanity project answered, "unavailable" when it did not (the
 * failure is logged). Without it the catalog is the live games of the registry, each one a `registryRow`.
 */
export type Catalog = { entries: CatalogEntry[]; source: "ok" | "unavailable" }

/** What else `buildCatalog` can be asked for. */
export type CatalogOptions = {
  /**
   * List the games of the registry that are not live and that the Studio has no game for too, each as its `registryRow` that says "Coming soon", after
   * the other games and in registry order. For development when the platform's Sanity project cannot be read: the hub can then be seen with all its games, names and
   * figures but no picture. The catalog of a deployment never does, since a game that the Studio does not announce is not announced.
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
 * The row of a live game that the Studio has no game for, or that the Studio cannot be read for: what the registry knows (its name, its
 * players and its duration when that is one figure) and nothing else. The card is then a plain frame and the page has no description,
 * but the game stays listed and can be entered. It has no picture and no date: there is no document.
 */
export function registryRow(game: GameEntry): CatalogGame {
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
    creators: [],
    publishers: [],
    rules: {},
    pictures: { logo: null, icon: null, background: null },
    related: [],
    order: null,
    updatedAt: "",
  }
}

// "6 nimmt!" before "7 Wonders", "Skyjo" and "Skull King" in the order a reader expects
const NAMES = new Intl.Collator("en", { sensitivity: "base", numeric: true })

/**
 * The order of the games to come: the `order` of the Studio, lowest first, a game with none after the games that have one, then the name,
 * case and accents aside, numbers in their order.
 */
export function compareGames(a: Pick<CatalogGame, "order" | "name">, b: Pick<CatalogGame, "order" | "name">): number {
  if (a.order !== b.order) {
    if (a.order === null) return 1
    if (b.order === null) return -1
    return a.order - b.order
  }
  return NAMES.compare(a.name, b.name)
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

type Listed = { slug: string; game: Pick<CatalogGame, "categories"> }

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

/** Every link between two games, both ways, from the one side each `CatalogGame.related` holds: the slug of a game → the slugs it is linked to. */
function relatedLinks(rows: readonly CatalogGame[]): Map<string, Set<string>> {
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
 * The catalog: the live games of the registry (in registry order), then the other games of the platform's Sanity project (sorted by
 * `compareGames`). Every game shows the values of its game in the Studio.
 * - A live game takes its game of the Studio, and its name with it. With none (the project cannot be read, or has none for it) it takes
 *   `registryRow`, so a game the site can play is always listed. Its `order` does not move it: the registry's order holds.
 * - The other rows are the registry's games that are not live and the games the registry does not know. A game of the registry that
 *   is not live and has no row is not listed.
 * - `live` and `indexable` are the registry's, whatever a row says. They are the only things the registry still decides.
 * - `UNLISTED_SLUGS` are never listed.
 * - With `options.registryGames` the registry's games that are not live and have no row are listed too (development with no project to read).
 * - Two games are family when either row says so, and `related` only names games that are listed; after the family come the games that look like the game (`rankRelated`, with `options.alsoPlayed` when it is known).
 */
export function buildCatalog(games: readonly GameEntry[], rows: readonly CatalogGame[], options: CatalogOptions = {}): CatalogEntry[] {
  const known = new Map(games.map((game) => [game.slug, game]))
  const live: CatalogEntry[] = games
    .filter((game) => game.live && !UNLISTED_SLUGS.has(game.slug))
    .map((game) => ({ slug: game.slug, live: true, indexable: game.indexable, game: rows.find((row) => row.slug === game.slug) ?? registryRow(game), related: [] }))
  const taken = new Set(live.map((entry) => entry.slug))
  const comingSoon: CatalogEntry[] = rows
    .filter((row) => !UNLISTED_SLUGS.has(row.slug) && !taken.has(row.slug))
    .sort(compareGames)
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
