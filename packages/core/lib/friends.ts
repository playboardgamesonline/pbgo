import { TAG_MAX, TAG_MIN, checkNickname, tagOfRequest, type Handle } from "@pbgo/accounts"
import type { FriendRequestSource } from "@pbgo/analytics"
import { invitationOf, type InvitationEntry } from "./invitations"
import { conversationOf, type ConversationEntry } from "./messages"

/**
 * The friends of the hub (PLT-23): the limits, what the routes are called, what the browser is told and how it reads it. Pure, with nothing of the server in it, so that the routes, the pages and the tests read it the same way
 * (`server/friends.ts` keeps what the database does, `routes/api/hub/friends/route.ts` the routes). A member is named by their handle, a nickname and a tag, never by their account's id: the id stays on the server.
 */

/** How many friends a member can have. */
export const MAX_FRIENDS = 200
/** How many friend requests can wait for a member's answer at once. A request to a member who has this many waiting is refused. */
export const MAX_REQUESTS_RECEIVED = 50
/** How many requests a member can have sent that nobody answered yet. */
export const MAX_REQUESTS_SENT = 100
/** How many members a member can block. */
export const MAX_BLOCKS = 500

/** The routes of the friends, under `/api/hub/friends`: the whole state is read from the address itself, and each of these is a `POST` that changes one thing. */
export const FRIENDS_PATH = "/api/hub/friends"
export const FRIEND_ACTIONS = ["request", "accept", "decline", "cancel", "remove", "block", "unblock"] as const
export type FriendAction = (typeof FRIEND_ACTIONS)[number]
export const friendActionPath = (action: FriendAction): string => `${FRIENDS_PATH}/${action}`

/** Where a request is sent from: the form that takes a username and a tag (the panel, the page of the friends), or the button of a profile. */
export const FRIEND_REQUEST_SOURCES = ["form", "profile"] as const satisfies readonly FriendRequestSource[]

/** The source a request says it comes from, else the form: anyone can write a request, so only the words above count. */
export const requestSourceOf = (value: unknown): FriendRequestSource => FRIEND_REQUEST_SOURCES.find((source) => source === value) ?? "form"

/** What an action did, which the route answers (`{ "ok": true, "result": … }`): a request that waits (`sent`), one that was accepted (`accepted`: by the member it was sent to, or by sending one to somebody who had sent one), friends already (`friends`), and the others by their word. */
export type FriendResult = "sent" | "accepted" | "friends" | "declined" | "cancelled" | "removed" | "blocked" | "unblocked"

/** The handle that a request names (`{ nickname, tag }`): the nickname as a profile keeps it and the tag as a member typed it or the number it is, or null when it cannot be anybody's. */
export function handleOfBody(body: { nickname?: unknown; tag?: unknown }): Handle | null {
  const checked = typeof body.nickname === "string" ? checkNickname(body.nickname) : null
  const tag = tagOfRequest(body.tag)
  return checked?.ok && tag !== null ? { nickname: checked.nickname, tag } : null
}

/** A member as the others see them: the pair that names them and their picture. */
export type Person = { nickname: string; tag: number; avatarUrl: string | null }

/** Where a friend is: in the lobby of a game that waits for players, or in a game that is played (or about to be: its ready check). */
export type FriendPhase = "lobby" | "playing"

/** The game a friend is at: its slug and the name the hub gives it. Never the table. */
export type FriendGame = { slug: string; name: string }

/** A friend: whether they are online (the server saw them in the last two minutes) and, when they are, the game they are at. */
export type FriendEntry = Person & { online: boolean; game: FriendGame | null; phase: FriendPhase | null }

/** A request that waits, with the day it was sent (an ISO date). */
export type RequestEntry = Person & { at: string }

/** The whole social state of a member, as `GET /api/hub/friends` answers it. */
export type SocialState = { friends: FriendEntry[]; incoming: RequestEntry[]; outgoing: RequestEntry[]; blocked: Person[]; invitations: InvitationEntry[]; conversations: ConversationEntry[] }

export const NO_SOCIAL: SocialState = { friends: [], incoming: [], outgoing: [], blocked: [], invitations: [], conversations: [] }

const isTag = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value >= TAG_MIN && value <= TAG_MAX

/** A picture is an `https` address of a sensible length, or none: the browser draws no other. */
const pictureOf = (value: unknown): string | null => (typeof value === "string" && value.length <= 2048 && /^https:\/\//i.test(value) ? value : null)

/** A person as the wire says one, or null: a nickname of 1 to 20 characters and a tag in range. A browser never draws what the server did not mean to send. */
export function personOf(value: unknown): Person | null {
  if (typeof value !== "object" || value === null) return null
  const { nickname, tag, avatarUrl } = value as Record<string, unknown>
  if (typeof nickname !== "string" || nickname === "" || Array.from(nickname).length > 20 || !isTag(tag)) return null
  return { nickname, tag, avatarUrl: pictureOf(avatarUrl) }
}

const requestOf = (value: unknown): RequestEntry | null => {
  const person = personOf(value)
  const at = typeof value === "object" && value !== null ? (value as Record<string, unknown>).at : undefined
  return person && typeof at === "string" && !Number.isNaN(Date.parse(at)) ? { ...person, at } : null
}

function friendOf(value: unknown): FriendEntry | null {
  const person = personOf(value)
  if (!person) return null
  const { online, game, phase } = value as Record<string, unknown>
  if (typeof online !== "boolean") return null
  const gameOf = typeof game === "object" && game !== null ? (game as Record<string, unknown>) : null
  const named = gameOf && typeof gameOf.slug === "string" && typeof gameOf.name === "string" && gameOf.slug !== "" ? { slug: gameOf.slug, name: gameOf.name } : null
  const where = phase === "lobby" || phase === "playing" ? phase : null
  // A friend is shown at a game only while they are online and the game is one that has a name; the phase goes with it
  return { ...person, online, game: online && named && where ? named : null, phase: online && named && where ? where : null }
}

const listOf = <T>(value: unknown, read: (item: unknown) => T | null): T[] => (Array.isArray(value) ? value.flatMap((item) => read(item) ?? []) : [])

/** The state that an answer of `GET /api/hub/friends` says, or null when it is not one: each list drops the entries that are not what they should be. */
export function socialStateOf(body: unknown): SocialState | null {
  if (typeof body !== "object" || body === null) return null
  const { friends, incoming, outgoing, blocked, invitations, conversations } = body as Record<string, unknown>
  if (!Array.isArray(friends) || !Array.isArray(incoming) || !Array.isArray(outgoing) || !Array.isArray(blocked)) return null
  // `invitations` (PLT-109) and `conversations` (PLT-25) are the newest parts of the state: an answer without them is an older server's, which has none
  return { friends: listOf(friends, friendOf), incoming: listOf(incoming, requestOf), outgoing: listOf(outgoing, requestOf), blocked: listOf(blocked, personOf), invitations: listOf(invitations, invitationOf), conversations: listOf(conversations, conversationOf) }
}

/** What is between the visitor and a member whose profile they look at: friends, a request that came in or went out, a member they blocked, or nothing. A member who blocked the visitor is nothing, as far as the visitor can tell. */
export const FRIEND_RELATIONS = ["none", "friends", "incoming", "outgoing", "blocked"] as const
export type FriendRelation = (typeof FRIEND_RELATIONS)[number]

/** The relation that a word says, `none` for any other. */
export const relationOf = (value: unknown): FriendRelation => FRIEND_RELATIONS.find((relation) => relation === value) ?? "none"
