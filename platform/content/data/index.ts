import type { SeedDoc } from "@pbgo/content-kit"
import type { ArtSlot } from "@pbgo/content-kit"
import type { NotionGame } from "@pbgo/catalog"
import type { PublisherRow } from "@pbgo/catalog/notion"
import { buildSlots } from "./art.ts"
import { buildGames } from "./games.ts"
import { buildCategories, buildCreators, buildPublishers } from "./taxonomy.ts"

/** What the seed is made from: the games of the catalog, and the rows of the Editors database. */
export type SeedSource = {
  /** The games of the catalog in the order the hub lists them: the first one gets the lowest `order`. */
  games: readonly NotionGame[]
  /** Every row of the Editors database: a publisher's logo is told from there. */
  publishers: readonly PublisherRow[]
}

/**
 * Every document the platform seed manages, as fresh objects (a run clones and completes them), and the art slots they have: the
 * people, publishers and categories the games point at, then the games. The editorial documents have no seed: they are written in the Studio.
 */
export function buildSeedContent({ games, publishers }: SeedSource): { docs: SeedDoc[]; slots: ArtSlot[] } {
  return {
    docs: [...buildCreators(games), ...buildPublishers(games), ...buildCategories(games), ...buildGames(games)],
    slots: buildSlots(games, publishers),
  }
}
