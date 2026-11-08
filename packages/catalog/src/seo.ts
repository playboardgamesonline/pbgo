// The SEO of the hub's game pages (`/game/<slug>`) as pure functions: which of them search engines may index, a page's metadata and
// JSON-LD, and the sitemap. Nothing is read here and no framework runs (only Next's `Metadata` and `MetadataRoute` types), so the tests
// read this file as it is; apps/web hands it what the page loaded (see docs/catalog.md).

import type { Metadata, MetadataRoute } from "next"
import { OG_LOCALES, type Locale } from "@pbgo/core/lib/i18n"
import { pickLocalized, sharePicture, type CatalogEntry, type Creator } from "./catalog"

/**
 * Whether search engines may index the hub page of a game (`/game/<slug>`): the one rule behind the page's `robots` meta, its JSON-LD and
 * its line of the sitemap. A live game follows the registry's `indexable` flag, as its own home does, so a Sanity project that is down never
 * turns it into a `noindex`. A game to come is indexable once its game in the Studio has a description, in any language: until then the page
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
  /** The `live` flag of the game's catalog entry: a game that is not live is coming soon, and its page does not promise a table (`playLead`). */
  live: boolean
  /** In the visitor's language, else English, else French, else any: `language` is the one taken. Null: no language has a text. */
  description: { text: string; language: Locale } | null
  /** The picture the page shares. `wide`: a social card only goes large with a wide picture. Null: the game has none and the page shares text alone. */
  image: { url: string; wide: boolean } | null
  players: { min: number; max: number | null } | null
  /** One duration, in minutes. */
  minutes: number | null
  /** The minimum age in years. */
  age: number | null
  /** The people credited on the game, with what they did on it. */
  creators: Creator[]
  publishers: { name: string; url: string | null }[]
}

/**
 * The SEO data of a game's page, from the values of its game in the Studio (`registryRow` for a live game that has none, which has no picture
 * and no text). `description` is the one the page shows, in the visitor's language (`pickLocalized`).
 */
export function gameSeo(entry: CatalogEntry, description: GameSeo["description"]): GameSeo {
  const { game } = entry
  return {
    slug: entry.slug,
    name: game.name,
    indexable: isIndexable(entry),
    live: entry.live,
    description,
    image: sharePicture(game),
    players: game.players,
    minutes: game.duration,
    age: game.age,
    creators: game.creators,
    publishers: game.publishers,
  }
}

/** The phrase that a game's page is found by, "Play Courtisans Online": its title in search results and its heading. */
export const playTitle = (name: string) => `Play ${name} Online`

/**
 * The sentence that opens the description of a game's page in search results and on social cards: it starts with the phrase, "Play Courtisans
 * online". A game that is not live cannot be played yet, and its description says it is coming soon, so that a search result never promises a
 * table that is not there (the line of the page itself, `playLine`, is the same for every game: the page says the rest).
 */
export const playLead = ({ name, live }: Pick<GameSeo, "name" | "live">) => (live ? `Play ${name} online with friends or rivals.` : `Play ${name} online, coming soon.`)

/** How many play, as a sentence says it: "for 2 to 5 players", "for 3 or more players", "for 2 players". Null when the game's players are not known. */
function playersPhrase(players: GameSeo["players"]): string | null {
  if (!players) return null
  if (players.max === null) return `for ${players.min} or more players`
  if (players.min === players.max) return `for ${players.min} ${players.min === 1 ? "player" : "players"}`
  return `for ${players.min} to ${players.max} players`
}

/**
 * The line at the foot of every game's page, the same for all of them, live or to come (the head already says a game is coming soon): it starts
 * with the phrase, "Play Courtisans online", then with whom, for how many players when the game says, and where. Without the players the line
 * is shorter, never wrong.
 */
export function playLine({ name, players }: Pick<GameSeo, "name" | "players">): string {
  const howMany = playersPhrase(players)
  return `Play ${name} online with friends or rivals, ${howMany ? `${howMany}, ` : ""}in your browser.`
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
 * The page is found by the phrase "Play <name> Online" (`playTitle`): it is the title, and the description opens with the sentence that
 * starts with it (`playLead`) before the game's own text, the lead alone for a game that has none. So a page always has a description.
 *
 * A page that is not indexable still carries its title, description and picture, for the link previews of chats and social networks.
 * The titles of `openGraph` and `twitter` are not run through the layout's template, so they carry the site name themselves.
 */
export function gameMetadata(game: GameSeo, site: { url: string; name: string }): Metadata {
  const url = pageUrl(site.url, game.slug)
  const phrase = playTitle(game.name)
  const title = `${phrase} · ${site.name}`
  const lead = playLead(game)
  const description = metaDescription(game.description ? `${lead} ${game.description.text}` : lead)
  const image = game.image ? absoluteUrl(site.url, game.image.url) : null
  return {
    title: phrase,
    description,
    alternates: { canonical: url },
    robots: game.indexable
      ? { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } }
      : { index: false, follow: true },
    openGraph: {
      type: "website",
      siteName: site.name,
      url,
      title,
      description,
      ...(game.description ? { locale: OG_LOCALES[game.description.language] } : {}),
      ...(image ? { images: [{ url: image }] } : {}),
    },
    twitter: {
      card: game.image?.wide ? "summary_large_image" : "summary",
      title,
      description,
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

/** The people who made the game (its designers, solo designers included) are its authors in JSON-LD; everyone else credited on it is a contributor. */
const isAuthor = (creator: Creator) => creator.roles.some((role) => role === "designer" || role === "soloDesigner")

/**
 * The schema.org `Game` of a game's page, for a `<script type="application/ld+json">`. Only what the game has: a field with no value is
 * absent, not empty. The illustrators are `contributor`s (schema.org has no `illustrator` on a Game). There is no `inLanguage`: the text is
 * in the language it was found in, which is not always the visitor's.
 */
export function gameJsonLd(game: GameSeo, site: string): Record<string, unknown> {
  const image = game.image ? absoluteUrl(site, game.image.url) : null
  const { players } = game
  const authors = game.creators.filter(isAuthor).map((creator) => creator.name)
  const contributors = game.creators.filter((creator) => !isAuthor(creator)).map((creator) => creator.name)
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
    ...(authors.length ? { author: people(authors) } : {}),
    ...(contributors.length ? { contributor: people(contributors) } : {}),
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

/** When a game's page last changed: its game's last edit in the Studio. A live game with none (`registryRow`) has no such date. */
function lastModified(entry: CatalogEntry): Date | undefined {
  const time = Date.parse(entry.game.updatedAt)
  return Number.isFinite(time) ? new Date(time) : undefined
}

/**
 * The sitemap: the hub, its list of games (`/games`), then the hub page of every indexable game of the catalog (`isIndexable`, so the
 * sitemap lists exactly the pages that do not say `noindex`). A game has no home of its own (`/<slug>` shows its hub page, whose canonical is `/game/<slug>`), so its
 * address is not listed. `site` is the origin, without a trailing slash.
 */
export function sitemapItems(site: string, entries: readonly CatalogEntry[]): SitemapItem[] {
  return [
    { url: site, changeFrequency: "weekly", priority: 1 },
    { url: `${site}/games`, changeFrequency: "weekly", priority: 0.9 },
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
