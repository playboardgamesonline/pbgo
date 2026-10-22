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
 * A game of the Notion Games database that is not live: everything the hub and its page can show. Plain data (strings, numbers,
 * arrays), so it travels through the cache and into a client component as it is. The pictures are only flagged: Notion's own links
 * expire after about an hour, so a picture is fetched fresh when it is served (`notionPageId` finds its row, `editedAt` changes
 * the URL when the row changes).
 */
export type PlannedGame = {
  slug: string
  name: string
  /** Notion's Status as written ("Not started", "Rules", … "Live", "Paused"); null when empty. Sorts the list, never shown. */
  status: string | null
  /** 1 (P1 · Now) to 4 (P4 · Someday); null when empty. Sorts the list, never shown. */
  priority: number | null
  /** Read, not used yet. */
  effort: string | null
  /** A description per language, only the languages the row fills. Pick one with `pickLocalized`. */
  descriptions: Partial<Record<Locale, string>>
  /** `max: null` is "N or more". */
  players: { min: number; max: number | null } | null
  /** Minutes. */
  duration: number | null
  /** The minimum age in years. */
  age: number | null
  authors: string[]
  artists: string[]
  publishers: Publisher[]
  /** Link to the rulebook per language, only the languages the row fills. */
  rules: Partial<Record<Locale, string>>
  art: Record<ArtSlot, boolean>
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

/** The URL of a planned game's picture (`/api/catalog/<slug>/<slot>`, see `route.ts`), or null when its row has none: a missing picture is a black background, nothing else. */
export function pictureUrl(game: Pick<PlannedGame, "slug" | "art" | "editedAt">, slot: ArtSlot): string | null {
  return game.art[slot] ? `/api/catalog/${game.slug}/${slot}?v=${pictureVersion(game.editedAt)}` : null
}

/** One line of the catalog: a live game (the registry's entry, played on the site) or a planned one (Notion's row). */
export type CatalogEntry = { live: true; slug: string; game: GameEntry } | { live: false; slug: string; game: PlannedGame }

/**
 * The catalog and where it came from. `notion`: "off" without a token (live games only), "ok" when Notion answered, "unavailable"
 * when it did not (live games only, the failure is logged).
 */
export type Catalog = { entries: CatalogEntry[]; notion: "off" | "ok" | "unavailable" }

/** Games of the registry that are not in the catalog: the template is the demo of the shared base, not a game. */
export const UNLISTED_SLUGS: ReadonlySet<string> = new Set(["template"])

/** Notion's Status, the furthest along first. A status that is not in the list (or none) counts as "Not started". */
export const STATUS_ORDER: readonly string[] = ["Live", "PlayTest", "Table", "Content", "Engine", "Rules", "Not started", "Paused"]

const NOT_STARTED = STATUS_ORDER.indexOf("Not started")
const NO_PRIORITY = 99
// "6 nimmt!" before "7 Wonders", "Skyjo" and "Skull King" in the order a reader expects
const NAMES = new Intl.Collator("en", { sensitivity: "base", numeric: true })

function statusRank(status: string | null): number {
  const rank = status === null ? -1 : STATUS_ORDER.indexOf(status)
  return rank >= 0 ? rank : NOT_STARTED
}

/** Status (furthest along first, Paused last), then priority (P1 first, none last), then name. */
export function comparePlanned(a: PlannedGame, b: PlannedGame): number {
  return statusRank(a.status) - statusRank(b.status) || (a.priority ?? NO_PRIORITY) - (b.priority ?? NO_PRIORITY) || NAMES.compare(a.name, b.name)
}

/**
 * The catalog: the live games of the registry (in registry order), then the planned ones (sorted by `comparePlanned`).
 * - A live game is the registry's: its Notion row, if any, is ignored.
 * - A game of the registry that is not live takes its Notion row, and Notion's name with it; with no row it is not listed.
 * - A Notion game that is not in the registry is planned.
 * - `UNLISTED_SLUGS` are never listed.
 */
export function buildCatalog(games: readonly GameEntry[], planned: readonly PlannedGame[]): CatalogEntry[] {
  const live: CatalogEntry[] = games.filter((game) => game.live && !UNLISTED_SLUGS.has(game.slug)).map((game) => ({ live: true, slug: game.slug, game }))
  const taken = new Set(live.map((entry) => entry.slug))
  const comingSoon: CatalogEntry[] = planned
    .filter((game) => !UNLISTED_SLUGS.has(game.slug) && !taken.has(game.slug))
    .sort(comparePlanned)
    .map((game) => ({ live: false, slug: game.slug, game }))
  return [...live, ...comingSoon]
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
