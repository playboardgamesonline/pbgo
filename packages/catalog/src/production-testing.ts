// The pages of a game in production, as the hub renders them, for the tests of `pnpm check:production` (`production-check.test.ts`, `check-production-script.test.ts`). The head is what Next writes from the
// metadata and the JSON-LD that `seo.ts` makes, and the sitemap what it writes from `sitemapItems`, so a page here changes when the real one does; the body is the part of the real page that the checks read
// (the navbar, the Back link, the heading, the badge, the buttons, the table space, the similar games), with its markup.
import type { Metadata } from "next"
import { tablesComingText } from "./production-check"
import { gameJsonLd, gameMetadata, serializeJsonLd, sitemapItems, type GameSeo } from "./seo"

/** The site as the hub's layout names it. */
export const SITE_URL = "https://playboardgamesonline.app"
export const SITE_NAME = "Play Board Games Online"

/** The SEO data of a live, indexable game with a description and a picture, the way the hub hands it to `gameMetadata`; `overrides` change a field. */
export const seo = (overrides: Partial<GameSeo> = {}): GameSeo => ({
  slug: "skyjo",
  name: "Skyjo",
  indexable: true,
  live: true,
  description: { text: "Get the lowest score by swapping and flipping the cards in your grid. A column of three matching cards disappears!", language: "en" },
  image: { url: "https://cdn.sanity.io/images/mhgqs6fe/production/abc-3840x2160.webp?w=1200&fit=max&auto=format&q=85", wide: true },
  players: { min: 2, max: 8 },
  minutes: 30,
  age: 8,
  creators: [{ name: "Alexander Bernhardt", roles: ["designer"] }],
  publishers: [{ name: "Magilano", url: null }],
  ...overrides,
})

/** A value as Next writes it in an attribute: `&`, `<`, `>` and the quotes escaped. */
const attr = (value: string) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

/** What Next renders in the head of a page from the metadata of `gameMetadata` and the JSON-LD of `gameJsonLd`: the title through the layout's template, the meta tags, the canonical link. */
export function head(game: GameSeo, site = SITE_URL): string {
  const metadata: Metadata = gameMetadata(game, { url: site, name: SITE_NAME })
  const robots = metadata.robots as { index: boolean; follow: boolean }
  const openGraph = metadata.openGraph as { title: string; description: string; url: string; siteName: string; images?: { url: string }[] }
  const meta = (key: "name" | "property", value: string, content: string) => `<meta ${key}="${value}" content="${attr(content)}"/>`
  return [
    `<title>${attr(`${String(metadata.title)} · ${SITE_NAME}`)}</title>`,
    meta("name", "description", String(metadata.description)),
    meta("name", "robots", `${robots.index ? "index" : "noindex"}, ${robots.follow ? "follow" : "nofollow"}`),
    meta("property", "og:title", openGraph.title),
    meta("property", "og:description", openGraph.description),
    meta("property", "og:url", openGraph.url),
    meta("property", "og:site_name", openGraph.siteName),
    ...(openGraph.images?.[0] ? [meta("property", "og:image", openGraph.images[0].url)] : []),
    `<link rel="canonical" href="${attr(String(metadata.alternates?.canonical))}"/>`,
    `<link rel="icon" href="/favicon.ico?v=2"/>`,
    `<script type="application/ld+json">${serializeJsonLd(gameJsonLd(game, site))}</script>`,
  ].join("")
}

export type Body = {
  /** The head carries the badge of a game that is not live. */
  badge?: boolean
  /** The table space says that tables are coming. */
  tablesComing?: boolean
  /** The Play button is disabled, and Create a table is a disabled button, not a link: the head of a game that is not live. */
  disabled?: boolean
  /** Only the Play button is disabled. */
  playDisabled?: boolean
  /** Only the Create a table link is missing (a disabled button stands in its place). */
  noCreateLink?: boolean
  /** A game of the similar games' row that is not live: a card with its own badge, further down. On by default, as on the real page. */
  similarSoon?: boolean
}

/** The part of the page that the checks read, with the markup of the real one: the navbar, the Back link, the heading (a logo, whose text is its alt), the badge, the buttons, the table space, the similar games. */
export function body(game: GameSeo, { badge = false, tablesComing = false, disabled = false, playDisabled = false, noCreateLink = false, similarSoon = true }: Body = {}): string {
  const play = `<button data-slot="button" type="button" ${disabled || playDisabled ? 'disabled=""' : ""} aria-haspopup="menu" aria-expanded="false" class="[&amp;&gt;svg]:size-4"><svg viewBox="0 0 24 24"><path d="M1 1"></path></svg>Play<svg viewBox="0 0 24 24"><path d="M2 2"></path></svg></button>`
  const create =
    disabled || noCreateLink
    ? `<button data-slot="button" data-variant="outline" disabled=""><svg viewBox="0 0 24 24"></svg>Create<span class="sr-only"> a table</span></button>`
    : `<a href="#create-a-game" data-cta="create_table" data-cta-game="${game.slug}" data-slot="button"><svg viewBox="0 0 24 24"></svg>Create<span class="sr-only"> a table</span></a>`
  return [
    `<nav><a href="/games">Games</a><a href="/tables">Tables</a><a href="/tournaments">Tournaments</a><a href="/about">About</a></nav>`,
    `<a href="/games" aria-label="Back to all games" class="sm:hidden"><svg viewBox="0 0 24 24"></svg>Back</a>`,
    `<h1><img src="https://cdn.sanity.io/images/p/production/logo.webp" alt="Play ${attr(game.name)} Online"/></h1>`,
    `<ul class="flex">${badge ? '<li><span data-slot="badge" data-variant="outline">Coming soon</span></li>' : ""}<li>2–8 players</li><li>30 min</li></ul>`,
    game.description ? `<p lang="en">${attr(game.description.text)}</p>` : "",
    `<div>${play}${create}</div>`,
    `<section aria-label="Play ${attr(game.name)}"><div data-slot="empty-title">${tablesComing ? "Coming soon" : "No table to join yet"}</div>`,
    tablesComing ? `<div data-slot="empty-description">${tablesComingText(attr(game.name))} here.</div>` : `<a href="#create-a-game">Open a table</a>`,
    `</section>`,
    `<section><h2>Tournaments</h2></section>`,
    similarSoon ? `<a data-slot="game-card" href="/game/6-nimmt"><span data-slot="badge" class="absolute">Coming soon</span></a>` : "",
    `<script>self.__next_f.push([1,"Coming soon ${tablesComingText(attr(game.name))}"])</script>`,
  ].join("")
}

/** A whole page of the game. */
export const html = (game: GameSeo, parts?: Body, site = SITE_URL) => `<!DOCTYPE html><html><head>${head(game, site)}</head><body>${body(game, parts)}</body></html>`

/** A sitemap as Next writes it from `sitemapItems`. */
export const sitemapXml = (entries: Parameters<typeof sitemapItems>[1], site = SITE_URL) =>
  `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sitemapItems(site, entries)
    .map((item) => `<url><loc>${item.url}</loc>${item.lastModified ? `<lastmod>${new Date(item.lastModified).toISOString()}</lastmod>` : ""}<changefreq>${item.changeFrequency}</changefreq><priority>${item.priority}</priority></url>`)
    .join("")}</urlset>`
