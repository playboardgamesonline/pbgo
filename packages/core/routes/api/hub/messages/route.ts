import { isDemoAccount } from "@pbgo/accounts/demo"
import { getAccount } from "@pbgo/accounts/server"
import { handleOfBody } from "../../../../lib/friends"
import { cleanMessageText, type ChatThread, type MessageAction } from "../../../../lib/messages"
import { ApiError, assertSameOrigin, handle, readJson } from "../../../../server/api"
import { markRead, messagesNotApplied, readThread, sendMessage } from "../../../../server/messages"
import { rateLimit } from "../../../../server/rate-limit"

const NO_THREAD: ChatThread = { messages: [], unread: 0 }

/**
 * `GET /api/hub/messages?nickname=Alex&tag=42` (PLT-25): the conversation of the signed-in member with a friend, the last messages, the oldest first, and how many of the friend's they have not read: `{ messages: [{ id, mine, text, at }], unread }`. The chat window asks for it
 * when it opens and again every few seconds while it is open and in view. 401 `NOT_SIGNED_IN`, 400 `FRIEND_INVALID` for a handle that cannot be anybody's, 404 `FRIEND_NOT_FOUND`, 403 `MESSAGE_NOT_FRIEND` (a stranger, a removed friend or a member who blocked them reads
 * nothing: one answer), 429 over the limit (`messagesRead`), 503 `MESSAGES_UNAVAILABLE` where migration 0024 is not applied. The demo account of development is in no database: its conversations are made up by the browser, so this answers none. Never cached.
 */
export const getMessages = handle(async (request: Request): Promise<ChatThread> => {
  await rateLimit(null, request, "messagesRead")
  const account = await getAccount()
  if (!account) throw new ApiError("NOT_SIGNED_IN", 401)
  const url = new URL(request.url)
  const who = handleOfBody({ nickname: url.searchParams.get("nickname"), tag: url.searchParams.get("tag") })
  if (!who) throw new ApiError("FRIEND_INVALID")
  if (isDemoAccount(account)) return NO_THREAD
  try {
    return await readThread(account.id, who)
  } catch (error) {
    if (messagesNotApplied(error)) throw new ApiError("MESSAGES_UNAVAILABLE", 503)
    throw error
  }
})

/**
 * The `POST` of one action of the messages (PLT-25), under `/api/hub/messages/<action>`: `send` (`{ nickname, tag, text }`: write to a friend; answers `{ ok: true, message: { id, mine, text, at } }`) and `read` (`{ nickname, tag }`: mark what the friend wrote as read;
 * answers `{ ok: true, read: <how many> }`). The text is cleaned (control characters out, spaces at both ends off) and is 1 to `MESSAGE_MAX_LENGTH` characters: 400 `MESSAGE_INVALID`. The request must come from this site (403 `CROSS_ORIGIN`), 401 `NOT_SIGNED_IN`, 400
 * `FRIEND_INVALID` for a handle that cannot be anybody's, 429 over the limits (`messageSend`, `messageRead`), 404 `FRIEND_NOT_FOUND`, 400 `FRIEND_SELF`, 403 `MESSAGE_NOT_FRIEND` (never friends, removed or blocked: one answer, so a block is not told; a member who blocked the sender
 * never gets anything), 409 `MESSAGE_UNREAD_LIMIT`, 503 `MESSAGES_UNAVAILABLE` where migration 0024 is not applied. The demo account of development is told it is done and nothing is written.
 */
export const postMessage = (action: MessageAction) =>
  handle(async (request: Request) => {
    assertSameOrigin(request)
    await rateLimit(null, request, action === "send" ? "messageSend" : "messageRead")
    const account = await getAccount()
    if (!account) throw new ApiError("NOT_SIGNED_IN", 401)
    const sent = await readJson<unknown>(request)
    const body: Record<string, unknown> = typeof sent === "object" && sent !== null ? (sent as Record<string, unknown>) : {}
    const who = handleOfBody(body)
    if (!who) throw new ApiError("FRIEND_INVALID")
    const text = action === "send" ? cleanMessageText(body.text) : null
    if (action === "send" && text === null) throw new ApiError("MESSAGE_INVALID")
    try {
      if (action === "read") return { ok: true, read: isDemoAccount(account) ? 0 : await markRead(account.id, who) }
      if (isDemoAccount(account)) return { ok: true, message: { id: Date.now(), mine: true, text, at: new Date().toISOString() } }
      return { ok: true, message: await sendMessage(account, who, text!) }
    } catch (error) {
      if (messagesNotApplied(error)) throw new ApiError("MESSAGES_UNAVAILABLE", 503)
      throw error
    }
  })
