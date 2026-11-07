import "server-only"
import type { GameEntry } from "../lib/binding"
import type { GameRow } from "./games"
import { supabaseAdmin } from "./supabase"
import { seenNeedsWrite } from "./takeover"

/**
 * Records that `playerId` was seen at the table just now (`games.seen`): the takeover counts as present the members seen
 * in the last 75 s, so an absent player never blocks the vote to play for another one.
 *
 * - Throttled: nothing is written while the time stored in `row.seen` is younger than `SEEN_WRITE_EVERY_MS`, so reading a table
 *   is not writing it each time. `row` is the one the caller already read.
 * - `touch_game_player` changes neither `version` nor `updated_at`: presence is not a move, it must not wake the clients up
 *   nor restart the turn's inactivity clock.
 * - Never throws: presence is a convenience, a failure is logged and the request goes on. Call it from `after()` of `next/server`.
 * - Ignores whoever is not a member of the table (spectators, a stale cookie).
 */
export async function markSeen(
  game: Pick<GameEntry, "slug">,
  row: Pick<GameRow, "code" | "players" | "seen">,
  playerId: string | null,
  now = Date.now(),
): Promise<void> {
  if (!playerId || !row.players.some((player) => player.id === playerId)) return
  if (!seenNeedsWrite(row.seen?.[playerId], now)) return
  try {
    const { error } = await supabaseAdmin().rpc("touch_game_player", { p_game: game.slug, p_code: row.code, p_player: playerId })
    if (error) console.error("Presence write failed", error)
  } catch (error) {
    console.error("Presence write failed", error)
  }
}

/**
 * Records that the signed-in member `userId` has the site open just now (`member_presence`, migration 0005): the players online count them for two minutes. Unlike `markSeen` it throws when the database
 * cannot write it (the migration is not applied yet, the account is gone): its route says so, and the browser waits longer before its next beat.
 */
export async function touchMember(userId: string): Promise<void> {
  const { error } = await supabaseAdmin().rpc("touch_member", { p_user: userId })
  if (error) throw error
}

/**
 * Records that the account `userId` holds the seat `playerId` of the table `code` (`games.member_ids`, migration 0005), so that the players online count a member once, at a table or not, and a guest only at a table.
 * Like `markSeen` it never throws: it is a convenience, a failure is logged and the request goes on. Nothing for a guest (`userId` is null). Call it from `after()`, once the table has the seat.
 */
export async function seatMember(game: Pick<GameEntry, "slug">, code: string, playerId: string, userId: string | null): Promise<void> {
  if (!userId) return
  try {
    const { error } = await supabaseAdmin().rpc("seat_member", { p_game: game.slug, p_code: code, p_seat: playerId, p_user: userId })
    if (error) console.error("Seat write failed", error)
  } catch (error) {
    console.error("Seat write failed", error)
  }
}
