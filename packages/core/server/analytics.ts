import "server-only"
import type { ServerEvents } from "@pbgo/analytics"
import { track } from "@pbgo/analytics/server"
import { after } from "next/server"
import type { GameRow } from "./games"

/**
 * Sends a game event from the server once the response has left (`after`), so statistics never slow a request down. Call it
 * after the write the event describes, never from the modifier of `updateGame`, which runs again when it loses a race.
 *
 * - `distinctId` is the player's id of this game, the random value of their `<slug>_player` cookie. Nothing more is stored on
 *   their device for it, and the events carry no name, no chat text and no table code. Without a player, nothing is sent.
 * - Never throws: a callback that cannot be scheduled is logged and the game goes on. Without a PostHog configuration `track`
 *   does nothing.
 */
export function trackAfter<E extends keyof ServerEvents>(event: E, distinctId: string | null, properties: ServerEvents[E]): void {
  if (!distinctId) return
  try {
    after(() => track(event, distinctId, properties))
  } catch (error) {
    console.error(`[analytics] could not schedule ${event}`, error instanceof Error ? error.message : error)
  }
}

/**
 * What `game_finished` says about a table that has just reached `over`. Both numbers are approximations, flagged as such: a table
 * stores no start date and no move counter, so the duration is the time since the table was created (`created_at` survives the
 * rematches, so it also counts the lobby and the earlier rounds) and the moves are `version`, which every write bumps (joins,
 * options and votes too). A precise value needs columns. The duration is left out when the row has no usable dates.
 */
export function gameFinishedProperties(
  slug: string,
  row: Pick<GameRow, "players" | "version" | "created_at" | "updated_at">,
): ServerEvents["game_finished"] {
  const seconds = Math.round((Date.parse(row.updated_at ?? "") - Date.parse(row.created_at ?? "")) / 1000)
  return {
    game: slug,
    ...(Number.isFinite(seconds) && seconds >= 0 ? { duration_s: seconds } : {}),
    players: row.players.length,
    moves_count: row.version,
    ended_by: "natural",
    approximate: true,
  }
}

/** `game_finished` for the player whose request ended the game (a move, or a takeover that played the last turn). */
export function trackGameFinished(slug: string, row: Parameters<typeof gameFinishedProperties>[1], distinctId: string | null): void {
  trackAfter("game_finished", distinctId, gameFinishedProperties(slug, row))
}
