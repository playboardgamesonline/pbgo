import "server-only"
import type { Handle } from "@pbgo/accounts"
import { MAX_GROUP_MEMBERS, isUuid, type GroupResult } from "../lib/groups"
import { INVITATION_TTL_MINUTES, MAX_INVITATIONS_RECEIVED, MAX_INVITATIONS_SENT } from "../lib/invitations"
import { ApiError } from "./api"
import { friendsNotApplied } from "./friends"
import { ensureProfile } from "./profiles"
import { supabaseAdmin } from "./supabase"

// The groups of the members (PLT-23, migration 0027). A group has two to eight members and one leader; it is made when a friend accepts the invitation of a member who has none, and it goes when it has fewer than two members. The database decides everything in one
// transaction (who may be invited, the cap, the one group of a member, the lead that goes to the member who has been in longest, a block that takes a member out of the group they share with the one they blocked); this module only gives it the limits (`lib/groups.ts`,
// `lib/invitations.ts`) and turns its words into the refusals of the routes. Inviting to a group and asking to join one are invitations (`kind` `group` and `join` of `table_invitations`): they are sent and answered through the same routes as the invitations to a table,
// which call `inviteToGroup`, `askToJoinGroup` and `acceptGroupInvitation` here. The group of the state a member reads comes with the social state (`readSocial` of `server/friends.ts`). Where migration 0027 is not applied the routes answer that groups are not available.

type Member = Parameters<typeof ensureProfile>[0]

/** Whether the database does not have the groups yet: migration 0027 is not applied (or the friends' tables it stands on are not). */
export const groupsNotApplied = friendsNotApplied

const INVITE_OUTCOMES = ["sent", "missing", "self", "not_friends", "already", "busy", "full", "too_many_sent", "unavailable"] as const
const ASK_OUTCOMES = ["sent", "missing", "self", "not_friends", "in_group", "no_group", "full", "unavailable", "too_many_sent"] as const
const ACCEPT_OUTCOMES = ["created", "joined", "missing", "expired", "in_group", "full", "unavailable"] as const
const LEAVE_OUTCOMES = ["left", "missing"] as const
const KICK_OUTCOMES = ["kicked", "not_in_group", "not_leader", "missing"] as const
const LEAD_OUTCOMES = ["led", "not_in_group", "not_leader", "missing"] as const

/** What a function of the database answers is one of its words: any other thing is a database that does not match this code, and nothing is guessed. */
function outcomeOf<T extends string>(data: unknown, allowed: readonly T[]): T {
  const outcome = allowed.find((word) => word === data)
  if (outcome === undefined) throw new Error(`The database answered ${typeof data === "string" ? JSON.stringify(data) : typeof data} to a change of the groups`)
  return outcome
}

/** The limits every invitation takes, the way the invitations to a table do: how long it waits, how many a member can have out, how many can wait for a friend. */
const LIMITS = { p_ttl: `${INVITATION_TTL_MINUTES} minutes`, p_max_sent: MAX_INVITATIONS_SENT, p_max_received: MAX_INVITATIONS_RECEIVED, p_max_members: MAX_GROUP_MEMBERS }

/**
 * Invites the friend who goes by this handle to the group of the account: the group they are in, or the one that the friend's acceptance makes when they have none (any member may invite, the leader does not validate). Answers `sent` (it waits for them: also what a second
 * press, or a friend who blocked the account, is told), or throws: 404 `FRIEND_NOT_FOUND`, 400 `FRIEND_SELF`, 403 `INVITE_NOT_FRIEND` (never friends, removed or blocked: one answer), 409 `GROUP_ALREADY_MEMBER` (the friend is in the group already), 409 `GROUP_TARGET_IN_GROUP`
 * (they are in another one), 409 `GROUP_FULL`, 409 `INVITE_LIMIT`, 409 `INVITE_UNAVAILABLE`, 503 `GROUPS_UNAVAILABLE` for an account that has no profile to be named by.
 */
