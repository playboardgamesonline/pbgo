// Deleting an account (PLT-36), the pure part that the browser, the server, the proxy and the tests all read (docs/accounts.md, "Deleting an account"). A member asks from their settings, confirms with a link sent to the address
// of their account, and the account is then ON HOLD for a while (`ACCOUNT_DELETION_GRACE_DAYS` of `@pbgo/core/lib/retention`) before the nightly clean-up deletes it. An account on hold is treated as a visitor by everything that asks who
// is signed in (`getAccount`, `useAccount`, the proxy): only the sign-in page, which offers to keep it or to delete it now, and the deletion route see it.

import type { AuthUser } from "./account"

/**
 * The key of the account's `app_metadata` that says it is on hold, with the day it is deleted (an ISO date). `app_metadata` is written with the secret key alone, so a member cannot set it or clear it, which `user_metadata` allows. Migration 0011
 * writes it (`confirm_account_deletion`) and clears it (`cancel_account_deletion`) in the same transaction as the row of `account_deletions` that the nightly clean-up reads, so that the two cannot disagree.
 */
export const DELETION_KEY = "pbgo_deletion_at"

/** The page the link of the e-mail opens: outside `/me`, since the link works on any device, signed in or not. */
export const DELETION_PATH = "/auth/delete-account"

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/

/** The day an account on hold is deleted (an ISO date in UTC), or null when it is not on hold. A value that is not a date reads as none: only the server writes the key, but nothing odd ever holds an account. */
export function deletionAtOf(user: Pick<AuthUser, "app_metadata">): string | null {
  const value = user.app_metadata?.[DELETION_KEY]
  if (typeof value !== "string" || !ISO_DATE.test(value)) return null
  const time = Date.parse(value)
  return Number.isNaN(time) ? null : new Date(time).toISOString()
}

/** Whether the app metadata of a session (the user's, or the claims of its token) says the account is on hold. Anything that is not an object, or holds no date, says it is not. */
export function isOnHold(appMetadata: unknown): boolean {
  return typeof appMetadata === "object" && appMetadata !== null && deletionAtOf({ app_metadata: appMetadata as Record<string, unknown> }) !== null
}

/**
 * Whether an account has an address that mail can reach. The confirmation of the deletion is an e-mail, so an account without one cannot ask from the site: a provider that gives no address (Steam) is signed in with a stand-in
 * at the reserved top-level domain `.invalid`, which can never receive mail.
 */
export function hasMailbox(email: string | null | undefined): email is string {
  if (!email) return false
  const text = email.trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) return false
  const domain = text.slice(text.lastIndexOf("@") + 1).toLowerCase()
  return domain !== "invalid" && !domain.endsWith(".invalid")
}

/** An address as the page of the link and the dialog say it: the first letter, three dots and the domain (`ore@example.com` → `o•••@example.com`). */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@")
  if (at < 1) return "•••"
  return `${Array.from(email.slice(0, at))[0]}•••${email.slice(at)}`
}

/** An account id, as Supabase Auth writes one. */
export const isUserId = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)

/** The token of a link: 32 random bytes in base64url, 43 characters (`newDeletionToken` of `@pbgo/core/server/account-deletion`). */
export const isDeletionToken = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value)

/** The address the link of the e-mail points to: the page, the account and the token, which only that e-mail holds. `origin` is the site's, with or without a trailing slash. */
export function deletionLink(origin: string, userId: string, token: string): string {
  return `${origin.replace(/\/+$/, "")}${DELETION_PATH}?u=${encodeURIComponent(userId)}&t=${encodeURIComponent(token)}`
}

/** The account and the token of a link, read from the query of the page it opens, or null when either is not what a link carries. */
export function deletionLinkOf(query: { u?: string | string[]; t?: string | string[] }): { user: string; token: string } | null {
  const user = Array.isArray(query.u) ? query.u[0] : query.u
  const token = Array.isArray(query.t) ? query.t[0] : query.t
  return isUserId(user) && isDeletionToken(token) ? { user, token } : null
}

/** What the browser asks of `POST /api/hub/account/deletion`. */
export type DeletionRequest = { intent: "request" } | { intent: "confirm"; user: string; token: string } | { intent: "keep" } | { intent: "now" }

/** What the route answers when it worked: `to` (the address the link went to, masked) for `request`, `scheduledFor` (an ISO date) for `confirm`. */
export type DeletionAnswer = { ok: true; to?: string; scheduledFor?: string }

/** The sentence a member is told for each code the route refuses with: never the server's own words. */
export const DELETION_MESSAGES: Record<string, string> = {
  NOT_SIGNED_IN: "You are signed out. Sign in again to delete your account.",
  NO_MAILBOX: "Your account has no e-mail address, so we cannot send the link.",
  MAIL_UNAVAILABLE: "Deleting an account is not available right now. Try again later.",
  MAIL_FAILED: "We could not send the e-mail. Try again in a few minutes.",
  WAIT: "A link was sent a moment ago. Wait a minute before asking for another.",
  ON_HOLD: "Your account is already waiting to be deleted.",
  NOT_ON_HOLD: "Your account is not waiting to be deleted.",
  LINK_INVALID: "This link has expired or was already used. Ask for a new one in your settings.",
  RATE_LIMITED: "Too many attempts. Wait a few minutes and try again.",
  INVALID_REQUEST: "Something went wrong. Try again.",
  CROSS_ORIGIN: "Something went wrong. Try again.",
}

/** The sentence for a code, or a plain one for a code nobody planned. */
export function deletionMessage(code: string | undefined): string {
  return (code && DELETION_MESSAGES[code]) || "Something went wrong. Try again."
}

/** A date as the pages say it: `9 December 2026`, in UTC, since the clean-up runs on UTC days. */
export function deletionDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
}
