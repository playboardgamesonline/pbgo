import "server-only"
import type { Handle } from "@pbgo/accounts"
import {
  MAX_BLOCKS,
  MAX_FRIENDS,
  MAX_REQUESTS_RECEIVED,
  MAX_REQUESTS_SENT,
  personOf,
  relationOf,
  type FriendPhase,
  type FriendRelation,
  type Person,
  type RequestEntry,
  type SocialState,
} from "../lib/friends"
import { isInvitationId } from "../lib/invitations"
import { isMissingFunction, isMissingTable } from "./db-error"
import { ensureProfile } from "./profiles"
import { supabaseAdmin } from "./supabase"

// The friends of the members (PLT-23, migration 0017): the friendships, the requests that wait and the blocks, written and read through the functions of the database, each of which decides in one transaction. Server key only: no browser reads the tables. A member is
// named by their handle (the nickname and the tag the pages show), never by their account's id, which stays here. The limits are `lib/friends.ts`'s, given to every function that counts. Where migration 0017 is not applied yet the state is empty, and a change throws what
// the database says, which `friendsNotApplied` tells so that a route can answer that friends are not available.

/** The members whose friends and requests are asked, as the functions that make a profile on the spot need them. */
type Member = Parameters<typeof ensureProfile>[0]

/** A friend as the database says: whether they are online, and the game (its slug) and the phase of the table they are at, when they are online and at one. The table, with its code, is never read. */
export type FriendRecord = Person & { online: boolean; game: string | null; phase: FriendPhase | null }

/** An invitation to a table that waits for the member: who sent it, the game (its slug) and when. The table, with its code, is never read. */
export type InvitationRecord = { id: string; from: Person; game: string; at: string; expiresAt: string }

/** The whole social state of a member: their friends with their presence, the requests that came in and went out, the members they blocked, and the invitations to a table that wait for them (PLT-109, migration 0023). */
export type SocialRecord = { friends: FriendRecord[]; incoming: RequestEntry[]; outgoing: RequestEntry[]; blocked: Person[]; invitations: InvitationRecord[] }

export const EMPTY_SOCIAL: SocialRecord = { friends: [], incoming: [], outgoing: [], blocked: [], invitations: [] }

/** Whether the database does not have the friends yet: migration 0017 is not applied. */
export const friendsNotApplied = (error: unknown): boolean => typeof error === "object" && error !== null && (isMissingTable(error as { code?: string }) || isMissingFunction(error as { code?: string }))

const objectsOf = (value: unknown): Record<string, unknown>[] => (Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null) : [])

/** The person a row of the state says: the database writes the picture as `avatar_url`. */
const personOfRow = (row: Record<string, unknown>): Person | null => personOf({ nickname: row.nickname, tag: row.tag, avatarUrl: row.avatar_url })

function requestOfRow(row: Record<string, unknown>): RequestEntry | null {
  const person = personOfRow(row)
  return person && typeof row.at === "string" && !Number.isNaN(Date.parse(row.at)) ? { ...person, at: row.at } : null
}

function friendOfRow(row: Record<string, unknown>): FriendRecord | null {
  const person = personOfRow(row)
  if (!person || typeof row.online !== "boolean") return null
  const game = typeof row.game === "string" && row.game !== "" ? row.game : null
  const phase = row.phase === "lobby" || row.phase === "playing" ? row.phase : null
  return { ...person, online: row.online, game: row.online && game && phase ? game : null, phase: row.online && game && phase ? phase : null }
}

function invitationOfRow(row: Record<string, unknown>): InvitationRecord | null {
  const from = personOfRow(row)
  if (!from || !isInvitationId(row.id) || typeof row.game !== "string" || row.game === "") return null
  if (typeof row.at !== "string" || Number.isNaN(Date.parse(row.at)) || typeof row.expires_at !== "string" || Number.isNaN(Date.parse(row.expires_at))) return null
  return { id: row.id, from, game: row.game, at: row.at, expiresAt: row.expires_at }
}

/** The invitations that `invitations_for` answers, as records: an entry that is not what it should be is left out. */
export const invitationRecordsOf = (data: unknown): InvitationRecord[] => objectsOf(data).flatMap((row) => invitationOfRow(row) ?? [])

