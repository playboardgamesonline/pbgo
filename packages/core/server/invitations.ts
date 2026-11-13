import "server-only"
import type { Handle } from "@pbgo/accounts"
import type { PlayableGame } from "../lib/binding"
import { INVITATION_TTL_MINUTES, MAX_INVITATIONS_RECEIVED, MAX_INVITATIONS_SENT } from "../lib/invitations"
import { loadSettings } from "../lib/settings-server"
import { effectiveSettings } from "../lib/table-settings"
import { friendsNotApplied } from "./friends"
import { ApiError } from "./api"
import { readGame } from "./games"
import { ensureProfile } from "./profiles"
import { supabaseAdmin } from "./supabase"
import { seatedPlayers } from "./table-rules"
import { readTableSettingsOf } from "./table-settings"
import { readMemberTables } from "./tables"

// The invitations to a table (PLT-109, migration 0023). The database decides who may be invited (a friend, only, and never a member who blocked the sender, who is not told), the limits and the answers; what it cannot see is the table, which is read here from its own
// row: the sender must sit at it, it must still wait for players (a lobby) and have a seat free; and when the friend accepts, it must still exist, wait and have room for them. The code of a table is read from the database when the friend accepts, and only then
// is it told to the browser, so the list of invitations a member reads never has it. Where migration 0023 is not applied the routes answer that invitations are not available.

type Member = Parameters<typeof ensureProfile>[0]

/** What the invitations need of the app, which core cannot read: the game of a slug when it can be played here, else null (the registry). */
export type InvitationDeps = { loadGame: (slug: string) => Promise<PlayableGame | null> }

/** The words of the database for a send, and what became of the invitation. */
const SEND_OUTCOMES = ["sent", "missing", "self", "not_friends", "too_many_sent", "unavailable"] as const
export type SendInvitationOutcome = (typeof SEND_OUTCOMES)[number]

const ANSWER_OUTCOMES = ["pending", "accepted", "declined", "expired", "missing"] as const
export type InvitationAnswer = { result: (typeof ANSWER_OUTCOMES)[number]; game?: string; code?: string }

/** Whether the database does not have the invitations yet: migration 0023 is not applied (or the tables of 0013 that a send reads). */
export const invitationsNotApplied = friendsNotApplied

/**
 * The table a visitor may invite to: the lobby of `slug` that they sit at, which waits for players and has a seat free. Refuses with 404 `GAME_NOT_FOUND` (no such game, or the table is gone), 403 `INVITE_NOT_AT_TABLE` (they are not seated at it: the invitation of a
 * table somebody does not sit at would be a way to push a code at a member), 409 `GAME_IN_PROGRESS` (it began) and 409 `GAME_FULL` (every seat is taken).
 */
async function assertMayInvite(deps: InvitationDeps, account: Member, slug: string, code: string): Promise<void> {
  const game = await deps.loadGame(slug)
  if (!game) throw new ApiError("GAME_NOT_FOUND", 404)
  const tables = await readMemberTables(account.id)
  const table = tables.find((held) => held.game === slug && held.code === code)
  if (!table) throw new ApiError("INVITE_NOT_AT_TABLE", 403)
  if (table.status !== "lobby") throw new ApiError("GAME_IN_PROGRESS", 409)
  const { maxPlayers } = await loadSettings(game)
  const seats = effectiveSettings(await readTableSettingsOf(slug, code), maxPlayers).seats
  if (seatedPlayers(table.players).length >= seats) throw new ApiError("GAME_FULL", 409)
}

/**
 * Invites the friend who goes by this handle to the table `code` of the game `slug`, which the visitor must sit at (`assertMayInvite`). Answers `sent` (it waits for them: also what a second press, or a friend who blocked the sender, is told), or
 * throws: 404 `FRIEND_NOT_FOUND`, 400 `FRIEND_SELF`, 403 `INVITE_NOT_FRIEND` (they are not friends: never, removed or blocked, which is one answer), 409 `INVITE_LIMIT` (too many out), 409 `INVITE_UNAVAILABLE` (the friend has too many waiting), and what the table is refused with.
 */
