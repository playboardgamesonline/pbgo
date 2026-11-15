import { MAX_SEATS } from "@pbgo/ui/tables"
import { personOf, type FriendGame, type FriendPhase, type Person } from "./friends"

/**
 * The groups of the hub (PLT-23): the cap, what the routes are called, what the browser is told and how it reads it. Pure, with nothing of the server in it (`server/groups.ts` keeps what the database does, `routes/api/hub/groups/route.ts` the routes of leaving, removing and
 * handing the lead over; inviting to a group and asking to join one go through the invitations, `lib/invitations.ts`). A member is named by their handle, never by their account's id. A group has two to nine members, one of whom leads; a group of one person is no group.
 */

/** The most members a group can have, the one who leads included: the most seats a table has (`MAX_SEATS`), so that a whole group can sit at one. The database is given it by each function that adds a member. */
export const MAX_GROUP_MEMBERS = MAX_SEATS

/** The routes of the group, under `/api/hub/groups`: the group itself comes with the social state (`GET /api/hub/friends`), and each of these is a `POST` that changes it. */
export const GROUPS_PATH = "/api/hub/groups"
export const GROUP_ACTIONS = ["leave", "kick", "lead"] as const
export type GroupAction = (typeof GROUP_ACTIONS)[number]
export const groupActionPath = (action: GroupAction): string => `${GROUPS_PATH}/${action}`

/** What an action did, which the route answers (`{ "ok": true, "result": … }`): the member left their group, the leader removed a member, or handed the lead over. */
export type GroupResult = "left" | "kicked" | "led"

/** A member of the visitor's group as the browser is told it: who they are, whether they lead, whether they are the visitor themselves, whether they are online and the game they are at, if they are. Never the table. */
export type GroupMemberEntry = Person & { leader: boolean; you: boolean; online: boolean; game: FriendGame | null; phase: FriendPhase | null }

/** The visitor's group, the leader first and then the members in the order they came. */
export type GroupEntry = { members: GroupMemberEntry[] }

/** How a friend stands as to groups, as the browser is told it: in the visitor's own group, in another one, or in none. */
export type FriendGroupRelation = "none" | "yours" | "other"

/** What waits for a friend's answer: the visitor invited them to their group, or asked to join theirs. */
export type FriendPending = "invited" | "requested"

/** Whether a value is an id as the database makes them (a UUID): a group's, an account's. They are the server's: only a route reads them, never a browser. */
export const isUuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)

/** The relation that a word says, `none` for any other. */
export const groupRelationOf = (value: unknown): FriendGroupRelation => (value === "yours" || value === "other" ? value : "none")

/** The pending state that a word says, null for any other. */
export const pendingOf = (value: unknown): FriendPending | null => (value === "invited" || value === "requested" ? value : null)

function memberOf(value: unknown): GroupMemberEntry | null {
  const person = personOf(value)
  if (!person) return null
  const { leader, you, online, game, phase } = value as Record<string, unknown>
  if (typeof leader !== "boolean" || typeof you !== "boolean" || typeof online !== "boolean") return null
  const gameOf = typeof game === "object" && game !== null ? (game as Record<string, unknown>) : null
  const named = gameOf && typeof gameOf.slug === "string" && typeof gameOf.name === "string" && gameOf.slug !== "" ? { slug: gameOf.slug, name: gameOf.name } : null
  const where = phase === "lobby" || phase === "playing" ? phase : null
  // A member is shown at a game only while they are online and the game is one that has a name; the phase goes with it
  return { ...person, leader, you, online, game: online && named && where ? named : null, phase: online && named && where ? where : null }
}

/**
 * The group that an answer of `GET /api/hub/friends` says, or null when there is none or it is not one: a group has at least two members, and one of them is the visitor. A member that is not what it should be is left out, and a group that is then too small is nobody's:
 * a browser never draws what the server did not mean to send.
 */
export function groupEntryOf(value: unknown): GroupEntry | null {
  if (typeof value !== "object" || value === null) return null
  const { members } = value as Record<string, unknown>
  if (!Array.isArray(members)) return null
  const read = members.flatMap((member) => memberOf(member) ?? [])
  return read.length >= 2 && read.some((member) => member.you) ? { members: read } : null
}

/** Whether the visitor leads the group they are in. */
export const youLeadGroup = (group: GroupEntry | null): boolean => group?.members.some((member) => member.you && member.leader) ?? false
