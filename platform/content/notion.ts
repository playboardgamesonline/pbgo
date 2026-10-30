import { buildCatalog } from "@pbgo/catalog"
import type { NotionGame } from "@pbgo/catalog"
import { readNotionGames, readPublishers } from "@pbgo/catalog/notion"
import type { NotionReadOptions, PublisherRow } from "@pbgo/catalog/notion"
import { GAMES } from "@pbgo/games/registry"

// What the seed and its picture step read of Notion: the rows the hub lists today, in the order it lists them.

/** The token of the Notion integration, from the environment: the scripts of package.json fill it from `apps/web/.env.local`. It is never printed. */
export function notionOptions(env: Record<string, string | undefined> = process.env): NotionReadOptions {
  const token = env.NOTION_API_KEY?.trim()
  if (!token) throw new Error("NOTION_API_KEY is not set (looked in the environment and in apps/web/.env.local)")
  // No cache: the link of an uploaded picture expires after about an hour, and the rows are read to be copied
  return { token, init: { cache: "no-store" }, timeoutMs: 20_000 }
}

export type NotionSource = {
  /** The games of the catalog in the order of the hub: the live games of the registry, then the others as the hub sorts them. */
  games: NotionGame[]
  /** Every row of the Editors database. */
  publishers: PublisherRow[]
  /** What is worth telling of the read: the rows that cannot be games (with why), the expansions left out, what Notion could not give. */
  notes: string[]
}

/** The games the hub lists (`buildCatalog` with the registry), and the publishers' rows. */
export async function readSource(options: NotionReadOptions): Promise<NotionSource> {
  const read = await readNotionGames(options)
  const publishers = await readPublishers(options)
  const notes = [
    `Notion: ${read.games.length} games, ${read.expansions} expansions left out, ${read.skipped.length} row(s) skipped, ${publishers.length} publishers.`,
    ...read.skipped.map((row) => `  skipped ${row.name || row.id}: ${row.reason}`),
    ...read.warnings.map((warning) => `  warning: ${warning}`),
  ]
  return { games: buildCatalog(GAMES, read.games).map((entry) => entry.game), publishers, notes }
}
