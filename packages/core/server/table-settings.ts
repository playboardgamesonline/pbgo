import "server-only"
import { cookies, headers } from "next/headers"
import { LANGUAGE_COOKIE, resolveLanguage } from "@pbgo/accounts/language"
import { getAccount } from "@pbgo/accounts/server"
import { parseTableSettings, tierOf, type TableSettings, type Viewer } from "../lib/table-settings"
import { isMissingColumn } from "./db-error"
import { readPlayerStanding } from "./standings"
import { supabaseAdmin } from "./supabase"

/**
 * What the server knows of the settings of a table (PLT-21, phase B, `games.settings`, migration 0014). They are read apart from the table (`COLUMNS` of `games.ts` does not have the column), so that a project where the migration is not applied yet keeps
 * opening, joining and playing tables exactly as before: a read that cannot find the column finds no settings, which is a private table of the game's own speed and seats. Never throws: a failure is logged and the table has none.
 */

/** The settings of one table. */
export async function readTableSettingsOf(game: string, code: string): Promise<TableSettings> {
  try {
    const { data, error } = await supabaseAdmin().from("games").select("settings").eq("game", game).eq("code", code).maybeSingle()
    if (error) {
      if (!isMissingColumn(error)) console.error("The settings of a table could not be read", { game }, error.code, error.message)
      return {}
    }
    return parseTableSettings((data as { settings?: unknown } | null)?.settings)
  } catch (error) {
    console.error("The settings of a table could not be read", { game }, error instanceof Error ? error.message : error)
    return {}
  }
}

/** The settings of several tables of one game, by code: a table that has none, or that cannot be read, is not in the map. */
export async function readTableSettings(game: string, codes: readonly string[]): Promise<Map<string, TableSettings>> {
  const found = new Map<string, TableSettings>()
  if (codes.length === 0) return found
  try {
    const { data, error } = await supabaseAdmin().from("games").select("code, settings").eq("game", game).in("code", [...codes])
    if (error) {
      if (!isMissingColumn(error)) console.error("The settings of some tables could not be read", { game }, error.code, error.message)
      return found
    }
    for (const row of (data ?? []) as Array<{ code: string; settings?: unknown }>) found.set(row.code, parseTableSettings(row.settings))
  } catch (error) {
    console.error("The settings of some tables could not be read", { game }, error instanceof Error ? error.message : error)
  }
  return found
}

/** The language of the platform that the visitor uses: their account's, else the cookie's, else their browser's (`resolveLanguage`). */
export async function visitorLanguage() {
  const [account, store, requestHeaders] = await Promise.all([getAccount(), cookies(), headers()])
  return resolveLanguage({ account: account?.language ?? null, cookie: store.get(LANGUAGE_COOKIE)?.value, browser: requestHeaders.get("accept-language") })
}

/**
 * Who sits down, as far as the criteria of a table go: their tier in the game (the lowest for a guest and for a member who never played it ranked) and their language. Only what the table asks for is looked up, so that a table that asks for
 * nothing costs nothing: the rank is read from the standings of the member, the language from the request.
 */
export async function viewerFor(game: string, memberId: string | null, settings: TableSettings): Promise<Viewer> {
  const [standing, language] = await Promise.all([
    settings.minRank !== undefined && memberId ? readPlayerStanding(memberId, game) : null,
    settings.language !== undefined ? visitorLanguage() : null,
  ])
  // A language the table does not ask for is not looked at: any value does
  return { tier: tierOf(standing?.rank), language: language ?? "en" }
}
