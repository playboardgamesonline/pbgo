import type { SeedDoc } from "@pbgo/content-kit"
import type { NotionGame } from "@pbgo/catalog"
import { LANGUAGES } from "@pbgo/studio-kit/constants"
import type { CreatorRole, GameKind } from "../../apps/studio/schemaTypes/constants.ts"
import { categoryId, creatorId, gameId, item, publisherId, reference } from "./ids.ts"

/** The games are numbered 10, 20, 30… in the order the hub lists them, so that one can be slipped between two in the Studio without renumbering. */
export const ORDER_STEP = 10

/** What a standalone expansion becomes: a game of its own that rebuilds another one. Every other game of the catalog is a game. */
const kindOf = (game: NotionGame): GameKind => (game.standaloneOf === null ? "game" : "reimplementation")

/** The roles Notion tells of: the people of its Designers column are designers, those of its Artists column artists, and a person can be both. */
function creditsOf(game: NotionGame): { creator: string; roles: CreatorRole[] }[] {
  const lines = new Map<string, CreatorRole[]>()
  const add = (names: readonly string[], role: CreatorRole) => {
    for (const name of names) {
      const id = creatorId(name)
      const roles = lines.get(id) ?? []
      if (!roles.includes(role)) roles.push(role)
      lines.set(id, roles)
    }
  }
  add(game.authors, "designer")
  add(game.illustrators, "artist")
  return [...lines].map(([creator, roles]) => ({ creator, roles }))
}

/**
 * The games each game is related to, both ways: Notion keeps a link on the row of one game and, by hand, on the other if at all. A game
 * first lists those its own row names, then those whose row names it, in the order of the catalog, and only games of the catalog.
 */
function relatedTo(games: readonly NotionGame[]): Map<string, string[]> {
  const listed = new Set(games.map((game) => game.slug))
  const links = new Map(games.map((game) => [game.slug, [] as string[]]))
  const link = (from: string, to: string) => {
    const targets = links.get(from)
    if (targets && from !== to && listed.has(to) && !targets.includes(to)) targets.push(to)
  }
  for (const game of games) for (const other of game.related) link(game.slug, other)
  for (const game of games) for (const other of game.related) link(other, game.slug)
  return links
}

/**
 * The game documents, in the order they are given: that order is the `order` of the hub. A field the row leaves empty is left out
 * (the seed fills gaps, and never writes an empty value). The texts are the English ones, the translation system comes later; the
 * links to the rules are the only thing in the four languages.
 */
export function buildGames(games: readonly NotionGame[]): SeedDoc[] {
  const related = relatedTo(games)
  const known = new Set(games.map((game) => game.slug))

  return games.map((game, position) => {
    const doc: SeedDoc = {
      _id: gameId(game.slug),
      _type: "game",
      name: game.name,
      slug: { _type: "slug", current: game.slug },
      kind: kindOf(game),
      order: (position + 1) * ORDER_STEP,
    }
    if (game.bggId !== null) doc.bggId = game.bggId
    if (game.standaloneOf !== null && known.has(game.standaloneOf)) doc.baseGame = reference(gameId(game.standaloneOf), "game")

    if (game.players) {
      doc.playersMin = game.players.min
      if (game.players.max !== null) doc.playersMax = game.players.max
    }
    if (game.duration !== null) doc.duration = game.duration
    if (game.age !== null) doc.minAge = game.age
    if (game.complexity !== null) doc.complexity = game.complexity
    if (game.releaseDate !== null) doc.releaseDate = game.releaseDate
    if (game.categories.length > 0) doc.categories = game.categories.map((name) => item(categoryId(name), "category"))

    const credits = creditsOf(game)
    if (credits.length > 0) doc.creators = credits.map(({ creator, roles }) => ({ _key: creator, _type: "gameCreator", creator: reference(creator, "creator"), roles }))
    if (game.publishers.length > 0) doc.publishers = game.publishers.map(({ name }) => item(publisherId(name), "publisher"))

    if (game.descriptions.en) doc.description = game.descriptions.en
    for (const { id } of LANGUAGES) {
      const link = game.rules[id]
      if (link) doc[`rules${id.charAt(0).toUpperCase()}${id.slice(1)}`] = link
    }

    const others = related.get(game.slug) ?? []
    // Weak for good, as the field is: two games are related both ways, so strong references would each wait for the other to be published
    if (others.length > 0) doc.related = others.map((slug) => item(gameId(slug), "game", true))
    return doc
  })
}