export async function sendInvitation(deps: InvitationDeps, account: Member, handle: Handle, table: { game: string; code: string }): Promise<"sent"> {
  const code = table.code.trim().toUpperCase()
  await assertMayInvite(deps, account, table.game, code)
  if (!(await ensureProfile(account))) throw new ApiError("INVITATIONS_UNAVAILABLE", 503)
  const { data, error } = await supabaseAdmin().rpc("invitation_send", {
    p_user: account.id,
    p_nickname: handle.nickname,
    p_tag: handle.tag,
    p_game: table.game,
    p_code: code,
    p_ttl: `${INVITATION_TTL_MINUTES} minutes`,
    p_max_sent: MAX_INVITATIONS_SENT,
    p_max_received: MAX_INVITATIONS_RECEIVED,
  })
  if (error) throw error
  const outcome = SEND_OUTCOMES.find((word) => word === data)
  if (outcome === undefined) throw new Error(`The database answered ${typeof data === "string" ? JSON.stringify(data) : typeof data} to an invitation`)
  if (outcome === "sent") return "sent"
  if (outcome === "missing") throw new ApiError("FRIEND_NOT_FOUND", 404)
  if (outcome === "self") throw new ApiError("FRIEND_SELF")
  if (outcome === "not_friends") throw new ApiError("INVITE_NOT_FRIEND", 403)
  if (outcome === "too_many_sent") throw new ApiError("INVITE_LIMIT", 409)
  throw new ApiError("INVITE_UNAVAILABLE", 409)
}

async function answerRow(userId: string, id: string, answer: "peek" | "accept" | "decline"): Promise<InvitationAnswer> {
  const { data, error } = await supabaseAdmin().rpc("invitation_answer", { p_user: userId, p_id: id, p_answer: answer })
  if (error) throw error
  const row = typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {}
  const result = ANSWER_OUTCOMES.find((word) => word === row.result)
  if (result === undefined) throw new Error("The database answered something else than a word to an answer to an invitation")
  return { result, ...(typeof row.game === "string" ? { game: row.game } : {}), ...(typeof row.code === "string" ? { code: row.code } : {}) }
}

/**
 * Accepts the invitation `id` of the account and gives the table to go to. The table is looked at before the invitation is spent, so that a refusal leaves it as it was: 404 `INVITE_GONE` (none by this id for them, answered already, or its sender is not
 * their friend any more), 410 `INVITE_EXPIRED`, 404 `INVITE_TABLE_GONE` (the table was deleted), 409 `INVITE_TABLE_STARTED` (it began, and they do not sit at it), 409 `INVITE_TABLE_FULL`. A visitor who sits at the table already is only taken there. The rank
 * and the language a public table asks are checked when they sit down, by the join route (`RANK_TOO_LOW`, `LANGUAGE_MISMATCH`).
 */
export async function acceptInvitation(deps: InvitationDeps, account: Member, id: string): Promise<{ game: string; code: string }> {
  const seen = await answerRow(account.id, id, "peek")
  if (seen.result === "expired") throw new ApiError("INVITE_EXPIRED", 410)
  if (seen.result !== "pending" || !seen.game || !seen.code) throw new ApiError("INVITE_GONE", 404)
  const { game: slug, code } = seen
  const game = await deps.loadGame(slug)
  if (!game) throw new ApiError("INVITE_TABLE_GONE", 404)
  const row = await readGame(game, code).catch((error: unknown) => {
    if (error instanceof ApiError && error.code === "GAME_NOT_FOUND") throw new ApiError("INVITE_TABLE_GONE", 404)
    throw error
  })
  const seated = (await readMemberTables(account.id)).some((held) => held.game === slug && held.code === code)
  if (!seated) {
    if (row.status !== "lobby") throw new ApiError("INVITE_TABLE_STARTED", 409)
    const { maxPlayers } = await loadSettings(game)
    if (seatedPlayers(row.players).length >= effectiveSettings(await readTableSettingsOf(slug, code), maxPlayers).seats) throw new ApiError("INVITE_TABLE_FULL", 409)
  }
  const done = await answerRow(account.id, id, "accept")
  if (done.result === "expired") throw new ApiError("INVITE_EXPIRED", 410)
  if (done.result !== "accepted") throw new ApiError("INVITE_GONE", 404)
  return { game: slug, code }
}

/** Declines the invitation `id` of the account. An invitation that is gone already is as declined as it can be: nothing is said. */
export async function declineInvitation(account: Member, id: string): Promise<"declined"> {
  await answerRow(account.id, id, "decline")
  return "declined"
}
