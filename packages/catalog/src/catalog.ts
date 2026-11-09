// The hub catalog as a pure model: the games of the platform's Sanity project (`sanity.ts` reads them), each one joined with the flags the
// registry holds for it (is it playable here, may search engines in), into one list. No I/O and no framework in this file, so that Node
// (`pnpm catalog:list`), the tests and Next read it as it is. The reader is `sanity.ts`, the cached one for apps/web is `server.ts` (see
// docs/catalog.md).

import type { AgeRules } from "@pbgo/core/lib/age-rules"
import type { GameEntry } from "@pbgo/core/lib/binding"
import type { Locale } from "@pbgo/core/lib/i18n"
import { CREATOR_ROLES, LANGUAGES, type CreatorRole } from "@pbgo/studio-kit/constants"

/** A publisher of a game: its name and, when it has one, its website. */
export type Publisher = { name: string; url: string | null }

/** A person credited on a game, and what they did on it (a person is on one line of a game, with all their roles). */
export type Creator = { name: string; roles: CreatorRole[] }

/** The four pictures a game can have: its logo and its icon, which mark it, its background, which is wide, and its cover, the picture of its card (PLT-114). */
export const ART_SLOTS = ["logo", "icon", "background", "cover"] as const
export type ArtSlot = (typeof ART_SLOTS)[number]

/** The two pictures an expansion can have: its cover and the front of its box. It has none of the other three of a game. */
export type ExpansionSlot = "cover" | "boxFront"

/**
 * A picture or a short clip of a game being played, which its page shows after its cover (`CatalogGame.gallery`): the address of its file in the
 * CDN of the platform's Sanity project (the image CDN for a picture and for the poster of a clip, the file CDN for a clip), and what it shows in a few
 * words when the Studio says (null: the page names it by its place). A clip is read with the poster that was set for it, else the page draws its first frame.
 */
export type GalleryItem =
  | { kind: "image"; url: string; caption: string | null }
  | { kind: "video"; url: string; poster: string | null; caption: string | null }

/**
 * A helper of a game, an aid that a player may have while they play, which the game's lobby offers as a small row with a switch (PLT-56): `key` is what the game calls it (unique among the game's helpers),
 * `title` is what the lobby says ("Show the score calculation").
 */
export type GameHelper = { key: string; title: string }

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
  /** The page of a shop that sells the game, the link its game's page gives to buy it (a web address, as the Studio keeps it). Null when the Studio has none: the page has no such link. */
  buyUrl: string | null
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
  /** The pictures and the clips the game's page shows after its cover, in the order the Studio lists them, `GALLERY_MAX` at most. Empty: the page shows the cover alone. */
  gallery: GalleryItem[]
  /** The helpers the game's lobby offers, in the order the Studio lists them, `HELPERS_MAX` at most. Empty: the lobby has none. */
  helpers: GameHelper[]
  /**
   * The slugs of the games it is related to, in the order the Studio lists them, never its own slug, and only games the reader kept:
   * its related games, then its base game. One side of the link as far as the Studio goes: `buildCatalog` makes it go both ways
   * (`CatalogEntry.related`).
   */
  related: string[]
  /** What orders the games, lowest first, the live ones and the ones to come each among themselves (`buildCatalog`): the owner's "hotness" of the games. Null for a game with none. */
  order: number | null
  /** ISO date of the last edit of the game in the Studio. */
  updatedAt: string
  /** ISO date and time the game was created in the Studio, the day it was added: what the list sorted by "Newest" reads (`sortGames`). Null for a game with no document (`registryRow`) and when the Studio's date does not read. */
  addedAt: string | null
}

/**
 * An expansion of a game: a published `expansion` of the platform's Sanity project (PLT-102), played with its base game. It is no game of the hub and has no page: the lobby of its base game offers it, as a card with its picture, its name and its description, and a table says
 * which it is played with. Plain data like `CatalogGame`. It has its description, its figures and its categories, the ones that the lobby says before an expansion is chosen; the rest of its document (credits, links to the rules, release date) is not read yet: nothing on the hub shows it.
 */
