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
