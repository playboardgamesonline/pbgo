import "server-only"
import type { PlayerInfo } from "@pbgo/engine-kit"
import { supabaseAdmin } from "./supabase"

type Row = { code: string; status: string; players: PlayerInfo[]; created_at: string; updated_at: string }

export type GameStats = {
  total: number
  last24h: number
  last7d: number
  last30d: number
  active: number
  openLobbies: number
  finished30d: number
  started30d: number
  uniquePlayers30d: number
  uniquePlayers7d: number
  avgPlayers: number
  perDay: { date: string; games: number; players: number }[]
  recent: { code: string; status: string; players: number; createdAt: string; updatedAt: string }[]
}

const HOUR = 3600_000
const DAY = 24 * HOUR

/** Tables of one game (`slug`) for the Monitoring › Games page. */
export async function loadGameStats(slug: string): Promise<GameStats> {
  const db = supabaseAdmin()
  const now = Date.now()
  const iso = (ms: number) => new Date(now - ms).toISOString()
  const games = () => db.from("games")
  const count = () => games().select("code", { count: "exact", head: true }).eq("game", slug)
  const [total, active, lobbies, window] = await Promise.all([
    count(),
    count().eq("status", "playing").gte("updated_at", iso(2 * HOUR)),
    count().eq("status", "lobby").gte("updated_at", iso(HOUR)),
    games().select("code, status, players, created_at, updated_at").eq("game", slug).gte("created_at", iso(30 * DAY)).order("created_at", { ascending: false }).limit(5000),
  ])
  for (const r of [total, active, lobbies, window]) if (r.error) throw r.error
  const rows = (window.data ?? []) as Row[]
  const since = (ms: number) => rows.filter((r) => Date.parse(r.created_at) >= now - ms)
  const unique = (list: Row[]) => new Set(list.flatMap((r) => r.players.map((p) => p.id))).size
  const started = rows.filter((r) => r.status !== "lobby")

  const perDay = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(now - (13 - i) * DAY)
    const date = d.toISOString().slice(0, 10)
    const day = rows.filter((r) => r.created_at.slice(0, 10) === date)
    return { date, games: day.length, players: unique(day) }
  })

  return {
    total: total.count ?? 0,
    last24h: since(DAY).length,
    last7d: since(7 * DAY).length,
    last30d: rows.length,
    active: active.count ?? 0,
    openLobbies: lobbies.count ?? 0,
    finished30d: rows.filter((r) => r.status === "over").length,
    started30d: started.length,
    uniquePlayers30d: unique(rows),
    uniquePlayers7d: unique(since(7 * DAY)),
    avgPlayers: started.length ? started.reduce((t, r) => t + r.players.length, 0) / started.length : 0,
    perDay,
    recent: rows.slice(0, 8).map((r) => ({ code: r.code, status: r.status, players: r.players.length, createdAt: r.created_at, updatedAt: r.updated_at })),
  }
}

/**
 * How many players the platform has had, every game together, for the figure under the title of the home: the SQL function `player_count()` (migration `0003_player_count.sql`)
 * counts the ids of the `players` of every table, once per game. It throws when it cannot count (no Supabase here, or the migration is not applied yet): the page decides what it shows then.
 */
export async function loadPlayerCount(): Promise<number> {
  const { data, error } = await supabaseAdmin().rpc("player_count")
  if (error) throw error
  // A bigint comes as a number, or as a string past what a number holds; nothing, or an empty answer, is not a zero
  const count = typeof data === "number" || (typeof data === "string" && data.trim() !== "") ? Number(data) : Number.NaN
  if (!Number.isFinite(count) || count < 0) throw new Error(`player_count() answered ${JSON.stringify(data)}`)
  return count
}
