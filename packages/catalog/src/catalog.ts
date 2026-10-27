// The hub catalog as a pure model: the live games of the registry and the planned games of the Notion Games database, joined
// into one list. No I/O and no framework in this file, so that Node (`pnpm catalog:list`), the tests and Next read it as it is.
// The Notion reader is `notion.ts`, the cached one for apps/web is `server.ts` (see docs/catalog.md).

import type { GameEntry } from "@pbgo/core/lib/binding"
import type { Locale } from "@pbgo/core/lib/i18n"
import { LANGUAGES } from "@pbgo/studio-kit/constants"

/** A publisher (an "editor" in Notion) of a planned game: its name and, when the Editors database has one, its website. */
export type Publisher = { name: string; url: string | null }

/** The three pictures a planned game can have in its Notion row. */
export const ART_SLOTS = ["logo", "icon", "background"] as const
export type ArtSlot = (typeof ART_SLOTS)[number]

/**
 * What a game chose in a select or a status column of the Games Development database: the option's name and its place among the
 * options the column is configured with (the first one is 0), which is the order Notion itself sorts by. The name is only there to be
 * shown (`pnpm catalog:list`), the position is what orders the games.
 */
export type Rank = { position: number; name: string }

/**
 * Where a planned game stands in the Games Development database, the columns that order the coming-soon games. A field is null when
 * the game has no row there, its cell is empty, or the option is no longer one of the column's.
 */
export type DevelopmentRank = { priority: Rank | null; status: Rank | null; effort: Rank | null }

/**
 * A game of the Notion Games database that is not live: everything the hub and its page can show. Plain data (strings, numbers,
 * arrays), so it travels through the cache and into a client component as it is. The pictures are only flagged: Notion's own links
 * expire after about an hour, so a picture is fetched fresh when it is served (`notionPageId` finds its row, `editedAt` changes
 * the URL when the row changes).
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
  /** The minimum age in years. */
  age: number | null
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

/** The URL of a planned game's picture (`/api/catalog/<slug>/<slot>`, see `route.ts`), or null when its row has none: a missing picture is a plain frame, nothing else. */
export function pictureUrl(game: Pick<NotionGame, "slug" | "art" | "editedAt">, slot: ArtSlot): string | null {
  return game.art[slot] ? `/api/catalog/${game.slug}/${slot}?v=${pictureVersion(game.editedAt)}` : null
}

/** The picture of a planned game's card on the hub: its logo, else its icon, else none (the card is then a plain frame, nothing else). The background is the game page's. */
export function cardPictureUrl(game: Pick<NotionGame, "slug" | "art" | "editedAt">): string | null {
  return pictureUrl(game, "logo") ?? pictureUrl(game, "icon")
}

/**
 * The picture a planned game's page shares (social cards, JSON-LD): its background, which is wide, else its logo or icon, which is
 * small and often transparent, else none. `wide` says which, since a social card only goes large with a wide picture.
 */
export function sharePicture(game: Pick<NotionGame, "slug" | "art" | "editedAt">): { url: string; wide: boolean } | null {
  const background = pictureUrl(game, "background")
  if (background) return { url: background, wide: true }
  const logo = cardPictureUrl(game)
  return logo ? { url: logo, wide: false } : null
}

/** A live game of the catalog: the registry's entry, played on the site. */
export type LiveEntry = { live: true; slug: string; game: GameEntry; related: string[] }

/** A game of the catalog that is not live: Notion's row. */
export type PlannedEntry = { live: false; slug: string; game: NotionGame; related: string[] }

/**
 * One line of the catalog: a live game (the registry's entry, played on the site) or a planned one (Notion's row). `related` is the
 * slugs of the other games of the catalog it is linked to, whichever side of the link Notion has: its related games, its base game, the
 * games that name it as theirs. In catalog order, never its own slug, and only games that are listed (a page for each).
 */
export type CatalogEntry = LiveEntry | PlannedEntry

/**
 * The catalog and where it came from. `notion`: "off" without a token (live games only), "ok" when Notion answered, "unavailable"
 * when it did not (live games only, the failure is logged).
 */
export type Catalog = { entries: CatalogEntry[]; notion: "off" | "ok" | "unavailable" }

/** Games of the registry that are not in the catalog: the template is the demo of the shared base, not a game. */
export const UNLISTED_SLUGS: ReadonlySet<string> = new Set(["template"])

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

/** Every link between two games, both ways, from the one side each `NotionGame.related` holds: the slug of a game → the slugs it is linked to. */
function relatedLinks(planned: readonly NotionGame[]): Map<string, Set<string>> {
  const links = new Map<string, Set<string>>()
  const link = (from: string, to: string) => {
    if (from === to) return
    links.set(from, (links.get(from) ?? new Set<string>()).add(to))
  }
  for (const game of planned) {
    for (const other of game.related) {
      link(game.slug, other)
      link(other, game.slug)
    }
  }
  return links
}

/**
 * The catalog: the live games of the registry (in registry order), then the planned ones (sorted by `comparePlanned`).
 * - A live game is the registry's: its Notion row, and its Development rank, are ignored. Only the links of that row to other games count.
 * - A game of the registry that is not live takes its Notion row, and Notion's name with it; with no row it is not listed.
 * - A Notion game that is not in the registry is planned.
 * - `UNLISTED_SLUGS` are never listed.
 * - Two games are related when either row says so, and `related` only names games that are listed.
 */
export function buildCatalog(games: readonly GameEntry[], planned: readonly NotionGame[]): CatalogEntry[] {
  const live: CatalogEntry[] = games.filter((game) => game.live && !UNLISTED_SLUGS.has(game.slug)).map((game) => ({ live: true, slug: game.slug, game, related: [] }))
  const taken = new Set(live.map((entry) => entry.slug))
  const comingSoon: CatalogEntry[] = planned
    .filter((game) => !UNLISTED_SLUGS.has(game.slug) && !taken.has(game.slug))
    .sort(comparePlanned)
    .map((game) => ({ live: false, slug: game.slug, game, related: [] }))
  const listed = [...live, ...comingSoon]
  const links = relatedLinks(planned)
  return listed.map((entry) => ({ ...entry, related: listed.filter((other) => links.get(entry.slug)?.has(other.slug)).map((other) => other.slug) }))
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
