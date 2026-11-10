import "server-only"
import { getCatalog } from "@pbgo/catalog/server"
import { getPlayableGame } from "@pbgo/games"
import type { TableEntryProps } from "@pbgo/ui/platform/table-entry"
import { playerRange } from "@pbgo/ui/tables"
import { getExpansions, getPublicTables } from "./game-activity"
import { tableEntryProps } from "./game-activity-props"

/** A public table as a row of a list that spans games (the Tables tab, the home): which game it is, who hosts it, and the row that draws it, leading to the table's page. */
export type PublicTableRow = {
  /** `<slug>:<code>`: the same table has the same id wherever it is listed. */
  id: string
  game: string
  gameName: string
  /** The name of the host, for a search to look at. */
  host: string
  entry: Omit<TableEntryProps, "selected" | "onSelect" | "controls">
}

/**
 * The public tables of every game that can be played, the newest first, as rows (PLT-21). A row says which game it is before anything else, then what the table asks and is played with, and leads to the table's page (`/game/<slug>/<code>`), where the
 * table is picked in the game's list and the visitor sits down. `exclude` leaves out tables by their id (`<slug>:<code>`): the home lists the member's own apart. A game can be played where its page lets a table be opened: a live game, and, outside production,
 * any game that has an engine. A project where migration 0014 is not applied yet has none.
 */
export async function publicTableRows({ limit, exclude = new Set<string>() }: { limit?: number; exclude?: ReadonlySet<string> } = {}): Promise<PublicTableRow[]> {
  const { entries } = await getCatalog()
  const playable = new Map<string, (typeof entries)[number]>()
  for (const entry of entries) {
    if (entry.live || (process.env.VERCEL_ENV !== "production" && (await getPlayableGame(entry.slug)) !== null)) playable.set(entry.slug, entry)
  }
  const tables = await getPublicTables((slug) => {
    const entry = playable.get(slug)
    return entry ? playerRange(entry.game.players?.min ?? null, entry.game.players?.max ?? null).max : null
  }, limit)
  const expansions = new Map(await Promise.all([...new Set(tables.map((table) => table.game))].map(async (slug) => [slug, await getExpansions(slug)] as const)))
  return tables.flatMap((table): PublicTableRow[] => {
    const id = `${table.game}:${table.code}`
    const entry = playable.get(table.game)
    if (!entry || exclude.has(id)) return []
    const row = tableEntryProps(table, table.game, undefined, expansions.get(table.game) ?? [], false)
    const host = table.players.find((player) => player.playerId === table.hostId)?.name ?? ""
    return [{ id, game: table.game, gameName: entry.game.name, host, entry: { ...row, facts: [entry.game.name, ...(row.facts ?? [])], to: `/game/${table.game}/${table.code}` } }]
  })
}
