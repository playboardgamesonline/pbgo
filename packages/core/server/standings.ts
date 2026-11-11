import "server-only"
import type { Handle } from "@pbgo/accounts"
import type { Rank } from "@pbgo/ui/ranks"
import type { Outcome } from "@pbgo/ui/results"
import { PACES, type Pace, type PlayerRecord } from "@pbgo/ui/tables"
import { progressOfPoints, rankOfPoints } from "../lib/ladder"
import { isMissingColumn } from "./db-error"
import { handleOf, readProfiles, type ProfileRecord } from "./profiles"
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
/** The speed a game was played at, as its result keeps it (`game_results.pace`, migration 0022): a result that does not say was played at the normal one, as every game was until a table could be given another. */
const paceOf = (value: unknown): Pace => PACES.find((pace) => pace.value === value)?.value ?? "normal"

/**
 * Who sat in a seat, as the history and the board draw them: what the seat had (the name and the picture it was copied with) or, while the account is still there, the account's own name and picture, with the handle that leads to its profile (PLT-39).
 * `record` is what their card says (their rank in the game and how many games of it they won): only the history of a member has it, and an account that rated nothing in the game has none.
 */
export type Seated = { name: string | null; avatarUrl: string | null; handle?: Handle; record?: PlayerRecord | null }

/**
 * The profiles of the accounts that sat in these seats, read once. A database that cannot say leaves the seats as they were, with no handle and the cause in the log: a history or a board is never refused for the links it would have had. The account's id
 * is what the lookup goes by and what no page ever sends to a browser.
 */
async function profilesOf(ids: readonly (string | null)[]): Promise<Map<string, ProfileRecord>> {
  const wanted = ids.filter((id): id is string => id !== null)
  try {
    return await readProfiles(wanted)
  } catch (error) {
    console.error("The profiles of the players of a history could not be read", error instanceof Error ? error.message : error)
    return new Map()
  }
}

/** A seat as it is drawn: the account's own name, picture and handle when it has a profile (the nickname it goes by now, not the one it had then), the seat's name and picture otherwise (a guest, an account that is gone). */
function seatedOf(seat: { userId: string | null; name: string | null; avatarUrl: string | null }, profiles: ReadonlyMap<string, ProfileRecord>): Seated {
  const profile = seat.userId ? profiles.get(seat.userId) : undefined
  return profile ? { name: profile.nickname, avatarUrl: profile.avatarUrl ?? seat.avatarUrl, handle: handleOf(profile) } : { name: seat.name, avatarUrl: seat.avatarUrl }
}

async function call(name: string, args: Record<string, unknown>): Promise<Row[]> {
  const { data, error } = await supabaseAdmin().rpc(name, args)
  if (error) throw error
  return Array.isArray(data) ? (data as Row[]) : []
}

/** One player of the board of a game, as the board shows them: where they stand and what they are called. */
export type BoardRow = { userId: string; name: string | null; avatarUrl: string | null; place: number; rank: Rank; wins: number; gamesPlayed: number; handle?: Handle }

/**
 * The best players of a game, best first, at most `limit`: the players who have rated a game (`board_min_games()` of migration 0019: the number was 5 before). A player whose account is there goes by their profile (nickname, picture, handle);
 * the name and picture of their last rated game are used for one that has none.
 */
