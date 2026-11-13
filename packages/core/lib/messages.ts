import { personOf, type Person } from "./friends"

/**
 * The messages between friends (PLT-25): the limits, what the routes are called, what the browser is told and how it reads it. Pure, with nothing of the server in it (`server/messages.ts` keeps what the database does, `routes/api/hub/messages/route.ts` the routes).
 * A friend is named by their handle, never by their account's id. Only text: no attachment, no reaction, no group.
 */

/** The most characters of a message (once its spaces at both ends are off). The database holds 2000, which is only the ceiling of the table. */
export const MESSAGE_MAX_LENGTH = 1000
/** How many messages a member can leave unread in a conversation: a friend who never reads is not written to more. */
export const MAX_UNREAD_MESSAGES = 100
/** How many conversations the social state lists, the latest first. */
export const MAX_CONVERSATIONS = 50
/** How many messages of a conversation are read at once (the last ones). */
export const MESSAGES_HISTORY_LIMIT = 100

export const MESSAGES_PATH = "/api/hub/messages"
export const MESSAGE_ACTIONS = ["send", "read"] as const
export type MessageAction = (typeof MESSAGE_ACTIONS)[number]
export const messageActionPath = (action: MessageAction): string => `${MESSAGES_PATH}/${action}`

/** The text a member typed, as the server takes it: control characters are taken out (a line break stays, and a run of them is two at most), the spaces at both ends go. Null for text that is not a string, empty or longer than `MESSAGE_MAX_LENGTH`. */
export function cleanMessageText(value: unknown): string | null {
  if (typeof value !== "string") return null
  const text = value.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0009\u000B-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g, "").replace(/\n{3,}/g, "\n\n").trim()
  return text === "" || Array.from(text).length > MESSAGE_MAX_LENGTH ? null : text
}

/** A conversation as the social state tells it: the friend, how many of their messages are not read, and the last message of the two. */
export type ConversationEntry = Person & { unread: number; lastText: string; lastAt: string; lastMine: boolean }

/** A message of a conversation, as the browser reads it: `id` orders it, `mine` says who wrote it. */
export type ChatMessage = { id: number; mine: boolean; text: string; at: string }

/** A conversation as the wire says one, or null. */
export function conversationOf(value: unknown): ConversationEntry | null {
  const person = personOf(value)
  if (!person) return null
  const { unread, lastText, lastAt, lastMine } = value as Record<string, unknown>
  if (typeof unread !== "number" || !Number.isInteger(unread) || unread < 0 || typeof lastText !== "string" || typeof lastAt !== "string" || Number.isNaN(Date.parse(lastAt)) || typeof lastMine !== "boolean") return null
  return { ...person, unread, lastText, lastAt, lastMine }
}

/** A message as the wire says one, or null. */
export function chatMessageOf(value: unknown): ChatMessage | null {
  if (typeof value !== "object" || value === null) return null
  const { id, mine, text, at } = value as Record<string, unknown>
  return typeof id === "number" && Number.isInteger(id) && id > 0 && typeof mine === "boolean" && typeof text === "string" && typeof at === "string" && !Number.isNaN(Date.parse(at)) ? { id, mine, text, at } : null
}

/** What `GET /api/hub/messages` answers: the last messages of the conversation, the oldest first, and how many of the friend's are not read. */
export type ChatThread = { messages: ChatMessage[]; unread: number }

/** The thread that an answer says, or null when it is not one. */
export function threadOf(body: unknown): ChatThread | null {
  if (typeof body !== "object" || body === null) return null
  const { messages, unread } = body as Record<string, unknown>
  if (!Array.isArray(messages) || typeof unread !== "number") return null
  return { messages: messages.flatMap((item) => chatMessageOf(item) ?? []), unread }
}
