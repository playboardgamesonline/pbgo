import { personOf, type Person } from "./friends"

/**
 * The invitations to a table (PLT-109): the limits, what the routes are called, what the browser is told and how it reads it. Pure, with nothing of the server in it (`server/invitations.ts` keeps what the database does,
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

/** An invitation that waits for the member's answer, as the browser is told it: who sent it, the game (its slug and the name the hub gives it), when it was sent and when it stops being good (ISO dates). `id` is the invitation's own: never the table. */
export type InvitationEntry = { id: string; from: Person; game: { slug: string; name: string }; at: string; expiresAt: string }

/** The id of an invitation: what a route is given to answer one. A UUID, as the database makes it. */
export const isInvitationId = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)

/** An invitation as the wire says one, or null: a browser never draws what the server did not mean to send. */
export function invitationOf(value: unknown): InvitationEntry | null {
  if (typeof value !== "object" || value === null) return null
  const { id, from, game, at, expiresAt } = value as Record<string, unknown>
  const person = personOf(from)
  const named = typeof game === "object" && game !== null ? (game as Record<string, unknown>) : null
  if (!isInvitationId(id) || !person || !named || typeof named.slug !== "string" || named.slug === "" || typeof named.name !== "string") return null
  if (typeof at !== "string" || Number.isNaN(Date.parse(at)) || typeof expiresAt !== "string" || Number.isNaN(Date.parse(expiresAt))) return null
  return { id, from: person, game: { slug: named.slug, name: named.name }, at, expiresAt }
}

/** What a route says it did: the invitation was sent, or answered, with the table to go to for an accepted one. */
export type InvitationResult = { ok: true; result: "sent" | "declined" } | { ok: true; result: "accepted"; game: string; code: string }

/** The invitations still good at `now` (an ISO date comes from the server's clock, the browser's may differ a little: a minute of grace never shows an invitation that is long gone). */
export const livingInvitations = (list: readonly InvitationEntry[], now: number = Date.now()): InvitationEntry[] => list.filter((entry) => Date.parse(entry.expiresAt) + 60_000 > now)
