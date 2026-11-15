import { TAG_MAX, TAG_MIN, tagText, type Handle } from "@pbgo/accounts"
import type { Friend, FriendStatus } from "@pbgo/ui/friends"
import type { Group, GroupMember } from "@pbgo/ui/groups"
import type { Conversation, FriendRequest, Invitation, Message } from "@pbgo/ui/social"
import type { FriendEntry, Person, RequestEntry } from "./friends"
import { MAX_GROUP_MEMBERS, type GroupEntry, type GroupMemberEntry } from "./groups"
import type { InvitationEntry } from "./invitations"
import type { ChatMessage, ConversationEntry } from "./messages"

// What the panels draw of the social state (PLT-23): the friends and the requests of `@pbgo/ui`, made from what the server says (`./friends`). Pure, so that the panel, the pages and the tests read the state the same way.

/** What a member is called in the lists the panel draws: their handle, in lower case so that the case of a nickname makes no other key. Stable while they keep their nickname and their tag, and is the only thing that names them: no account id reaches the browser. */
export const personKey = (person: Pick<Person, "nickname" | "tag">): string => `${person.nickname.toLowerCase()}#${person.tag}`

/**
 * A friend as the panel draws one: offline, or online, or playing when the server says they are at a game that is played; a friend who waits in the lobby of a game is online at it, "In the lobby". A friend is at a game, never at a table: the panel
 * cannot join them until the server joins people to a friend's table (the table's code never leaves the server).
 */
export function friendOf(entry: FriendEntry): Friend {
  const status: FriendStatus = !entry.online ? "offline" : entry.phase === "playing" ? "playing" : "online"
  return {
    id: personKey(entry),
    nickname: entry.nickname,
    tag: tagText(entry.tag),
    avatarUrl: entry.avatarUrl,
    status,
    ...(entry.online && entry.game ? { game: entry.game } : {}),
    ...(entry.online && entry.game && entry.phase === "lobby" ? { activity: "In the lobby" } : {}),
    ...(entry.group !== "none" ? { group: entry.group } : {}),
    ...(entry.pending ? { pending: entry.pending } : {}),
  }
}

/**
 * A member of the visitor's group as the panel draws one, the way a friend is: online, or playing when they are at a game that is played, and "In the lobby" when they wait in a lobby. The visitor themselves is online by being here, whatever the last beat of their tab said (the first
 * one may not have arrived yet).
 */
export function groupMemberOf(entry: GroupMemberEntry): GroupMember {
  const online = entry.online || entry.you
  const status: FriendStatus = !online ? "offline" : entry.phase === "playing" ? "playing" : "online"
  return {
    id: personKey(entry),
    nickname: entry.nickname,
    tag: tagText(entry.tag),
    avatarUrl: entry.avatarUrl,
    status,
    ...(online && entry.game ? { game: entry.game } : {}),
    ...(online && entry.game && entry.phase === "lobby" ? { activity: "In the lobby" } : {}),
    leader: entry.leader,
    you: entry.you,
  }
}

/** The visitor's group as the panel draws it: its members and how many it can hold. Null for no group. */
export const groupOfEntry = (entry: GroupEntry | null): Group | null => (entry ? { members: entry.members.map(groupMemberOf), max: MAX_GROUP_MEMBERS } : null)

/** A request as the panel draws one: `direction` says whether it came in (to accept or decline) or went out (to cancel). */
export const requestOf = (entry: RequestEntry, direction: FriendRequest["direction"]): FriendRequest => ({
  id: `${direction}:${personKey(entry)}`,
  nickname: entry.nickname,
  tag: tagText(entry.tag),
  avatarUrl: entry.avatarUrl,
  direction,
})

/** An invitation as the panel draws it: who sent it, what it is for (a table of a game, a group, or a request to join the visitor's group) and until when. */
export function invitationOfEntry(entry: InvitationEntry): Invitation {
  const base = { id: entry.id, nickname: entry.from.nickname, tag: tagText(entry.from.tag), avatarUrl: entry.from.avatarUrl, expiresAt: entry.expiresAt }
  return entry.kind === "table" ? { ...base, kind: "table", game: entry.game } : { ...base, kind: entry.kind }
}

/** A message of a conversation as the chat window draws it: `mine` is "me", the friend's is "them". Its id is the database's, which orders it. */
export const messageOfChat = (message: ChatMessage): Message => ({ id: String(message.id), from: message.mine ? "me" : "them", text: message.text, at: message.at })

/**
 * The conversations of the social state, as the panel draws them: the last message of each is what the list shows (the whole conversation is read when its window opens), and how many of the friend's are not read. A conversation with somebody who is not in the list of
 * friends is left out (the server only tells those of current friends, so this is a state that changed between two reads).
 */
export function conversationsOf(entries: readonly ConversationEntry[], friends: readonly Friend[]): Conversation[] {
  const byKey = new Map(friends.map((friend) => [friend.id, friend]))
  return entries.flatMap((entry) => {
    const friend = byKey.get(personKey(entry))
    if (!friend) return []
    return [{ id: `chat:${friend.id}`, friend, unread: entry.unread, messages: [{ id: `last:${friend.id}`, from: entry.lastMine ? "me" : "them", text: entry.lastText, at: entry.lastAt } satisfies Message] }]
  })
}

/** The friends, the requests, the invitations and the group of the social state, as the panel draws them: the requests that came in first, then the ones that went out, each the newest first. */
export function panelOf(state: {
  friends: readonly FriendEntry[]
  incoming: readonly RequestEntry[]
  outgoing: readonly RequestEntry[]
  invitations?: readonly InvitationEntry[]
  conversations?: readonly ConversationEntry[]
  group?: GroupEntry | null
}): {
  friends: Friend[]
  requests: FriendRequest[]
  invitations: Invitation[]
  conversations: Conversation[]
  group: Group | null
} {
  const friends = state.friends.map(friendOf)
  return {
    friends,
    conversations: conversationsOf(state.conversations ?? [], friends),
    requests: [...state.incoming.map((entry) => requestOf(entry, "incoming")), ...state.outgoing.map((entry) => requestOf(entry, "outgoing"))],
    invitations: (state.invitations ?? []).map(invitationOfEntry),
    group: groupOfEntry(state.group ?? null),
  }
}

/** The handle of somebody the panel draws, a friend or a request (their tag is written with its four digits), or null for a tag that is not one: what a button sends to name them. */
export function handleOfPerson(person: { nickname: string; tag?: string | null }): Handle | null {
  const tag = Number(person.tag)
  return person.nickname !== "" && Number.isInteger(tag) && tag >= TAG_MIN && tag <= TAG_MAX ? { nickname: person.nickname, tag } : null
}
