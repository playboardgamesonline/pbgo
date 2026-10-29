// The SEO of the hub's game pages (`/game/<slug>`) as pure functions: which of them search engines may index, a page's metadata and
// JSON-LD, and the sitemap. Nothing is read here and no framework runs (only Next's `Metadata` and `MetadataRoute` types), so the tests
// read this file as it is; apps/web hands it what the page loaded (see docs/catalog.md).

import type { Metadata, MetadataRoute } from "next"
import type { GameEntry } from "@pbgo/core/lib/binding"
import { OG_LOCALES, type Locale } from "@pbgo/core/lib/i18n"
import { pickLocalized, sharePicture, type CatalogEntry } from "./catalog"

/**
 * Whether search engines may index the hub page of a game (`/game/<slug>`): the one rule behind the page's `robots` meta, its JSON-LD and
 * its line of the sitemap. A live game follows the registry's `indexable` flag, as its own home does, so a Notion that is down never
 * turns it into a `noindex`. A game to come is indexable once its Notion row has a description, in any language: until then the page
 * has nothing to say and stays out of the results.
 */
export function isIndexable(entry: CatalogEntry): boolean {
  return entry.live ? entry.indexable : pickLocalized(entry.game.descriptions, "en") !== null
}

/** A text on one line: every run of white space (a line break of the source included) is one space. */
const flatten = (text: string) => text.replace(/\s+/g, " ").trim()

/**
 * A description as a meta description: on one line, at most `max` characters (a search result cuts about there), cut between two words
 * and closed with "…". Characters are counted as the reader sees them, so an emoji is one.
 */
export function metaDescription(text: string, max = 160): string {
  const line = flatten(text)
  const chars = [...line]
  if (chars.length <= max) return line
  // Room for the ellipsis. When the cut falls inside a word, that word goes (a first word longer than the room is cut as it stands)
  const head = chars.slice(0, max - 1).join("")
  const kept = /\s/.test(chars[max - 1] ?? "") ? head : head.replace(/\s+\S*$/, "")
  return `${kept.replace(/[\s,;:.!?–—-]+$/, "")}…`
}

/**
 * What the SEO of a game's page needs to know about the game, live or to come: plain data that `gameSeo` makes from the game's
 * catalog entry, and that `gameMetadata` and `gameJsonLd` read.
 */
export type GameSeo = {
  slug: string
  name: string
  /** `isIndexable` of the game's catalog entry. */
  indexable: boolean
  /** In the visitor's language, else English, else French, else any: `language` is the one taken. Null: no language has a text. */
  description: { text: string; language: Locale } | null
  /** The picture the page shares. `wide`: a social card only goes large with a wide picture. Null: the game has none and the page shares text alone. */
  image: { url: string; wide: boolean } | null
  players: { min: number; max: number | null } | null
  /** One duration, in minutes. */
  minutes: number | null
  /** The minimum age in years. */
  age: number | null
  authors: string[]
  illustrators: string[]
  publishers: { name: string; url: string | null }[]
}

/**
 * The SEO data of a game's page, from the values of its Notion row (`registryRow` for a live game that has none, which has no picture
 * and no text). `description` is the one the page shows, in the visitor's language (`pickLocalized`).
 */
export function gameSeo(entry: CatalogEntry, description: GameSeo["description"]): GameSeo {
  const { game } = entry
  return {
    slug: entry.slug,
    name: game.name,
    indexable: isIndexable(entry),
    description,
    image: sharePicture(game),
    players: game.players,
    minutes: game.duration,
    age: game.age,
    authors: game.authors,
    illustrators: game.illustrators,
    publishers: game.publishers,
  }
}

/** The URL of a game's page on the hub. */
const pageUrl = (site: string, slug: string) => `${site}/game/${slug}`

/** A URL as a crawler needs it, whole: a picture of the catalog is a path of the site. */
const absoluteUrl = (site: string, url: string) => new URL(url, site).href

/**
 * The metadata of a game's page, for `generateMetadata`. Next merges a page's metadata into its layout's one key by key, so what the
 * hub's layout sets and the page does not (the site's description, the share image of the site) stays, and what the page sets replaces it
 * whole: `openGraph` and `twitter` are written out in full, with the type, the site name and the URL again. A key with nothing to say is
 * left out, never set to `undefined`: Next reads a key that is present as an override.
 *
 * A page that is not indexable still carries its title, description and picture, for the link previews of chats and social networks.
 * The titles of `openGraph` and `twitter` are not run through the layout's template, so they carry the site name themselves.
 */
