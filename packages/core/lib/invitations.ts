import { personOf, type Person } from "./friends"

/**
 * The invitations (PLT-109 to a table, PLT-23 to a group and requests to join one): the limits, what the routes are called, what the browser is told and how it reads it. Pure, with nothing of the server in it (`server/invitations.ts` keeps what the database does,
 * `routes/api/hub/invitations/route.ts` the routes). A member is named by their handle, never by their account's id, and the table by its game and code alone when its host sends the invitation: the invitation itself is named by its own id, so that the code
 * of a table never reaches a member who was not given it (the friend is told it when they accept).
 */

/** How long an invitation waits for an answer. A lobby is short-lived, and an invitation that is hours old brings somebody to a table that is not the one it was for. */
export const INVITATION_TTL_MINUTES = 30
/** How many invitations a member can have out at once (waiting for an answer). */
export const MAX_INVITATIONS_SENT = 20
/** How many invitations can wait for a member's answer at once. A friend who has this many waiting is refused. */
export const MAX_INVITATIONS_RECEIVED = 20

export const INVITATIONS_PATH = "/api/hub/invitations"
export const INVITATION_ACTIONS = ["send", "accept", "decline"] as const
export type InvitationAction = (typeof INVITATION_ACTIONS)[number]
export const invitationActionPath = (action: InvitationAction): string => `${INVITATIONS_PATH}/${action}`

/**
 * What an invitation is for. The invitations to a group (PLT-23) are the same mechanism as the invitations to a table: `table` invites a friend to the lobby the sender sits at; `group` invites a friend to the sender's group (any member may invite, and the group is
 * made when the friend accepts, if the sender has none); `join` is a request to join the group of a friend, sent to every member of it so that any of them can answer (the first answer is everybody's).
 */
export const INVITATION_KINDS = ["table", "group", "join"] as const
export type InvitationKind = (typeof INVITATION_KINDS)[number]

/** The kind that a word says, `table` for any other: an answer of an older server has none. */
export const invitationKindOf = (value: unknown): InvitationKind => INVITATION_KINDS.find((kind) => kind === value) ?? "table"

type InvitationBase = { id: string; from: Person; at: string; expiresAt: string }

/** An invitation that waits for the member's answer, as the browser is told it: who sent it, when it was sent and when it stops being good (ISO dates). `id` is the invitation's own: never the table. An invitation to a table names the game (its slug and the name the hub gives it). */
export type InvitationEntry = (InvitationBase & { kind: "table"; game: { slug: string; name: string } }) | (InvitationBase & { kind: "group" | "join" })

/** The id of an invitation: what a route is given to answer one. A UUID, as the database makes it. */
export const isInvitationId = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)

/** An invitation as the wire says one, or null: a browser never draws what the server did not mean to send. */
export function invitationOf(value: unknown): InvitationEntry | null {
  if (typeof value !== "object" || value === null) return null
  const { id, from, game, at, expiresAt, kind } = value as Record<string, unknown>
  const person = personOf(from)
  if (!isInvitationId(id) || !person || typeof at !== "string" || Number.isNaN(Date.parse(at)) || typeof expiresAt !== "string" || Number.isNaN(Date.parse(expiresAt))) return null
  const base = { id, from: person, at, expiresAt }
  const which = invitationKindOf(kind)
  if (which !== "table") return { ...base, kind: which }
  const named = typeof game === "object" && game !== null ? (game as Record<string, unknown>) : null
  if (!named || typeof named.slug !== "string" || named.slug === "" || typeof named.name !== "string") return null
  return { ...base, kind: "table", game: { slug: named.slug, name: named.name } }
}

/**
 * What a route says it did: the invitation was sent, or answered. An accepted invitation to a table says the table to go to; an accepted invitation to a group, or request to join one, says only which it was (the member is in the group when it is answered, and the social state
 * says who is in it).
 */
export type InvitationResult =
  | { ok: true; result: "sent" | "declined" }
  | { ok: true; result: "accepted"; kind: "table"; game: string; code: string }
  | { ok: true; result: "accepted"; kind: "group" | "join" }

/** The invitations still good at `now` (an ISO date comes from the server's clock, the browser's may differ a little: a minute of grace never shows an invitation that is long gone). */
export const livingInvitations = (list: readonly InvitationEntry[], now: number = Date.now()): InvitationEntry[] => list.filter((entry) => Date.parse(entry.expiresAt) + 60_000 > now)