/** The state that `social_state` answers, as a record: an entry that is not what it should be is left out, and an answer that is not an object is nobody's state. */
export function socialRecordOf(data: unknown): SocialRecord {
  if (typeof data !== "object" || data === null) return EMPTY_SOCIAL
  const { friends, incoming, outgoing, blocked } = data as Record<string, unknown>
  return {
    friends: objectsOf(friends).flatMap((row) => friendOfRow(row) ?? []),
    incoming: objectsOf(incoming).flatMap((row) => requestOfRow(row) ?? []),
    outgoing: objectsOf(outgoing).flatMap((row) => requestOfRow(row) ?? []),
    blocked: objectsOf(blocked).flatMap((row) => personOfRow(row) ?? []),
    invitations: [],
  }
}

/**
 * The friends, the requests, the blocks and the invitations of this account, read together. Throws what the database says, but not for a project where the friends are not there yet, which has none. A project where migration 0023 is not applied has
 * no invitations, and the rest is read as ever.
 */
export async function readSocial(userId: string): Promise<SocialRecord> {
  const db = supabaseAdmin()
  const [state, invitations] = await Promise.all([db.rpc("social_state", { p_user: userId }), db.rpc("invitations_for", { p_user: userId })])
  if (state.error) {
    if (friendsNotApplied(state.error)) return EMPTY_SOCIAL
    throw state.error
  }
  if (invitations.error && !friendsNotApplied(invitations.error)) throw invitations.error
  return { ...socialRecordOf(state.data), invitations: invitations.error ? [] : invitationRecordsOf(invitations.data) }
}

/** The social state as the browser is told it: each friend's game with its name (the hub's, which the app gives), or none when the hub has no name for it. The tables, and the accounts, are not in it. */
export function stateOf(record: SocialRecord, names: ReadonlyMap<string, string>): SocialState {
  return {
    ...record,
    // An invitation is for a game that the hub names; one for a game it does not list (it was taken down) is not shown, since the table cannot be joined from here
    invitations: record.invitations.flatMap((invitation) => {
      const name = names.get(invitation.game)
      return name ? [{ id: invitation.id, from: invitation.from, game: { slug: invitation.game, name }, at: invitation.at, expiresAt: invitation.expiresAt }] : []
    }),
    friends: record.friends.map((friend) => {
      const name = friend.game ? names.get(friend.game) : undefined
      return friend.game && name ? { ...friend, game: { slug: friend.game, name } } : { ...friend, game: null, phase: null }
    }),
  }
}

/** What a function of the database answers is one of its words: any other thing is a database that does not match this code, and nothing is guessed. */
function outcomeOf<T extends string>(data: unknown, allowed: readonly T[]): T {
  const outcome = allowed.find((word) => word === data)
  if (outcome === undefined) throw new Error(`The database answered ${typeof data === "string" ? JSON.stringify(data) : typeof data} to a change of the friends`)
  return outcome
}

const SEND_OUTCOMES = ["sent", "accepted", "friends", "missing", "self", "blocked_by_you", "full", "too_many_sent", "unavailable", "no_profile"] as const

/**
 * What became of a request to a member: it waits (`sent`, which is also what a member who blocked the sender is told, with nothing written), it accepted one the member had sent (`accepted`), they are friends already (`friends`), nobody goes by the handle
 * (`missing`), the handle is the sender's own (`self`), the sender blocked the member (`blocked_by_you`), the sender has all their friends (`full`) or all their requests sent that wait (`too_many_sent`), the member cannot be asked (`unavailable`: all their friends, or all
 * the requests they can have waiting), or the sender has no profile (`no_profile`).
 */
export type SendOutcome = (typeof SEND_OUTCOMES)[number]

