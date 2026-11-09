import "server-only"
import type { Rank } from "@pbgo/ui/ranks"
import type { Outcome } from "@pbgo/ui/results"
import { progressOfPoints, rankOfPoints } from "../lib/ladder"
import { supabaseAdmin } from "./supabase"

/**
 * What the pages read of the games that were recorded (PLT-13, migrations 0007 to 0009): the board of a game, where a player stands in it and the games they finished. The database answers places and rank points, never a
 * rating (a rating is hidden: it is not in any of these answers), and this file reads the points into ranks (`lib/ladder.ts`). Every function throws what the database says, so that its caller decides what a page shows then: the pages
 * of `apps/web/src/lib/game-activity.ts` draw their empty state and log it.
 */

type Row = Record<string, unknown>

/** A user of the database is a uuid. The development demo account (`id: "demo"`, in no database) is not one: it has played nothing, and asking the database for it would only be refused. */
const USER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const text = (value: unknown): string | null => (typeof value === "string" ? value : null)
const count = (value: unknown): number => (typeof value === "number" && Number.isFinite(value) ? value : Number(value) || 0)
const maybe = (value: unknown): number | null => (value === null || value === undefined ? null : count(value))

async function call(name: string, args: Record<string, unknown>): Promise<Row[]> {
  const { data, error } = await supabaseAdmin().rpc(name, args)
  if (error) throw error
  return Array.isArray(data) ? (data as Row[]) : []
}

/** One player of the board of a game, as the board shows them: where they stand and what they are called. */
export type BoardRow = { userId: string; name: string | null; avatarUrl: string | null; place: number; rank: Rank; wins: number; gamesPlayed: number }

/** The best players of a game, best first, at most `limit`: the players who have rated at least 5 games (`LEADERBOARD_MIN_GAMES` of the hub; the 5 is also in migrations 0007 and 0009). */
export async function readBoard(game: string, limit: number): Promise<BoardRow[]> {
  const rows = await call("game_standings", { p_game: game, p_limit: limit })
  return rows.map((row) => ({
    userId: String(row.user_id),
    name: text(row.display_name),
    avatarUrl: text(row.avatar_url),
    place: count(row.place),
    rank: rankOfPoints(count(row.points)),
    wins: count(row.wins),
    gamesPlayed: count(row.games_played),
  }))
}

/** Where a player stands in a game. */
export type PlayerStanding = {
  /** The games they finished, ranked or not, how many they won, and how long they spent at them (seconds): their totals (`player_stats`). */
  gamesPlayed: number
  wins: number
  secondsPlayed: number
  /** The games they rated and won (`ratings`), and the name and picture the board has of them. */
  ratedGames: number
  ratedWins: number
  name: string | null
  avatarUrl: string | null
  /** Their place on the board, null while they have rated fewer than 5 games. */
  place: number | null
  /** Their rank, read from their rank points: null before their first rated game. */
  rank: Rank | null
  /** How far they are through their division, null where no points apply: with no rank, and at the top. */
  rankProgress: { points: number; needed: number } | null
  /** How many players the board has. */
  poolSize: number
}

const NOBODY: PlayerStanding = { gamesPlayed: 0, wins: 0, secondsPlayed: 0, ratedGames: 0, ratedWins: 0, name: null, avatarUrl: null, place: null, rank: null, rankProgress: null, poolSize: 0 }

export async function readPlayerStanding(userId: string, game: string): Promise<PlayerStanding> {
  if (!USER_ID.test(userId)) return { ...NOBODY }
  const [row] = await call("player_standing", { p_user: userId, p_game: game })
  const points = maybe(row?.points)
  const place = maybe(row?.place)
  return {
    gamesPlayed: count(row?.games_played),
    wins: count(row?.wins),
    secondsPlayed: count(row?.seconds_played),
    ratedGames: count(row?.rated_games),
    ratedWins: count(row?.rated_wins),
    name: text(row?.display_name),
    avatarUrl: text(row?.avatar_url),
    place,
    rank: points === null ? null : rankOfPoints(points),
    rankProgress: points === null ? null : progressOfPoints(points),
    poolSize: count(row?.pool_size),
  }
}

/** A game a player finished, as the database tells it. */
export type HistoryRow = {
  /** The id of the game's result, which stands for the game. */
  id: string
  finishedAt: string
  outcome: Outcome
  /** Where they came (1 first, ties share a place), null where the engine ranked nobody. */
  place: number | null
  score: number | null
  playerCount: number
  durationSeconds: number | null
  /** The options it was played with, expansions included. */
  options: Record<string, unknown>
  /** The rank points it gave (+) or took (-), null for a game that was not rated. */
  points: number | null
  /** The others at the table, by seat: the name and picture their seat had, null once the account is gone. */
  opponents: { name: string | null; avatarUrl: string | null }[]
}

export async function readHistory(userId: string, game: string, limit: number): Promise<HistoryRow[]> {
  if (!USER_ID.test(userId)) return []
  const rows = await call("player_history", { p_user: userId, p_game: game, p_limit: limit })
  return rows.map((row) => ({
    id: String(row.id),
    finishedAt: String(row.finished_at),
    outcome: String(row.outcome) as Outcome,
    place: maybe(row.place),
    score: maybe(row.score),
    playerCount: count(row.player_count),
    durationSeconds: maybe(row.duration_s),
    options: row.options && typeof row.options === "object" ? (row.options as Record<string, unknown>) : {},
    points: maybe(row.points),
    opponents: Array.isArray(row.opponents) ? (row.opponents as Row[]).map((opponent) => ({ name: text(opponent.name), avatarUrl: text(opponent.avatarUrl) })) : [],
  }))
}

