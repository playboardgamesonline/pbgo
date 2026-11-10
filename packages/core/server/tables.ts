import "server-only"
import type { OptionValues } from "@pbgo/engine-kit"
import type { GameEntry } from "../lib/binding"
import type { GameStatus, PublicPlayer } from "../lib/game-types"
import { parseTableSettings, type TableSettings } from "../lib/table-settings"
import { isMissingColumn, isMissingFunction } from "./db-error"
import { TABLE_IDLE_MS } from "./games"
import { supabaseAdmin } from "./supabase"

/**
 * What the platform knows of the tables a member sits at, across the games (PLT-120). A table is a row of `games` and its seats are the player ids of each game's cookie; the account that holds a seat is recorded apart (`games.member_ids`,
 * migration 0005), so the question "which tables is this account at" and the question "is this seat in a game somewhere else" are answered by the database (`member_tables` and `busy_seats`, migration 0013), not by the browser.
 * A table counts while it is a lobby, starting or being played and was written in the last `TABLE_IDLE_MS`; a seat that left does not count (`server/table-rules.ts`).
 */

/** A table of a member: not over, with the people who sit at it as the table shows them. */
export type MemberTable = {
  /** The slug of the game */
  game: string
  code: string
  status: Exclude<GameStatus, "over">
  hostId: string
  players: PublicPlayer[]
  options: OptionValues
  /** The seat the member holds at it: one of the `players`, who they are among the people at the table */
  seat: string
  createdAt: string
  updatedAt: string
}

type MemberTableRow = {
  game: string
  code: string
  status: MemberTable["status"]
  host_id: string
  players: PublicPlayer[] | null
  options: OptionValues | null
  seat: string
  created_at: string
  updated_at: string
}

/** The idle time as the database reads it (an interval). It is given every time, so that the one in `TABLE_IDLE_MS` is the only one. */
const IDLE = `${Math.round(TABLE_IDLE_MS / 1000)} seconds`

/**
 * The tables the member sits at, the one written last first. Throws what the database says (a project where migration 0013 is not applied yet has no such function): the page that asks decides what to do without them.
 */
export async function readMemberTables(userId: string): Promise<MemberTable[]> {
  const { data, error } = await supabaseAdmin().rpc("member_tables", { p_user: userId, p_idle: IDLE })
  if (error) throw error
  return ((data ?? []) as MemberTableRow[]).map((row) => ({
    game: row.game,
    code: row.code,
    status: row.status,
    hostId: row.host_id,
    players: row.players ?? [],
    options: row.options ?? {},
    seat: row.seat,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }))
}

/** The table a member is taken to: the one that is in its ready check or being played, the one written last when there are several (there should be one: a table does not start while a player is in a game). Null when there is none. */
export const activeTable = (tables: readonly MemberTable[]): MemberTable | null => tables.find((table) => table.status === "starting" || table.status === "playing") ?? null

/** Whether the member has a table that may begin any moment: a lobby, or a table in its ready check. Their browser then asks sooner where it should be (`BEAT_SOON_MS`). */
export const hasTableToWatch = (tables: readonly MemberTable[]): boolean => tables.some((table) => table.status === "lobby" || table.status === "starting")

/**
 * The seats of a table that are in a game somewhere else, whose table therefore does not start (`PLAYER_BUSY`). Never throws: a rule that cannot be checked lets the table start, and a project where migration 0013 is not applied
 * yet keeps starting tables, as the recorder and the presence do. A failure is logged.
 */
export async function busySeats(game: Pick<GameEntry, "slug">, code: string): Promise<string[]> {
  try {
    const { data, error } = await supabaseAdmin().rpc("busy_seats", { p_game: game.slug, p_code: code, p_idle: IDLE })
    if (error) {
      console.error("The busy seats of a table could not be read", { game: game.slug }, error.code, error.message)
      return []
    }
    return Array.isArray(data) ? data.filter((seat): seat is string => typeof seat === "string") : []
  } catch (error) {
    console.error("The busy seats of a table could not be read", { game: game.slug }, error instanceof Error ? error.message : error)
    return []
  }
}

/** A public lobby: a table that waits for players and that its host listed (PLT-21, phase B), with the people who sit at it and what the host set. */
export type PublicTable = {
  /** The slug of the game */
  game: string
  code: string
  hostId: string
  players: PublicPlayer[]
  options: OptionValues
  settings: TableSettings
  createdAt: string
  updatedAt: string
}

type PublicTableRow = {
  game: string
  code: string
  host_id: string
  players: PublicPlayer[] | null
  options: OptionValues | null
  settings: unknown
  created_at: string
  updated_at: string
}

/** How lately somebody who sits at a public lobby must have been seen for it to be listed: the page of a lobby asks the table again every few seconds (a tab in the background at least once a minute), and a lobby its people walked away from stops being offered. */
export const PUBLIC_ALIVE_MS = 3 * 60 * 1000

const ALIVE = `${Math.round(PUBLIC_ALIVE_MS / 1000)} seconds`

/** How many public lobbies a list holds at the most. */
export const PUBLIC_TABLES_MAX = 50

/**
 * The public lobbies of a game, or of every game when none is given, the newest first (`public_tables`, migration 0014): the tables that wait for players, that their host made public, that somebody who sits at them was seen at lately (`PUBLIC_ALIVE_MS`)
 * and that were written within `TABLE_IDLE_MS`. Never throws: a list is a convenience, and a project where the migration is not applied yet, or a database that cannot answer, lists none (a failure is logged).
 */
export async function readPublicTables(game: string | null = null, limit: number = PUBLIC_TABLES_MAX): Promise<PublicTable[]> {
  try {
    const { data, error } = await supabaseAdmin().rpc("public_tables", { p_game: game, p_alive: ALIVE, p_idle: IDLE, p_limit: limit })
    if (error) {
      if (!isMissingFunction(error) && !isMissingColumn(error)) console.error("The public tables could not be read", { game }, error.code, error.message)
      return []
    }
    return ((data ?? []) as PublicTableRow[]).map((row) => ({
      game: row.game,
      code: row.code,
      hostId: row.host_id,
      players: row.players ?? [],
      options: row.options ?? {},
      settings: parseTableSettings(row.settings),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))
  } catch (error) {
    console.error("The public tables could not be read", { game }, error instanceof Error ? error.message : error)
    return []
  }
}