export type CatalogExpansion = {
  /** What a table calls it: its slug in the Studio, unique among the expansions. */
  slug: string
  name: string
  /** The slug of the game it is played with, one that the hub lists. */
  base: string
  /** A description per language, only the languages the expansion has one in: English for now. Pick one with `pickLocalized`. */
  descriptions: Partial<Record<Locale, string>>
  /**
   * The figures of the game played with the expansion, each only when the Studio says it (an empty one is the base game's, and so is null here): the least and the most players, the minutes, the minimum age in years and the weight
   * on BoardGameGeek's scale. The lobby says the ones that differ from its game's.
   */
  playersMin: number | null
  playersMax: number | null
  duration: number | null
  age: number | null
  complexity: number | null
  /** The names of the categories it brings, in the order the Studio lists them (the ones of its base game need not be among them): its card in the lobby shows them as tags. */
  categories: string[]
  /** The address of each picture in the image CDN of the platform's Sanity project, as for a game (`pictureUrl` sizes it); null for a picture it does not have. */
  pictures: Record<ExpansionSlot, string | null>
}

/**
 * How wide the image CDN is asked for a picture, in pixels: a card shows a game's logo and icon small and its cover or its background
 * across the frame, and the page draws the logo and the background larger; an expansion's cover is drawn wide, like a game's, and the front
 * of its box smaller. Never more than the file holds.
 */
const PICTURE_WIDTH: Record<ArtSlot | ExpansionSlot, number> = { logo: 800, icon: 512, background: 1200, cover: 1200, boxFront: 600 }

/** The end of the name of a file of the image CDN: the size of the picture and its format (`<hash>-650x590.webp`), and a query when the address was sized. */
const FILE_NAME = /-(\d+)x(\d+)\.([a-z0-9]+)(?:\?.*)?$/i

/** The formats a file is already compressed for the web in. The CDN would only encode one of these a second time and lose a little more; a PNG or a GIF is not one, and a large one must still be shrunk. */
const COMPRESSED_FORMATS = new Set(["webp", "jpg", "jpeg", "avif"])

/** How well the CDN encodes a picture it resizes: above its own default (75), which shows on a picture that was a lossy file already. */
const RESIZE_QUALITY = 85

/**
 * The URL of a picture of a game or of an expansion, sized for the page (`sizedPictureUrl`): the address of the file in the image CDN, asked
 * for at the width the page draws it and in the format the browser takes, or the file itself when it needs neither. Null when it has none:
 * a picture it does not have is a plain frame, nothing else. `width` is how wide the CDN is asked for it, the page's own by default: a
 * small tile asks for less.
 */
export function pictureUrl<Slot extends ArtSlot | ExpansionSlot>(owner: { pictures: Record<Slot, string | null> }, slot: NoInfer<Slot>, width: number = PICTURE_WIDTH[slot]): string | null {
  const url = owner.pictures[slot]
  return url ? sizedPictureUrl(url, width) : null
}

/**
 * The address of a file of the image CDN for a page that draws it `width` pixels wide at most (how a picture of a gallery is sized too):
 * - A vector picture (SVG) is served as it is.
 * - So is a file in a format that is already compressed (WebP, JPEG, AVIF) and whose name says it is not wider than that (`FILE_NAME`, the way
 *   `pictureRatio` reads it): no query at all, since asking the CDN for it would encode it a second time, and lose a little more.
 * - Any other is asked for `width` pixels wide at most (`fit=max`, never made bigger) in the best format the browser takes (`auto=format`),
 *   at a quality of `RESIZE_QUALITY`. A PNG or a GIF is always asked for, so that a large one does not go out whole.
 */
