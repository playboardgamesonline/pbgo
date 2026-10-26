import "server-only"
import { cache } from "react"
import { pickLocalized, type CatalogEntry, type PlannedGame } from "@pbgo/catalog"
import { getCatalog } from "@pbgo/catalog/server"
import type { GameEntry } from "@pbgo/core/lib/binding"
import { LOCALES, type Locale } from "@pbgo/core/lib/i18n"
import { getLocale } from "@pbgo/core/lib/locale-server"
import { loadSettings } from "@pbgo/core/lib/settings-server"
import { gameCardArt } from "@pbgo/core/sanity/cover"
import { getGame } from "@pbgo/games"
import type { GameCardProps, GameCardVisualProps } from "@pbgo/ui/platform/game-card"
import { catalogCardProps } from "./catalog-cards"
import { durationLabel, livePicture, playersLabel, plannedFacts, plannedPicture } from "./game-card-props"

/** One line of a game's facts: a label and its values, each one a link when it has an address. */
export type GameFact = { label: string; values: { text: string; href?: string }[] }

/** The rulebook of one language: its link, titled in that language with the game's name ("Règles du jeu - Flip 7"). */
export type GameRulebook = { language: Locale; label: string; href: string }

/** What a game's page on the hub (`/game/<slug>`) shows, whether the game is live or to come. */
export type GamePage = {
  slug: string
  name: string
  /** Live in the registry: the page's button opens the game's own site. A game to come gets a disabled "Coming soon" button. */
  live: boolean
  /** The registry's English line: live games only. */
  tagline: string | null
  /** In the visitor's language, else English, else French, else any: `language` is the one taken. Null when no language has a text. */
  description: { text: string; language: Locale } | null
  /** Already formatted, like the card's ("2–5 players", "30 min"). */
  players: string | null
  duration: string | null
  /** Worded like the two above, drawn beside them ("Ages 8+"). A game to come only: the settings of a live game hold no age. */
  age: string | null
  /** The credits (authors, illustrators, publishers) one after the other: only the lines that have a value. */
  facts: GameFact[]
  /** One per language the game has a rulebook in, the visitor's language first. Empty: the page has no rulebook area. */
  rulebooks: GameRulebook[]
  /** The page's picture is the game's card's: its logo over its background (`GameCardVisual`). A picture the game does not have leaves the frame plain. */
  picture: Pick<GameCardVisualProps, "logo" | "background">
  /** The games the catalog relates to this one (docs/catalog.md), in the catalog's order, each as the props of its card. Empty: the page has no such section. */
  related: { slug: string; card: GameCardProps }[]
}

/** What a game's own data gives the page; the related games come from the catalog. */
type GameDetails = Omit<GamePage, "related">

const fact = (label: string, values: GameFact["values"]): GameFact[] => (values.length ? [{ label, values }] : [])
const plural = (count: number, one: string, many: string) => (count === 1 ? one : many)

/**
 * What a rulebook is called in its own language, before the game's name. A platform text, in code because a game to come has no Sanity
 * project to read it from: French, Spanish and German are the Studio's "game rules" label (`rulesTitle`, `@pbgo/studio-kit`), English is
 * "Rulebook" rather than the Studio's "Game rules".
 */
const RULEBOOK_TITLES: Record<Locale, string> = { fr: "Règles du jeu", en: "Rulebook", es: "Reglas del juego", de: "Spielregeln" }

/** The rulebook of every language the game has one in, the visitor's language first. */
function rulebooks(links: Partial<Record<Locale, string | null>>, locale: Locale, name: string): GameRulebook[] {
  return [locale, ...LOCALES.filter((language) => language !== locale)].flatMap((language) => {
    const href = links[language]
    return href ? [{ language, label: `${RULEBOOK_TITLES[language]} - ${name}`, href }] : []
  })
}

function plannedPage(game: PlannedGame, locale: Locale): GameDetails {
  const { players, duration } = plannedFacts(game)
  return {
    slug: game.slug,
    name: game.name,
    live: false,
    tagline: null,
    description: pickLocalized(game.descriptions, locale),
    players: players ?? null,
    duration: duration ?? null,
    age: game.age === null ? null : `Ages ${game.age}+`,
    facts: [
      ...fact(plural(game.authors.length, "Author", "Authors"), game.authors.map((text) => ({ text }))),
      ...fact(plural(game.illustrators.length, "Illustrator", "Illustrators"), game.illustrators.map((text) => ({ text }))),
      ...fact(plural(game.publishers.length, "Publisher", "Publishers"), game.publishers.map(({ name, url }) => ({ text: name, href: url ?? undefined }))),
    ],
    rulebooks: rulebooks(game.rules, locale, game.name),
    picture: plannedPicture(game),
  }
}

async function livePage(entry: GameEntry, locale: Locale): Promise<GameDetails> {
  // The texts, the credits, the rulebooks and the picture are the game's own, in its Sanity project; the figures are the registry's, as on the card.
  // The picture is read wider than the card's: the page draws it larger
  const [settings, art] = await Promise.all([
    getGame(entry.slug).then((game) => (game ? loadSettings(game, locale) : null)),
    gameCardArt(entry, 1200),
  ])
  const { authors, publisher, publisherUrl } = settings?.credits ?? { authors: null, publisher: null, publisherUrl: null }
  return {
    slug: entry.slug,
    name: entry.name,
    live: true,
    tagline: entry.tagline,
    description: settings ? pickLocalized(settings.descriptions, locale) : null,
    players: playersLabel(entry.players) ?? null,
    duration: durationLabel(entry.duration) ?? null,
    age: null,
    facts: [
      ...fact("Credits", authors ? [{ text: authors }] : []),
      ...fact("Publisher", publisher ? [{ text: publisher, href: publisherUrl ?? undefined }] : []),
    ],
    rulebooks: settings ? rulebooks(settings.rulesPdf, locale, entry.name) : [],
    picture: livePicture(art),
  }
}

/** The cards of the games listed as related to an entry. `entry.related` is already in the catalog's order, listed games only, never the entry itself. */
function relatedCards(entry: CatalogEntry, entries: CatalogEntry[]): Promise<GamePage["related"]> {
  return Promise.all(
    entry.related.flatMap((slug) => {
      const related = entries.find((candidate) => candidate.slug === slug)
      return related ? [catalogCardProps(related).then((card) => ({ slug, card }))] : []
    })
  )
}

/**
 * The page of a game of the catalog (`/game/<slug>`), null when the catalog does not list the slug: the page then answers 404.
 * A game to come is a row of the Notion Games database, so without Notion (no key, or Notion down) only the live games have a page.
 * Read once per request, however many times the page and its metadata ask. Reading the visitor's language makes the page dynamic.
 */
export const getGamePage = cache(async (slug: string): Promise<GamePage | null> => {
  const { entries } = await getCatalog()
  const entry = entries.find((candidate) => candidate.slug === slug)
  if (!entry) return null
  const locale = await getLocale()
  const [details, related] = await Promise.all([
    entry.live ? livePage(entry.game, locale) : plannedPage(entry.game, locale),
    relatedCards(entry, entries),
  ])
  return { ...details, related }
})
