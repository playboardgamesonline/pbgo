import "server-only"
import type { CatalogEntry } from "@pbgo/catalog"
import { gameCardArt } from "@pbgo/core/sanity/cover"
import type { GameCardProps } from "@pbgo/ui/platform/game-card"
import { gameCardProps, plannedCardProps } from "./game-card-props"

/**
 * Props of the hub's `GameCard` for an entry of the catalog, live or to come: the one place that tells the two apart, for the list on
 * the home and the related games on a game's page. A live game's logo and background are read from its Sanity project (cached for
 * 60 s); a game to come has them from the catalog's picture route, so nothing is read for it.
 */
export async function catalogCardProps(entry: CatalogEntry): Promise<GameCardProps> {
  return entry.live ? gameCardProps(entry.game, await gameCardArt(entry.game)) : plannedCardProps(entry.game)
}