export async function inviteToGroup(account: Member, handle: Handle): Promise<"sent"> {
  if (!(await ensureProfile(account))) throw new ApiError("GROUPS_UNAVAILABLE", 503)
  const { data, error } = await supabaseAdmin().rpc("group_invite", { p_user: account.id, p_nickname: handle.nickname, p_tag: handle.tag, ...LIMITS })
  if (error) throw error
  const outcome = outcomeOf(data, INVITE_OUTCOMES)
  if (outcome === "sent") return "sent"
  if (outcome === "missing") throw new ApiError("FRIEND_NOT_FOUND", 404)
  if (outcome === "self") throw new ApiError("FRIEND_SELF")
  if (outcome === "not_friends") throw new ApiError("INVITE_NOT_FRIEND", 403)
  if (outcome === "already") throw new ApiError("GROUP_ALREADY_MEMBER", 409)
  if (outcome === "busy") throw new ApiError("GROUP_TARGET_IN_GROUP", 409)
  if (outcome === "full") throw new ApiError("GROUP_FULL", 409)
  if (outcome === "too_many_sent") throw new ApiError("INVITE_LIMIT", 409)
  throw new ApiError("INVITE_UNAVAILABLE", 409)
}

/**
 * Asks to join the group of the friend who goes by this handle: the request goes to every member of that group, and any of them can answer it. Answers `sent` (it waits: also what a second press, or a group where a member blocked the account, is told), or throws: 404
 * `FRIEND_NOT_FOUND`, 400 `FRIEND_SELF`, 403 `INVITE_NOT_FRIEND`, 409 `GROUP_ALREADY_IN` (the account is in a group: they leave it first), 404 `GROUP_GONE` (the friend is not in a group any more), 409 `GROUP_FULL`, 409 `GROUP_UNAVAILABLE` (the account blocked a member of
 * the group, or every member has all the requests they can have waiting), 409 `INVITE_LIMIT`, 503 `GROUPS_UNAVAILABLE` for an account that has no profile.
 */
export async function askToJoinGroup(account: Member, handle: Handle): Promise<"sent"> {
  if (!(await ensureProfile(account))) throw new ApiError("GROUPS_UNAVAILABLE", 503)
  const { data, error } = await supabaseAdmin().rpc("group_ask", { p_user: account.id, p_nickname: handle.nickname, p_tag: handle.tag, ...LIMITS })
  if (error) throw error
  const outcome = outcomeOf(data, ASK_OUTCOMES)
  if (outcome === "sent") return "sent"
  if (outcome === "missing") throw new ApiError("FRIEND_NOT_FOUND", 404)
  if (outcome === "self") throw new ApiError("FRIEND_SELF")
  if (outcome === "not_friends") throw new ApiError("INVITE_NOT_FRIEND", 403)
  if (outcome === "in_group") throw new ApiError("GROUP_ALREADY_IN", 409)
  if (outcome === "no_group") throw new ApiError("GROUP_GONE", 404)
  if (outcome === "full") throw new ApiError("GROUP_FULL", 409)
  if (outcome === "unavailable") throw new ApiError("GROUP_UNAVAILABLE", 409)
  throw new ApiError("INVITE_LIMIT", 409)
}

/**
 * Accepts the invitation to a group, or the request to join one, `id` of the account, and puts the one who joins in the group (made now when the sender of an invitation had none, and its sender leads it). Answers `created` or `joined`, or throws: 404 `INVITE_GONE` (none
 * by this id for them, answered already, its sender is not their friend any more, or the group of a request has gone), 410 `INVITE_EXPIRED`, 409 `GROUP_ALREADY_IN` (the account that accepts an invitation is in another group: they leave it first), 409 `GROUP_FULL`, 409 `GROUP_UNAVAILABLE`
 * (somebody in the group blocked the one who joins it, or the one who joins blocked somebody in it: nothing says which). A refusal leaves the invitation where it was.
 */
