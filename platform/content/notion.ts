import { GAMES } from "@pbgo/games/registry"
import { hubOrder } from "./notion/order.ts"
import { readNotionGames, readPublishers } from "./notion/reader.ts"
import type { NotionReadOptions, PublisherRow } from "./notion/reader.ts"
import type { NotionGame } from "./notion/types.ts"

// What the seed and its picture step read of Notion: the rows the hub listed when the seed numbered them, in that order.

/** The token of the Notion integration, from the environment: the scripts of package.json fill it from `apps/web/.env.local`. It is never printed. */
export function notionOptions(env: Record<string, string | undefined> = process.env): NotionReadOptions {
  const token = env.NOTION_API_KEY?.trim()
  if (!token) throw new Error("NOTION_API_KEY is not set (looked in the environment and in apps/web/.env.local)")
  // No cache: the link of an uploaded picture expires after about an hour, and the rows are read to be copied
  return { token, init: { cache: "no-store" }, timeoutMs: 20_000 }
}

export type NotionSource = {
  /** The games in the order the hub listed them: the live games of the registry, then the others as the hub sorted the games to come. */
  games: NotionGame[]
  /** Every row of the Editors database. */
  publishers: PublisherRow[]
  /** What is worth telling of the read: the rows that cannot be games (with why), the expansions left out, what Notion could not give. */
  notes: string[]
}

/** The games (`hubOrder` with the registry's live games), and the publishers' rows. */
export async function readSource(options: NotionReadOptions): Promise<NotionSource> {
  const read = await readNotionGames(options)
  const publishers = await readPublishers(options)
  const notes = [
    `Notion: ${read.games.length} games, ${read.expansions} expansions left out, ${read.skipped.length} row(s) skipped, ${publishers.length} publishers.`,
    ...read.skipped.map((row) => `  skipped ${row.name || row.id}: ${row.reason}`),
    ...read.warnings.map((warning) => `  warning: ${warning}`),
  ]
  const live = GAMES.filter((game) => game.live).map((game) => game.slug)
  return { games: hubOrder(live, read.games), publishers, notes }
}