export async function readBoard(game: string, limit: number): Promise<BoardRow[]> {
  const rows = await call("game_standings", { p_game: game, p_limit: limit })
  const profiles = await profilesOf(rows.map((row) => text(row.user_id)))
  return rows.map((row) => ({
    userId: String(row.user_id),
    ...seatedOf({ userId: text(row.user_id), name: text(row.display_name), avatarUrl: text(row.avatar_url) }, profiles),
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
  /** Their place on the board, null while they have rated no game. */
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
  /** The speed the table was set to. */
  pace: Pace
  /** The rank points it gave (+) or took (-), null for a game that was not rated. */
  points: number | null
  /** The others at the table, by seat: the name and picture their seat had, null once the account is gone; an account that is still there is named as it goes now, with its handle (`Seated`). */
  opponents: Seated[]
}

export async function readHistory(userId: string, game: string, limit: number): Promise<HistoryRow[]> {
  if (!USER_ID.test(userId)) return []
  const rows = await call("player_history", { p_user: userId, p_game: game, p_limit: limit })
  const seatsOf = (row: Row): Row[] => (Array.isArray(row.opponents) ? (row.opponents as Row[]) : [])
  const profiles = await profilesOf(rows.flatMap((row) => seatsOf(row).map((seat) => text(seat.userId))))
  return rows.map((row) => ({
    id: String(row.id),
    finishedAt: String(row.finished_at),
    outcome: String(row.outcome) as Outcome,
    place: maybe(row.place),
    score: maybe(row.score),
    playerCount: count(row.player_count),
    durationSeconds: maybe(row.duration_s),
    options: row.options && typeof row.options === "object" ? (row.options as Record<string, unknown>) : {},
    pace: paceOf(row.pace),
    points: maybe(row.points),
    opponents: seatsOf(row).map((seat) => seatedOf({ userId: text(seat.userId), name: text(seat.name), avatarUrl: text(seat.avatarUrl) }, profiles)),
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

/**
 * What a card says of each player of a history: their rank in the game and how many games of it they won (`player_stats`, `ratings`), read for every opponent of every game at once, by `user_id:game`. A player with no rating in the game has no record, as a
 * guest has none. A database that cannot say leaves the cards without one and the cause in the log: a history is never refused for it.
 */
async function recordsOf(userIds: readonly string[], games: readonly string[]): Promise<Map<string, PlayerRecord>> {
  const records = new Map<string, PlayerRecord>()
  if (userIds.length === 0 || games.length === 0) return records
  try {
    const db = supabaseAdmin()
    const [stats, ratings] = await Promise.all([
      db.from("player_stats").select("user_id, game, games_played, wins, coop_wins").in("user_id", [...userIds]).in("game", [...games]),
      db.from("ratings").select("user_id, game, points").in("user_id", [...userIds]).in("game", [...games]),
    ])
    if (stats.error) throw stats.error
    if (ratings.error) throw ratings.error
    const played = new Map(((stats.data ?? []) as Row[]).map((row) => [`${row.user_id}:${row.game}`, row]))
    for (const row of (ratings.data ?? []) as Row[]) {
      const key = `${row.user_id}:${row.game}`
      const totals = played.get(key)
      records.set(key, { rank: rankOfPoints(count(row.points)), gamesPlayed: count(totals?.games_played), wins: count(totals?.wins) + count(totals?.coop_wins) })
    }
  } catch (error) {
    console.error("The records of the players of a history could not be read", error instanceof Error ? error.message : error)
  }
  return records
}

/** The games a member finished, the latest first, at most `limit` (`MEMBER_GAMES_MAX`): how each ended for them, the rank points it gave, the speed it was played at and the others at the table, by seat, each with their record in the game. */
export async function readMemberGames(userId: string, limit: number): Promise<MemberGameRow[]> {
  if (!USER_ID.test(userId)) return []
  const db = supabaseAdmin()
  const ask = async (withPace: boolean): Promise<{ data: Row[] | null; error: { code?: string } | null }> => {
    const { data, error } = await db
      .from("game_participants")
      .select(`game_result_id, seat, outcome, rank, score, finished_at, game_results!inner(game, ranked, player_count, duration_s, options${withPace ? ", pace" : ""})`)
      .eq("user_id", userId)
      .order("finished_at", { ascending: false })
      .limit(Math.min(limit, MEMBER_GAMES_MAX))
    return { data: data as Row[] | null, error }
  }
  let mine = await ask(true)
  // A project where migration 0022 is not applied yet has no speed to read: every game was played at the normal one
  if (isMissingColumn(mine.error)) mine = await ask(false)
  if (mine.error) throw mine.error
  const own = mine.data ?? []
  if (own.length === 0) return []
  const ids = own.map((row) => String(row.game_result_id))
  const [seated, changes] = await Promise.all([
    db.from("game_participants").select("game_result_id, seat, user_id, display_name, avatar_url").in("game_result_id", ids),
    db.from("rating_changes").select("game_result_id, points_before, points_after").eq("user_id", userId).in("game_result_id", ids),
  ])
  if (seated.error) throw seated.error
  if (changes.error) throw changes.error

  const points = new Map<string, number>()
  for (const row of (changes.data ?? []) as Row[]) points.set(String(row.game_result_id), count(row.points_after) - count(row.points_before))
  const seats = new Map<string, { seat: number; userId: string | null; name: string | null; avatarUrl: string | null }[]>()
  for (const row of (seated.data ?? []) as Row[]) {
    const id = String(row.game_result_id)
    seats.set(id, [...(seats.get(id) ?? []), { seat: count(row.seat), userId: text(row.user_id), name: text(row.display_name), avatarUrl: text(row.avatar_url) }])
  }
  const opponents = [...new Set([...seats.values()].flatMap((list) => list.flatMap((seat) => (seat.userId && seat.userId !== userId ? [seat.userId] : []))))]
  const [profiles, records] = await Promise.all([profilesOf([...seats.values()].flatMap((list) => list.map((seat) => seat.userId))), recordsOf(opponents, [...new Set(own.map((row) => String(joined(row.game_results).game)))])])

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
      pace: paceOf(result.pace),
      points: points.get(id) ?? null,
      opponents: (seats.get(id) ?? [])
        .filter((seat) => seat.seat !== count(row.seat))
        .sort((a, b) => a.seat - b.seat)
        .map((seat) => ({ ...seatedOf(seat, profiles), record: seat.userId ? (records.get(`${seat.userId}:${String(result.game)}`) ?? null) : null })),
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
