import "server-only"
import type { Handle } from "@pbgo/accounts"
import { MAX_UNREAD_MESSAGES, MESSAGE_MAX_LENGTH, MESSAGES_HISTORY_LIMIT, chatMessageOf, type ChatMessage, type ChatThread } from "../lib/messages"
import { ApiError } from "./api"
import { friendsNotApplied } from "./friends"
import { ensureProfile } from "./profiles"
import { supabaseAdmin } from "./supabase"

// The messages between friends (PLT-25, migration 0025): written and read through the functions of the database, each of which decides in one transaction, with the server key only. A friend is named by their handle; the account's id stays here. The text arrives
// already cleaned (`cleanMessageText`). Where migration 0025 is not applied the conversations are empty (`readSocial`) and the routes answer that messages are not available.

type Member = Parameters<typeof ensureProfile>[0]

/** Whether the database does not have the messages yet: migration 0025 is not applied. */
export const messagesNotApplied = friendsNotApplied

const SEND_RESULTS = ["sent", "missing", "self", "not_friends", "empty", "too_long", "too_many"] as const

/**
 * Writes `text` to the friend who goes by this handle and gives the message as the conversation shows it (`mine`). Throws: 404 `FRIEND_NOT_FOUND`, 400 `FRIEND_SELF`, 403 `MESSAGE_NOT_FRIEND` (they are not friends: never, removed or blocked, which is one answer, so a block is not
 * told), 400 `MESSAGE_INVALID` (empty or too long: the route has cleaned it, so this is the database's own word), 409 `MESSAGE_UNREAD_LIMIT` (the friend has not read what is out already).
 */
export async function sendMessage(account: Member, handle: Handle, text: string): Promise<ChatMessage> {
  if (!(await ensureProfile(account))) throw new ApiError("MESSAGES_UNAVAILABLE", 503)
  const { data, error } = await supabaseAdmin().rpc("message_send", {
    p_user: account.id,
    p_nickname: handle.nickname,
    p_tag: handle.tag,
    p_body: text,
    p_max_length: MESSAGE_MAX_LENGTH,
    p_max_unread: MAX_UNREAD_MESSAGES,
  })
  if (error) throw error
  const row = typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {}
  const result = SEND_RESULTS.find((word) => word === row.result)
  if (result === undefined) throw new Error("The database answered something else than a word to a message")
  if (result === "missing") throw new ApiError("FRIEND_NOT_FOUND", 404)
  if (result === "self") throw new ApiError("FRIEND_SELF")
  if (result === "not_friends") throw new ApiError("MESSAGE_NOT_FRIEND", 403)
  if (result === "empty" || result === "too_long") throw new ApiError("MESSAGE_INVALID")
  if (result === "too_many") throw new ApiError("MESSAGE_UNREAD_LIMIT", 409)
  const message = chatMessageOf({ id: row.id, mine: true, text, at: row.at })
  if (!message) throw new Error("The database did not say which message it wrote")
  return message
}

/** The last messages of the conversation of the account with the friend who goes by this handle, the oldest first, and how many of the friend's are not read. Throws 404 `FRIEND_NOT_FOUND` and 403 `MESSAGE_NOT_FRIEND`: a stranger, or a member who blocked them, reads nothing. */
export async function readThread(userId: string, handle: Handle): Promise<ChatThread> {
  const { data, error } = await supabaseAdmin().rpc("messages_with", { p_user: userId, p_nickname: handle.nickname, p_tag: handle.tag, p_limit: MESSAGES_HISTORY_LIMIT })
  if (error) throw error
  const row = typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {}
  if (row.result === "missing") throw new ApiError("FRIEND_NOT_FOUND", 404)
  if (row.result === "not_friends") throw new ApiError("MESSAGE_NOT_FRIEND", 403)
  if (row.result !== "ok" || !Array.isArray(row.messages) || typeof row.unread !== "number") throw new Error("The database answered something else than a conversation")
  return { messages: row.messages.flatMap((item) => chatMessageOf(item) ?? []), unread: row.unread }
}

/** Marks what the friend who goes by this handle wrote to the account as read, and says how many it was (0 for a stranger: nothing is told of who is a friend). */
export async function markRead(userId: string, handle: Handle): Promise<number> {
  const { data, error } = await supabaseAdmin().rpc("messages_read", { p_user: userId, p_nickname: handle.nickname, p_tag: handle.tag })
  if (error) throw error
  return typeof data === "number" ? data : 0
}