// What the pages of a member read across every game they played (`/me`, `/me/games`, the home): the games they finished, whichever the game, and the totals and the rank they have in each. A member's list is one query by their account and
// nothing is computed over the other players, so these read the tables with the server's key where the functions above call the database's own: no migration stands behind them.

/** A game a member finished, whichever the game it was: a game of their history, with its game and whether it counted for a rank. */
export type MemberGameRow = HistoryRow & { game: string; ranked: boolean }

/** The most games a read of a member's history asks for: the database answers a request with 1,000 rows at most and a game has at most 10 seats, which the read asks for as well. */
export const MEMBER_GAMES_MAX = 100

/** What the database embeds of a row it is joined to: one row, or a list of one. */
const joined = (value: unknown): Row => (Array.isArray(value) ? ((value[0] ?? {}) as Row) : value && typeof value === "object" ? (value as Row) : {})

/** The games a member finished, the latest first, at most `limit` (`MEMBER_GAMES_MAX`): how each ended for them, the rank points it gave and the others at the table, by seat. */
export async function readMemberGames(userId: string, limit: number): Promise<MemberGameRow[]> {
  if (!USER_ID.test(userId)) return []
  const db = supabaseAdmin()
  const mine = await db
    .from("game_participants")
    .select("game_result_id, seat, outcome, rank, score, finished_at, game_results!inner(game, ranked, player_count, duration_s, options)")
    .eq("user_id", userId)
    .order("finished_at", { ascending: false })
    .limit(Math.min(limit, MEMBER_GAMES_MAX))
  if (mine.error) throw mine.error
  const own = (mine.data ?? []) as Row[]
  if (own.length === 0) return []
  const ids = own.map((row) => String(row.game_result_id))
  const [seated, changes] = await Promise.all([
    db.from("game_participants").select("game_result_id, seat, display_name, avatar_url").in("game_result_id", ids),
    db.from("rating_changes").select("game_result_id, points_before, points_after").eq("user_id", userId).in("game_result_id", ids),
  ])
  if (seated.error) throw seated.error
  if (changes.error) throw changes.error

  const points = new Map<string, number>()
  for (const row of (changes.data ?? []) as Row[]) points.set(String(row.game_result_id), count(row.points_after) - count(row.points_before))
  const seats = new Map<string, { seat: number; name: string | null; avatarUrl: string | null }[]>()
  for (const row of (seated.data ?? []) as Row[]) {
    const id = String(row.game_result_id)
    seats.set(id, [...(seats.get(id) ?? []), { seat: count(row.seat), name: text(row.display_name), avatarUrl: text(row.avatar_url) }])
  }

  return own.map((row) => {
    const id = String(row.game_result_id)
    const result = joined(row.game_results)
    return {
      id,
      game: String(result.game),
      ranked: result.ranked === true,
      finishedAt: String(row.finished_at),
      outcome: String(row.outcome) as Outcome,
      place: maybe(row.rank),
      score: maybe(row.score),
      playerCount: count(result.player_count),
      durationSeconds: maybe(result.duration_s),
      options: result.options && typeof result.options === "object" ? (result.options as Record<string, unknown>) : {},
      points: points.get(id) ?? null,
      opponents: (seats.get(id) ?? [])
        .filter((seat) => seat.seat !== count(row.seat))
        .sort((a, b) => a.seat - b.seat)
        .map(({ name, avatarUrl }) => ({ name, avatarUrl })),
    }
  })
}

/** What a member has done in a game: their totals (`player_stats`) and, once they have rated a game, the rank their points read as. */
export type MemberGameTotals = {
  game: string
  /** The games they finished, ranked or not, and how many they won (a game won together counts). */
  gamesPlayed: number
  wins: number
  secondsPlayed: number
  /** Their rank points (`ratings.points`) and the games they rated: null and 0 before their first rated game. */
  points: number | null
  ratedGames: number
  /** Their rank, read from their points, and how far they are through its division: null with no points, and no progress at the top. */
  rank: Rank | null
  rankProgress: { points: number; needed: number } | null
}

/** A member's totals in each game they have played, in no particular order. */
export async function readMemberTotals(userId: string): Promise<MemberGameTotals[]> {
  if (!USER_ID.test(userId)) return []
  const db = supabaseAdmin()
  const [stats, ratings] = await Promise.all([
    db.from("player_stats").select("game, games_played, wins, coop_wins, seconds_played").eq("user_id", userId),
    db.from("ratings").select("game, points, games_played").eq("user_id", userId),
  ])
  if (stats.error) throw stats.error
  if (ratings.error) throw ratings.error
  const played = new Map(((stats.data ?? []) as Row[]).map((row) => [String(row.game), row]))
  const rated = new Map(((ratings.data ?? []) as Row[]).map((row) => [String(row.game), row]))
  return [...new Set([...played.keys(), ...rated.keys()])].map((game) => {
    const totals = played.get(game)
    const points = maybe(rated.get(game)?.points)
    return {
      game,
      gamesPlayed: count(totals?.games_played),
      wins: count(totals?.wins) + count(totals?.coop_wins),
      secondsPlayed: count(totals?.seconds_played),
      points,
      ratedGames: count(rated.get(game)?.games_played),
      rank: points === null ? null : rankOfPoints(points),
      rankProgress: points === null ? null : progressOfPoints(points),
    }
  })
}