export function sizedPictureUrl(url: string, width: number): string {
  if (url.endsWith(".svg")) return url
  const [, named, , format] = FILE_NAME.exec(url) ?? []
  const fileWidth = Number(named)
  if (format && COMPRESSED_FORMATS.has(format) && fileWidth > 0 && fileWidth <= width) return url
  return `${url}?w=${width}&fit=max&auto=format&q=${RESIZE_QUALITY}`
}

/**
 * The width over the height of a picture of the image CDN, read from its address: the CDN names each file after the size of the picture (`<hash>-650x590.webp`), so its shape is known before it arrives, and a frame can be given it to keep
 * the page still. Null for no picture and for an address that carries no size (or one that makes no shape).
 */
export function pictureRatio(url: string | null): number | null {
  const size = url === null ? null : FILE_NAME.exec(url)
  const ratio = size ? Number(size[1]) / Number(size[2]) : NaN
  return Number.isFinite(ratio) && ratio > 0 ? ratio : null
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

/** BoardGameGeek's website: where its icon is looked for and where the address of every game's page there starts. */
export const BGG_SITE = "https://boardgamegeek.com"

/** The place of BoardGameGeek's icon in a game's address (`/api/catalog/<slug>/bgg`), the way `publisher-<n>` is a publisher's. */
export const BGG_SLOT = "bgg"

/** The address of a game's page on BoardGameGeek, from its id there; null when the game has none. BoardGameGeek sends that short address to the page with the game's name in it. */
export function bggUrl(game: Pick<CatalogGame, "bggId">): string | null {
  return game.bggId === null ? null : `${BGG_SITE}/boardgame/${game.bggId}`
}

/**
 * The URL of BoardGameGeek's icon, which a game's page draws on its link there (`/api/catalog/<slug>/bgg`, see `route.ts`), or null when the game has no page there to link to. Like a publisher's,
 * it is served from this site, so that a visitor's browser never asks BoardGameGeek for it, and it carries the version of the website the server looks the icon up on. It names the game and never an address.
 */
export function bggIconUrl(game: Pick<CatalogGame, "slug" | "bggId">): string | null {
  return game.bggId === null ? null : `/api/catalog/${game.slug}/${BGG_SLOT}?v=${iconVersion(BGG_SITE)}`
}

/**
 * The year a game came out, four digits, or null. A year is all that the date says for sure: the Studio keeps a day, and takes the first of January (or of the month) when it knows
 * less, so the day is never shown.
 */
export function releaseYear(game: Pick<CatalogGame, "releaseDate">): string | null {
  return game.releaseDate === null ? null : game.releaseDate.slice(0, 4)
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

/**
 * A game's mark, the small and often transparent picture of it: its logo, else its icon, else none. A card draws it, contained on its plain frame, for a game that has no cover or background to
 * fill the frame with (`cardPicture`), and a page shares it for a game that has no background (`sharePicture`).
 */
export function cardPictureUrl(game: Pick<CatalogGame, "pictures">): string | null {
  return pictureUrl(game, "logo") ?? pictureUrl(game, "icon")
}

/**
 * What a game's card on the hub draws (PLT-114), the first of these the game has, and never two of them (no logo is laid over a picture):
 * 1. its cover, which fills the frame (`fills`);
 * 2. its background, which fills it too, alone;
 * 3. its logo, else its icon (`cardPictureUrl`), which sit on the plain frame, contained, since they are small and often transparent;
 * 4. nothing: the card is a plain frame.
 * The address is sized for a card (`pictureUrl`). The card (`@pbgo/ui/platform/game-card`) draws what it is told and chooses nothing: `apps/web` hands it this.
 */
export function cardPicture(game: Pick<CatalogGame, "pictures">): { url: string; fills: boolean } | null {
  const filling = pictureUrl(game, "cover") ?? pictureUrl(game, "background")
  if (filling) return { url: filling, fills: true }
  const mark = cardPictureUrl(game)
  return mark ? { url: mark, fills: false } : null
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
 * failure is logged). Without it the catalog is the live games of the registry, each one a `registryRow`. `expansions` are the ones of the games, read apart since they have no page (`expansionsOf` picks a game's).
 */
export type Catalog = { entries: CatalogEntry[]; expansions: CatalogExpansion[]; source: "ok" | "unavailable" }

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
    buyUrl: null,
    releaseDate: null,
    age: null,
    categories: [],
    creators: [],
    publishers: [],
    rules: {},
    pictures: { logo: null, icon: null, background: null, cover: null },
    gallery: [],
    helpers: [],
    related: [],
    order: null,
    updatedAt: "",
    addedAt: null,
  }
}

// "6 nimmt!" before "7 Wonders", "Skyjo" and "Skull King" in the order a reader expects
const NAMES = new Intl.Collator("en", { sensitivity: "base", numeric: true })

/** The order of two games by their `order` of the Studio alone: lowest first, a game with none after the games that have one, 0 where it leaves them tied. */
function compareOrder(a: Pick<CatalogGame, "order">, b: Pick<CatalogGame, "order">): number {
  if (a.order === b.order) return 0
  if (a.order === null) return 1
  if (b.order === null) return -1
  return a.order - b.order
}

/**
 * The order of the games to come: the `order` of the Studio, lowest first, a game with none after the games that have one, then the name,
 * case and accents aside, numbers in their order.
 */
export function compareGames(a: Pick<CatalogGame, "order" | "name">, b: Pick<CatalogGame, "order" | "name">): number {
  return compareOrder(a, b) || NAMES.compare(a.name, b.name)
}

/** The expansions of a game, the ones whose base game it is, by name, case and accents aside, numbers in their order: an expansion has no `order` in the Studio (`docs/platform-sanity.md`). */
export function expansionsOf(expansions: readonly CatalogExpansion[], slug: string): CatalogExpansion[] {
  return expansions.filter((expansion) => expansion.base === slug).sort((a, b) => NAMES.compare(a.name, b.name))
}

/**
 * The ages that the Studio says a game and its expansions ask, for the age check of the tables (PLT-125, `AgeRules` of `@pbgo/core/lib/age-rules`): the "Minimum age" of the game (null when it says none, and for a game the catalog does not list) and, for
 * each of its expansions that has an age of its own, that age under the expansion's slug, the id a table calls it by. An expansion with none is played at its game's age, which the game's covers. Which of these ages the platform enforces is `restrictedAge`.
 */
export function ageRulesFor(entries: readonly CatalogEntry[], expansions: readonly CatalogExpansion[], slug: string): AgeRules {
  const own: Record<string, number> = {}
  for (const expansion of expansionsOf(expansions, slug)) if (expansion.age !== null) own[expansion.slug] = expansion.age
  return { game: entries.find((entry) => entry.slug === slug)?.game.age ?? null, expansions: own }
}

// The games a game's page recommends: its family first, then the games that look like it. They are in this file and not in a file of their own because `pnpm catalog:list` runs this one under plain Node, which strips the types
// and resolves no other file of the package.

/** The most games a page recommends: nine, in the one row of cards that scrolls sideways under the title "Similar games". */
export const RELATED_MAX = 9

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
 * The catalog: the live games of the registry, then the other games of the platform's Sanity project, each group in the order of the Studio
 * (`order`, lowest first): the order the hub lists the games in, the "hotness" of the games, whose sort "Trending" is (`sortGames`). Every game
 * shows the values of its game in the Studio.
 * - A live game takes its game of the Studio, and its name with it. With none (the project cannot be read, or has none for it) it takes
 *   `registryRow`, so a game the site can play is always listed. The live games are in their `order` too, before all the others, the registry's
 *   order breaking a tie: a row of the registry has no `order`, so it comes after the live games that have one.
 * - The other rows are the registry's games that are not live and the games the registry does not know, sorted by `compareGames` (their `order`, then
 *   their name). A game of the registry that is not live and has no row is not listed.
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
    // The sort is stable: the live games that the order leaves tied, and the ones with none, stay in registry order
    .sort((a, b) => compareOrder(a.game, b.game))
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
