// What the social panel of the navbar (`@pbgo/ui/platform/social-panel`) is made of beyond the friends (`./friends`): the conversations with them, the requests to be
// friends, and the time written on a message. No React in this file, so that it is tested as it is.

import type { Friend } from "./friends"

/** A message of a conversation: who wrote it, what it says, and when (a date and a time, ISO 8601). */
export type Message = { id: string; from: "me" | "them"; text: string; at: string }

/** A conversation with a friend: the messages, the oldest first, and how many of theirs have not been read yet. */
export type Conversation = { id: string; friend: Friend; messages: readonly Message[]; unread: number }

/** A request to be friends that waits for an answer: to accept or decline when it came in, to cancel when it went out. */
export type FriendRequest = {
  id: string
  nickname: string
  tag: string
  /** Their picture; the initials of their name when there is none. */
  avatarUrl?: string | null
  direction: "incoming" | "outgoing"
}

/** The last message of a conversation, if it has any. */
export const lastMessage = (conversation: Conversation): Message | undefined => conversation.messages.at(-1)

/** The conversations, the one with the latest message first; those with no message are last. */
export function sortedConversations(conversations: readonly Conversation[]): Conversation[] {
  const at = (conversation: Conversation) => {
    const last = lastMessage(conversation)
    return last ? Date.parse(last.at) : Number.NEGATIVE_INFINITY
  }
  return [...conversations].sort((a, b) => at(b) - at(a))
}

/** How many messages wait to be read, in all the conversations. */
export const unreadOf = (conversations: readonly Conversation[]): number => conversations.reduce((total, conversation) => total + conversation.unread, 0)

/** How long ago, in the one unit that fits, for the list of messages: "now", "2m ago", "1h ago", "3d ago". `now` is a parameter so that it is tested. */
export function timeAgo(iso: string, now: number = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - Date.parse(iso)) / 1000))
  if (seconds < 60) return "now"
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}
