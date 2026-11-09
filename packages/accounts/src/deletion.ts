// Deleting an account (PLT-36), the pure part that the browser, the server and the tests all read (docs/accounts.md, "Deleting an account"). A member deletes their account from their settings and it is CLOSED at once: nobody can
// sign in to it, and every session of it ends. The site e-mails the address of the account a link that REOPENS it, which works for a few days (`ACCOUNT_DELETION_GRACE_DAYS` of `@pbgo/core/lib/retention`), and when that time is over the nightly clean-up deletes the
// account for good. What the member is told, the link and the shapes of what the browser asks are here.

/** The page the link of the e-mail opens: outside `/me`, since the link works on any device, signed in or not. */
export const REOPEN_PATH = "/auth/reopen-account"

/**
 * Whether an account has an address that mail can reach. The link that reopens a closed account is an e-mail, so an account without one cannot be closed from the site: a provider that gives no address (Steam) is signed in with a stand-in
 * at the reserved top-level domain `.invalid`, which can never receive mail.
 */
export function hasMailbox(email: string | null | undefined): email is string {
  if (!email) return false
  const text = email.trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) return false
  const domain = text.slice(text.lastIndexOf("@") + 1).toLowerCase()
  return domain !== "invalid" && !domain.endsWith(".invalid")
}

/** An address as the pages say it: the first letter, three dots and the domain (`ore@example.com` → `o•••@example.com`). */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@")
  if (at < 1) return "•••"
  return `${Array.from(email.slice(0, at))[0]}•••${email.slice(at)}`
}

/** An account id, as Supabase Auth writes one. */
export const isUserId = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)

/** The token of a link: 32 random bytes in base64url, 43 characters (`newReopenToken` of `@pbgo/core/server/account-deletion`). */
export const isReopenToken = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value)

/** The address the link of the e-mail points to: the page, the account and the token, which only that e-mail holds. `origin` is the site's, with or without a trailing slash. */
export function reopenLink(origin: string, userId: string, token: string): string {
  return `${origin.replace(/\/+$/, "")}${REOPEN_PATH}?u=${encodeURIComponent(userId)}&t=${encodeURIComponent(token)}`
}

/** The account and the token of a link, read from the query of the page it opens, or null when either is not what a link carries. */
export function reopenLinkOf(query: { u?: string | string[]; t?: string | string[] }): { user: string; token: string } | null {
  const user = Array.isArray(query.u) ? query.u[0] : query.u
  const token = Array.isArray(query.t) ? query.t[0] : query.t
  return isUserId(user) && isReopenToken(token) ? { user, token } : null
}

/**
 * What the browser asks of `POST /api/hub/account/deletion`: `close` (the signed-in member deletes their account), then, from the page of the link, which needs no session since the token is the proof, `reopen` (the account is open again) and
 * `now` (the member does not wait: it is deleted right away).
 */
export type DeletionRequest = { intent: "close" } | { intent: "reopen"; user: string; token: string } | { intent: "now"; user: string; token: string }

/** What the route answers when it worked: for `close`, `to` (the address the link went to, masked) and `scheduledFor` (an ISO date: the day the link stops working and the account is deleted). */
export type DeletionAnswer = { ok: true; to?: string; scheduledFor?: string }

/** The sentence a member is told for each code the route refuses with: never the server's own words. */
export const DELETION_MESSAGES: Record<string, string> = {
  NOT_SIGNED_IN: "You are signed out. Sign in again to delete your account.",
  NO_MAILBOX: "Your account has no e-mail address, so we cannot send you the link that reopens it.",
  MAIL_UNAVAILABLE: "Deleting an account is not available right now. Try again later.",
  MAIL_FAILED: "We could not send the e-mail, so your account is still open. Try again in a few minutes.",
  LINK_INVALID: "This link no longer works.",
  RATE_LIMITED: "Too many attempts. Wait a few minutes and try again.",
  INVALID_REQUEST: "Something went wrong. Try again.",
  CROSS_ORIGIN: "Something went wrong. Try again.",
}

/** The sentence for a code, or a plain one for a code nobody planned. */
export function deletionMessage(code: string | undefined): string {
  return (code && DELETION_MESSAGES[code]) || "Something went wrong. Try again."
}

/** A date as the pages say it: `16 November 2026`, in UTC, since the days of the clean-up are UTC days. */
export function deletionDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
}
