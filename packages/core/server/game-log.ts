import "server-only"
import { viewLog, type LogEntry } from "@pbgo/engine-kit"
import type { LogLine } from "../lib/game-types"
import { supabaseAdmin } from "./supabase"

/**
 * The log of a table (`game_log`, migration 0016): what happened in its game, kept apart from the state (PLT-45). A game that says what its moves did (`GameDefinition.step`) hands the server the entries of each move; the server writes them
 * with the move, in the same order for everybody, and sends each player the lines `viewLog` lets them read (`PublicGame.log`). Nothing here is needed to play: a log that cannot be written or read (the migration is not applied to this project yet,
 * the database hiccups) leaves the game going and its history short.
 */

/** The most lines of the log that a player is sent: the history on the screen and what a board plays are the last of them. */
export const LOG_TAIL = 60

/** What a move adds to the log of its table. `reset` empties it first: a new game on the same table starts a new log. */
export type LogWrite = { entries?: readonly LogEntry<unknown>[]; reset?: boolean }

/** The entries that one move said, as they are kept: `version` is the version of the table that the move produced. */
export type LoggedStep = { version: number; entries: readonly LogEntry<unknown>[] }

/** The table is not there: the migration is not applied to this project yet. Not worth a line in the logs on every request. */
const isMissingTable = (error: unknown) => typeof error === "object" && error !== null && "code" in error && (error.code === "PGRST205" || error.code === "42P01")

/**
 * Writes what a move said into the log of its table: `version` is the version of the table that the move produced (`games.version`), which orders the log. Called by `updateGame` once the move is written, before the others are told.
 * It never throws: a move that was played stays played.
 */
export async function writeLog(slug: string, code: string, version: number, log: LogWrite): Promise<void> {
  try {
    const db = supabaseAdmin()
    if (log.reset) {
      const { error } = await db.from("game_log").delete().eq("game", slug).eq("code", code)
      if (error) throw error
    }
    if (log.entries?.length) {
      const { error } = await db.from("game_log").insert({ game: slug, code, version, entries: log.entries })
      if (error) throw error
    }
  } catch (error) {
    if (!isMissingTable(error)) console.error("Game log write failed", error)
  }
}

/** The last moves of the log of a table, oldest first, with all they said. Empty when there is none or when the log cannot be read. */
export async function readLog(slug: string, code: string): Promise<LoggedStep[]> {
  try {
    const { data, error } = await supabaseAdmin().from("game_log").select("version, entries").eq("game", slug).eq("code", code).order("version", { ascending: false }).limit(LOG_TAIL)
    if (error) throw error
    return ((data ?? []) as LoggedStep[]).reverse()
  } catch (error) {
    if (!isMissingTable(error)) console.error("Game log read failed", error)
    return []
  }
}

/**
 * The log as `viewerId` reads it (`null`: somebody who is not at the table): the lines of each move, oldest first, each with the version of the table that its move produced, at most `LOG_TAIL` of them. What a viewer may not read is left out
 * or masked by `viewLog`, so the versions of the lines a viewer gets can skip some.
 */
export function viewLogged(steps: readonly LoggedStep[], viewerId: string | null): LogLine[] {
  const lines = steps.flatMap(({ version, entries }) => viewLog(entries, viewerId).map((event) => ({ v: version, event })))
  return lines.slice(-LOG_TAIL)
}