/** Sends a request to the member who goes by this handle (the case of the nickname does not matter). The sender's own profile is made first if they have none: it is how the member is named to the others. Throws what the database says. */
export async function sendFriendRequest(account: Member, handle: Handle): Promise<SendOutcome> {
  if (!(await ensureProfile(account))) return "no_profile"
  const { data, error } = await supabaseAdmin().rpc("friend_request_send", {
    p_user: account.id,
    p_nickname: handle.nickname,
    p_tag: handle.tag,
    p_max_friends: MAX_FRIENDS,
    p_max_received: MAX_REQUESTS_RECEIVED,
    p_max_sent: MAX_REQUESTS_SENT,
  })
  if (error) throw error
  return outcomeOf(data, SEND_OUTCOMES)
}

export type FriendAnswer = "accept" | "decline" | "cancel"

const ANSWER_OUTCOMES = ["accepted", "declined", "cancelled", "missing", "full", "unavailable", "no_profile"] as const

/** What became of an answer: done (`accepted`, `declined`, `cancelled`), no such request any more (`missing`), or accepting was refused (`full`: the member has all their friends; `unavailable`: the one who sent it has; `no_profile`). */
export type AnswerOutcome = (typeof ANSWER_OUTCOMES)[number]

/** Answers the request that the member who goes by this handle sent to the account (`accept`, `decline`), or takes back the one the account sent them (`cancel`). Throws what the database says. */
export async function answerFriendRequest(account: Member, handle: Handle, answer: FriendAnswer): Promise<AnswerOutcome> {
  if (answer === "accept" && !(await ensureProfile(account))) return "no_profile"
  const { data, error } = await supabaseAdmin().rpc("friend_request_answer", { p_user: account.id, p_nickname: handle.nickname, p_tag: handle.tag, p_answer: answer, p_max_friends: MAX_FRIENDS })
  if (error) throw error
  return outcomeOf(data, ANSWER_OUTCOMES)
}

const REMOVE_OUTCOMES = ["removed", "missing"] as const

/** Ends the friendship with the member who goes by this handle: `removed`, or `missing` when nobody goes by it or they were not friends. Throws what the database says. */
export async function removeFriend(userId: string, handle: Handle): Promise<(typeof REMOVE_OUTCOMES)[number]> {
  const { data, error } = await supabaseAdmin().rpc("friend_remove", { p_user: userId, p_nickname: handle.nickname, p_tag: handle.tag })
  if (error) throw error
  return outcomeOf(data, REMOVE_OUTCOMES)
}

const BLOCK_OUTCOMES = ["blocked", "blocked_friend", "missing", "self", "full"] as const

/**
 * Blocks the member who goes by this handle: the friendship ends and the requests between them are taken away. `blocked_friend` says they were friends, `missing` that nobody goes by the handle, `self` that it is the account's own, `full` that the
 * account blocked as many members as it can. Throws what the database says.
 */
export async function blockMember(userId: string, handle: Handle): Promise<(typeof BLOCK_OUTCOMES)[number]> {
  const { data, error } = await supabaseAdmin().rpc("friend_block", { p_user: userId, p_nickname: handle.nickname, p_tag: handle.tag, p_max_blocks: MAX_BLOCKS })
  if (error) throw error
  return outcomeOf(data, BLOCK_OUTCOMES)
}

const UNBLOCK_OUTCOMES = ["unblocked", "missing"] as const

/** Lifts the block on the member who goes by this handle: `unblocked`, or `missing` when nobody goes by it or they were not blocked. Throws what the database says. */
export async function unblockMember(userId: string, handle: Handle): Promise<(typeof UNBLOCK_OUTCOMES)[number]> {
  const { data, error } = await supabaseAdmin().rpc("friend_unblock", { p_user: userId, p_nickname: handle.nickname, p_tag: handle.tag })
  if (error) throw error
  return outcomeOf(data, UNBLOCK_OUTCOMES)
}

/** What is between the account and another, as the account may know it (`none` for a member who blocked the account: nothing tells them). `none` where the friends are not there yet. Throws the rest. */
export async function readRelation(userId: string, otherId: string): Promise<FriendRelation> {
  const { data, error } = await supabaseAdmin().rpc("friend_relation", { p_user: userId, p_other: otherId })
  if (error) {
    if (friendsNotApplied(error)) return "none"
    throw error
  }
  return relationOf(data)
}
