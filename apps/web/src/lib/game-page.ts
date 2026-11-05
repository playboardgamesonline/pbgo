import "server-only"
import { cache } from "react"
import { bggIconUrl, bggUrl, creditLines, pickLocalized, releaseYear, type CatalogEntry, type CreditLine } from "@pbgo/catalog"
import { gameSeo, type GameSeo } from "@pbgo/catalog/seo"
import { getCatalog } from "@pbgo/catalog/server"
import { LOCALES, type Locale } from "@pbgo/core/lib/i18n"
import { getLocale } from "@pbgo/core/lib/locale-server"
import type { GameCardProps } from "@pbgo/ui/platform/game-card"
import type { HelperOption } from "@pbgo/ui/platform/lobby-settings"
import { catalogCardProps, durationLabel, heroPicture, playersLabel } from "./game-card-props"

/** One line of a game's credits: a label and its values, each one a link when it has an address, with an icon when the site it leads to has one (`creditLines`). */
export type GameFact = CreditLine

/** A category of a game, and the games' list showing the games that have it. */
export type GameCategory = { name: string; href: string }

/** The rulebook of one language: its link, titled in that language with the game's name ("Règles du jeu - Flip 7"). */
export type GameRulebook = { language: Locale; label: string; href: string }

/** What a game's page on the hub (`/game/<slug>`) shows: the values of the game in the platform's Sanity project, whether the game is live or to come. */
export type GamePage = {
  slug: string
  name: string
  /** Live in the registry: the page's button opens the game's own site. Any other game gets a disabled "Coming soon" button. */
  live: boolean
  /** In the visitor's language, else English, else French, else any: `language` is the one taken. Null when no language has a text. */
  description: { text: string; language: Locale } | null
  /** Already formatted, like the card's ("2–5 players", "30 min"). */
  players: string | null
  /** The least players the game needs, the figure behind `players`: the button that starts a lobby waits for them. Null when the Studio has none. */
  minPlayers: number | null
  /** The most players the game takes, the other figure behind `players`: a lobby may be set for as many. Null when the Studio has none, or when the game takes any number from its least. */
  maxPlayers: number | null
  duration: string | null
  /** The weight BoardGameGeek gives the game, worded like the figures around it ("Complexity 2.4/5"): drawn between the duration and the age. Null while the Studio has none. */
  complexity: string | null
  /** Worded like the figures above, drawn beside them ("Ages 8+"). */
  age: string | null
  /** The categories of the game in the order the Studio lists them, each with the page of the games that have it (the games' list, filtered): drawn as chips under the name. */
  categories: GameCategory[]
  /** The credits one after the other: a line for each role somebody has on the game (designers, artists…), then the publishers, then the year it came out ("Released 2024": a year is all the Studio's date says for sure); only the lines that have a value. */
  facts: GameFact[]
  /** One per language the game has a rulebook in, the visitor's language first. Empty: the page has no button for the rules. */
  rulebooks: GameRulebook[]
  /** The game's page on BoardGameGeek, with BoardGameGeek's icon (an address on this site: the server finds it there). Null when the Studio has no id for the game there: the page has no such button. */
  bgg: { href: string; icon: string } | null
  /** A shop's page for the game, which the page links to under its credits. Null when the Studio has none: the page has no such link. */
  shop: string | null
  /** The pictures of the head: the game's background, drawn across the whole width of the page behind it, and its logo, drawn in place of its name. A picture the game does not have is left out: the head writes the name, and has no art. */
  hero: { logo?: string; background?: string }
  /** The aids that a player may have while they play, in the order the Studio lists them: a row each in the settings of a lobby. Empty: the settings have no helpers. */
  helpers: HelperOption[]
  /** The games the catalog recommends with this one (docs/catalog.md), the most relevant first (its family, then the games that look like it), each as the props of its card. Empty: the page has no such section. */
  related: { slug: string; card: GameCardProps }[]
  /** What the page tells search engines and social networks: its metadata, its JSON-LD, and whether it may be indexed (`@pbgo/catalog/seo`). */
  seo: GameSeo
}

/**
 * What a rulebook is called in its own language, before the game's name. A platform text, in code: the page is the platform's, not a
 * game's, and reads no game's Sanity project. French, Spanish and German are the Studio's "game rules" label (`rulesTitle`,
 * `@pbgo/studio-kit`), English is "Rulebook" rather than the Studio's "Game rules".
 */
const RULEBOOK_TITLES: Record<Locale, string> = { fr: "Règles du jeu", en: "Rulebook", es: "Reglas del juego", de: "Spielregeln" }

/** The rulebook of every language the game has one in, the visitor's language first. */
function rulebooks(links: Partial<Record<Locale, string | null>>, locale: Locale, name: string): GameRulebook[] {
  return [locale, ...LOCALES.filter((language) => language !== locale)].flatMap((language) => {
    const href = links[language]
    return href ? [{ language, label: `${RULEBOOK_TITLES[language]} - ${name}`, href }] : []
  })
}

/** The game's page on BoardGameGeek and the icon that draws its link: both come from its id there, so a game has both or neither. */
function bggLink(game: CatalogEntry["game"]): GamePage["bgg"] {
  const href = bggUrl(game)
  const icon = bggIconUrl(game)
  return href && icon ? { href, icon } : null
}

/**
 * The page of one entry of the catalog, the same for every game: its game in the Studio worded for the visitor, then the cards of its related
 * games. `entry.related` is already ranked (`rankRelated`), listed games only, never the entry itself.
 */
function gamePage(entry: CatalogEntry, entries: CatalogEntry[], locale: Locale): GamePage {
  const { game } = entry
  const description = pickLocalized(game.descriptions, locale)
  const year = releaseYear(game)
  return {
    slug: entry.slug,
    name: game.name,
    live: entry.live,
    description,
    players: playersLabel(game.players) ?? null,
    minPlayers: game.players?.min ?? null,
    maxPlayers: game.players?.max ?? null,
    duration: durationLabel(game.duration) ?? null,
    complexity: game.complexity === null ? null : `Complexity ${game.complexity.toFixed(1)}/5`,
    age: game.age === null ? null : `Ages ${game.age}+`,
    categories: game.categories.map((name) => ({ name, href: `/games?${new URLSearchParams({ category: name })}` })),
    facts: [...creditLines(game), ...(year === null ? [] : [{ label: "Released", values: [{ text: year }] }])],
    rulebooks: rulebooks(game.rules, locale, game.name),
    bgg: bggLink(game),
    shop: game.buyUrl,
    hero: heroPicture(game),
    helpers: game.helpers.map(({ key, title }) => ({ id: key, label: title })),
    related: entry.related.flatMap((slug) => {
      const related = entries.find((candidate) => candidate.slug === slug)
      return related ? [{ slug, card: catalogCardProps(related) }] : []
    }),
    seo: gameSeo(entry, description),
  }
}

/**
 * The page of a game of the catalog (`/game/<slug>`), null when the catalog does not list the slug: the page then answers 404.
 * Every game's page is its game in the Studio, so while the platform's Sanity project cannot be read only the live games have a page, from the registry.
 * Read once per request, however many times the page and its metadata ask. Reading the visitor's language makes the page dynamic.
 */
export const getGamePage = cache(async (slug: string): Promise<GamePage | null> => {
  const { entries } = await getCatalog()
  const entry = entries.find((candidate) => candidate.slug === slug)
  if (!entry) return null
  return gamePage(entry, entries, await getLocale())
})