export function gameMetadata(game: GameSeo, site: { url: string; name: string }): Metadata {
  const url = pageUrl(site.url, game.slug)
  const title = `${game.name} · ${site.name}`
  const description = game.description ? metaDescription(game.description.text) : null
  const image = game.image ? absoluteUrl(site.url, game.image.url) : null
  return {
    title: game.name,
    ...(description ? { description } : {}),
    alternates: { canonical: url },
    robots: game.indexable
      ? { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } }
      : { index: false, follow: true },
    openGraph: {
      type: "website",
      siteName: site.name,
      url,
      title,
      ...(description ? { description } : {}),
      ...(game.description ? { locale: OG_LOCALES[game.description.language] } : {}),
      ...(image ? { images: [{ url: image }] } : {}),
    },
    twitter: {
      card: game.image?.wide ? "summary_large_image" : "summary",
      title,
      ...(description ? { description } : {}),
      ...(image ? { images: [image] } : {}),
    },
  }
}

/** A length of time in minutes as ISO 8601 ("PT30M", "PT1H30M", "PT2H"). */
function isoDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return `PT${hours ? `${hours}H` : ""}${rest || !hours ? `${rest}M` : ""}`
}

const people = (names: string[]) => names.map((name) => ({ "@type": "Person", name }))

/**
 * The schema.org `Game` of a game's page, for a `<script type="application/ld+json">`. Only what the game has: a field with no value is
 * absent, not empty. The illustrators are `contributor`s (schema.org has no `illustrator` on a Game). There is no `inLanguage`: the text is
 * in the language it was found in, which is not always the visitor's.
 */
export function gameJsonLd(game: GameSeo, site: string): Record<string, unknown> {
  const image = game.image ? absoluteUrl(site, game.image.url) : null
  const { players } = game
  return {
    "@context": "https://schema.org",
    "@type": "Game",
    name: game.name,
    url: pageUrl(site, game.slug),
    ...(game.description ? { description: flatten(game.description.text) } : {}),
    ...(image ? { image } : {}),
    ...(players
      ? { numberOfPlayers: { "@type": "QuantitativeValue", minValue: players.min, ...(players.max === null ? {} : { maxValue: players.max }) } }
      : {}),
    ...(game.minutes ? { timeRequired: isoDuration(game.minutes) } : {}),
    ...(game.age === null ? {} : { typicalAgeRange: `${game.age}-` }),
    ...(game.authors.length ? { author: people(game.authors) } : {}),
    ...(game.illustrators.length ? { contributor: people(game.illustrators) } : {}),
    ...(game.publishers.length
      ? { publisher: game.publishers.map(({ name, url }) => ({ "@type": "Organization", name, ...(url ? { url } : {}) })) }
      : {}),
  }
}

/** JSON-LD as the text of its `<script>`: `<` is escaped, so that a name can never close the tag. */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c")
}

export type SitemapItem = MetadataRoute.Sitemap[number]

/** When a game's page last changed: its Notion row's last edit. A live game with no row (`registryRow`) has no such date. */
function lastModified(entry: CatalogEntry): Date | undefined {
  const time = Date.parse(entry.game.editedAt)
  return Number.isFinite(time) ? new Date(time) : undefined
}

/**
 * The sitemap: the hub, its list of games (`/games`), the home of every indexable game of the registry, then the hub page of every
 * indexable game of the catalog (`isIndexable`, so the sitemap lists exactly the pages that do not say `noindex`). `site` is the origin,
 * without a trailing slash.
 */
export function sitemapItems(site: string, games: readonly Pick<GameEntry, "slug" | "indexable">[], entries: readonly CatalogEntry[]): SitemapItem[] {
  return [
    { url: site, changeFrequency: "weekly", priority: 1 },
    { url: `${site}/games`, changeFrequency: "weekly", priority: 0.9 },
    ...games.filter((game) => game.indexable).map((game): SitemapItem => ({ url: `${site}/${game.slug}`, changeFrequency: "weekly", priority: 0.9 })),
    ...entries.filter(isIndexable).map((entry): SitemapItem => {
      const modified = lastModified(entry)
      return {
        url: pageUrl(site, entry.slug),
        ...(modified ? { lastModified: modified } : {}),
        changeFrequency: entry.live ? "weekly" : "monthly",
        priority: entry.live ? 0.8 : 0.6,
      }
    }),
  ]
}