export async function acceptGroupInvitation(account: Member, id: string): Promise<"created" | "joined"> {
  if (!(await ensureProfile(account))) throw new ApiError("GROUPS_UNAVAILABLE", 503)
  const { data, error } = await supabaseAdmin().rpc("group_accept", { p_user: account.id, p_id: id, p_max_members: MAX_GROUP_MEMBERS })
  if (error) throw error
  const outcome = outcomeOf(data, ACCEPT_OUTCOMES)
  if (outcome === "created" || outcome === "joined") return outcome
  if (outcome === "missing") throw new ApiError("INVITE_GONE", 404)
  if (outcome === "expired") throw new ApiError("INVITE_EXPIRED", 410)
  if (outcome === "in_group") throw new ApiError("GROUP_ALREADY_IN", 409)
  if (outcome === "full") throw new ApiError("GROUP_FULL", 409)
  throw new ApiError("GROUP_UNAVAILABLE", 409)
}

/** The member leaves their group. A member who is in none is as left as they can be: it answers `left` too. What follows is the database's: the lead goes to the member who has been in longest, and a group left with one member goes. */
export async function leaveGroup(userId: string): Promise<Extract<GroupResult, "left">> {
  const { data, error } = await supabaseAdmin().rpc("group_leave", { p_user: userId })
  if (error) throw error
  outcomeOf(data, LEAVE_OUTCOMES)
  return "left"
}

/** The leader removes the member who goes by this handle from their group. Answers `kicked`, or throws: 404 `GROUP_NOT_IN` (the account is in no group), 403 `GROUP_NOT_LEADER`, 404 `GROUP_MEMBER_NOT_FOUND` (nobody goes by the handle, it is their own, or they are not in the group). */
export async function removeFromGroup(userId: string, handle: Handle): Promise<Extract<GroupResult, "kicked">> {
  const { data, error } = await supabaseAdmin().rpc("group_kick", { p_user: userId, p_nickname: handle.nickname, p_tag: handle.tag })
  if (error) throw error
  const outcome = outcomeOf(data, KICK_OUTCOMES)
  if (outcome === "kicked") return "kicked"
  if (outcome === "not_in_group") throw new ApiError("GROUP_NOT_IN", 404)
  if (outcome === "not_leader") throw new ApiError("GROUP_NOT_LEADER", 403)
  throw new ApiError("GROUP_MEMBER_NOT_FOUND", 404)
}

/** The leader hands the lead over to the member who goes by this handle. Answers `led`, or throws the refusals of `removeFromGroup`. */
export async function handOverLead(userId: string, handle: Handle): Promise<Extract<GroupResult, "led">> {
  const { data, error } = await supabaseAdmin().rpc("group_lead", { p_user: userId, p_nickname: handle.nickname, p_tag: handle.tag })
  if (error) throw error
  const outcome = outcomeOf(data, LEAD_OUTCOMES)
  if (outcome === "led") return "led"
  if (outcome === "not_in_group") throw new ApiError("GROUP_NOT_IN", 404)
  if (outcome === "not_leader") throw new ApiError("GROUP_NOT_LEADER", 403)
  throw new ApiError("GROUP_MEMBER_NOT_FOUND", 404)
}

/** A group as the server needs it to put its members somewhere (a search together for a game, a table of the leader's): its id, the account that leads it and the accounts in it, the oldest first. Never sent to a browser. */
export type GroupSeats = { id: string; leader: string; members: string[] }

/** The group that an account is in, with the accounts' ids, or null: for the server only, which will seat a whole group at a table. Throws what the database says; null where migration 0027 is not applied. */
export async function readGroupOf(userId: string): Promise<GroupSeats | null> {
  const { data, error } = await supabaseAdmin().rpc("group_members_of", { p_user: userId })
  if (error) {
    if (groupsNotApplied(error)) return null
    throw error
  }
  if (typeof data !== "object" || data === null) return null
  const { id, leader, members } = data as Record<string, unknown>
  if (!isUuid(id) || !isUuid(leader) || !Array.isArray(members)) return null
  const ids = members.filter((member): member is string => isUuid(member))
  return ids.length >= 2 && ids.length === members.length ? { id, leader, members: ids } : null
}
