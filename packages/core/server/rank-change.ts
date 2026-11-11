import "server-only"
import { NO_RANK_CHANGE, type RankChange } from "../lib/rank-change"
import { supabaseAdmin } from "./supabase"

/** A user of the database is a uuid. The development demo account (`id: "demo"`, in no database) is not one: it has played nothing, and asking the database for it would only be refused. */
const USER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Row = Record<string, unknown>

/** What the database embeds of a row it is joined to: one row, or a list of one. */
const joined = (value: unknown): Row => (Array.isArray(value) ? ((value[0] ?? {}) as Row) : value && typeof value === "object" ? (value as Row) : {})

/**
 * What the game that has just ended at a table did to a member's rank points. A game is told by its table (the game and the instant the table was created) and by the instant it ended (migration 0006): the member's latest game of the table
 * that ended after `startedAt`, the instant play began, since a table plays several games (a rematch begins the next one on the same table) and the answer must not be the earlier game's while the new one is not written down yet. Without
 * `startedAt` (the start was never told) it is the latest game of the table. Throws what the database says: the route that asks lets it show as an error and the end screen goes without the points.
 */
export async function readRankChange({ game, userId, tableCreatedAt, startedAt }: { game: string; userId: string; tableCreatedAt: string; startedAt: string | null }): Promise<RankChange> {
  if (!USER_ID.test(userId)) return NO_RANK_CHANGE
  const db = supabaseAdmin()
  let own = db
    .from("game_participants")
    .select("game_result_id, finished_at, game_results!inner(game, table_created_at, ranked)")
    .eq("user_id", userId)
    .eq("game_results.game", game)
    .eq("game_results.table_created_at", tableCreatedAt)
  if (startedAt) own = own.gt("finished_at", startedAt)
  const { data, error } = await own.order("finished_at", { ascending: false }).limit(1)
  if (error) throw error
  const mine = (data as Row[] | null)?.[0]
  if (!mine) return NO_RANK_CHANGE
  if (joined(mine.game_results).ranked !== true) return { recorded: true, ranked: false, points: null }
  const { data: change, error: changeError } = await db.from("rating_changes").select("points_before, points_after").eq("game_result_id", String(mine.game_result_id)).eq("user_id", userId).maybeSingle()
  if (changeError) throw changeError
  return { recorded: true, ranked: true, points: change ? Number(change.points_after) - Number(change.points_before) : null }
}

/** When play began at a table (`games.started_at`, migration 0006), null when it was never told or the project has no such column yet: the game is then the table's latest. */
export async function readStartedAt(game: string, code: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin().from("games").select("started_at").eq("game", game).eq("code", code).maybeSingle()
  if (error) return null
  return typeof data?.started_at === "string" ? data.started_at : null
}
