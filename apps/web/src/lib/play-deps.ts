import "server-only"
import { expansionsOf as expansionsOfGame } from "@pbgo/catalog"
import { ageRulesOf, getCatalog } from "@pbgo/catalog/server"
import type { PlayDeps } from "@pbgo/core/server/quick-play"
import { getPlayableGame } from "@pbgo/games"

/** The keys of the options of a game that are its helpers, as its game in the platform's Sanity project lists them: a ranked table is opened with them off. */
async function helpersOf(slug: string): Promise<readonly string[]> {
  const { entries } = await getCatalog()
  return entries.find((entry) => entry.slug === slug)?.game.helpers.map(({ key }) => key) ?? []
}

/** The slugs of the expansions of a game, as the platform's Sanity project lists them (the expansions that name the game as their base game): a search can ask a table to have the ones whose slug is the key of an option of the engine on. */
async function expansionsOf(slug: string): Promise<readonly string[]> {
  const { expansions } = await getCatalog()
  return expansionsOfGame(expansions, slug).map((expansion) => expansion.slug)
}

/** What the search of a visitor who presses Play needs of the app, which core cannot read: the games (registry), the age they ask, their helpers and their expansions (catalog). */
export const playDeps: PlayDeps = { ageRules: ageRulesOf, loadGame: getPlayableGame, helpersOf, expansionsOf }
