import type { SeedDoc } from "@pbgo/content-kit"
import type { ArtSlot } from "@pbgo/content-kit"
import type { NotionExpansion, NotionGame } from "../notion/types.ts"
import type { PublisherRow } from "../notion/reader.ts"
import { buildSlots } from "./art.ts"
import { buildExpansions } from "./expansions.ts"
import { buildGames } from "./games.ts"
import { buildCategories, buildCreators, buildPublishers } from "./taxonomy.ts"
import { withEnglishRows } from "./translated.ts"

/** What the seed is made from: the games of the catalog, their expansions, and the rows of the Editors database. */
export type SeedSource = {
  /** The games of the catalog in the order the hub lists them: the first one gets the lowest `order`. */
  games: readonly NotionGame[]
  /** The expansions of those games. None for now: the reader does not give the Notion expansions yet (`NotionExpansion`), so the seed leaves them out. */
  expansions?: readonly NotionExpansion[]
  /** Every row of the Editors database: a publisher's logo is told from there. */
  publishers: readonly PublisherRow[]
}

/**
 * Every document the platform seed manages, as fresh objects (a run clones and completes them), and the art slots they have: the
 * people, publishers and categories the games and the expansions point at, then the games, then their expansions (a game is published
 * before the expansions that point at it). The editorial documents have no seed: they are written in the Studio.
 */
export function buildSeedContent({ games, expansions = [], publishers }: SeedSource): { docs: SeedDoc[]; slots: ArtSlot[] } {
  const credited = [...games, ...expansions]
  return {
    // a category, a game and an expansion have the row of English in each of their translated fields, empty where the source has nothing
    docs: [...buildCreators(credited), ...buildPublishers(credited), ...buildCategories(games), ...buildGames(games), ...buildExpansions(expansions, games)].map(withEnglishRows),
    slots: buildSlots(games, publishers, expansions),
  }
}
