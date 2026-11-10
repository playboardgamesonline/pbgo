import "server-only"
import { ageRulesOf, getCatalog } from "@pbgo/catalog/server"
import type { PlayDeps } from "@pbgo/core/server/quick-play"
import { getPlayableGame } from "@pbgo/games"

/** The keys of the options of a game that are its helpers, as its game in the platform's Sanity project lists them: a ranked table is opened with them off. */
async function helpersOf(slug: string): Promise<readonly string[]> {
  const { entries } = await getCatalog()
  return entries.find((entry) => entry.slug === slug)?.game.helpers.map(({ key }) => key) ?? []
}

/** What the search of a visitor who presses Play needs of the app, which core cannot read: the games (registry), the age they ask and their helpers (catalog). */
export const playDeps: PlayDeps = { ageRules: ageRulesOf, loadGame: getPlayableGame, helpersOf }
