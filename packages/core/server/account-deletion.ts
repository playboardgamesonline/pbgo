import "server-only"
import { createHash, randomBytes } from "node:crypto"
import { hasMailbox } from "@pbgo/accounts"
import { accountDeletionDate, deletionLinkExpiry } from "../lib/retention"
import { removeFeedbackOf } from "./feedback-removal"
import { supabaseAdmin } from "./supabase"

// The deletion of an account (PLT-36), the server's part: what the route asks (`routes/api/hub/account/deletion`) and what the nightly clean-up does (`retention.ts`). Everything that changes state is a function of migration 0011 that
// decides in one transaction; this only hashes the token, keeps the order of the steps and reads the answers. docs/accounts.md, "Deleting an account".

/** A new token for a link: 32 random bytes in base64url, 43 characters. Only the e-mail holds it; the database keeps its hash. */
export const newDeletionToken = (): string => randomBytes(32).toString("base64url")

/** What the database keeps of a token: its SHA-256 in hex. A token is as long as a key, so its hash can be compared as it is. */
export const hashDeletionToken = (token: string): string => createHash("sha256").update(token).digest("hex")

async function call<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabaseAdmin().rpc(name, args)
  if (error) throw new Error(`${name}: ${error.message}`)
  return data as T
}

/** The answer to a request for a link: sent (here is the token to put in the e-mail), too soon after the last one, the account is on hold already, or no such account. */
export type LinkRequest = { status: "sent"; token: string; expiresAt: Date } | { status: "wait" | "on_hold" | "unknown" }

/** The account awaits the confirmation of a new link, which replaces the old one. At most one link a minute for an account. */
export async function requestDeletionLink(userId: string, now: Date = new Date(), token: string = newDeletionToken()): Promise<LinkRequest> {
  const expiresAt = deletionLinkExpiry(now)
  const status = await call<string>("request_account_deletion", { p_user: userId, p_token_hash: hashDeletionToken(token), p_expires: expiresAt.toISOString() })
  if (status === "sent") return { status, token, expiresAt }
  return { status: status === "wait" || status === "on_hold" ? status : "unknown" }
}

/** The address of the account when the link is good, else null. It changes nothing: a mail scanner that opens the link spends nothing. */
export async function peekDeletionLink(userId: string, token: string): Promise<string | null> {
  const email = await call<string | null>("peek_account_deletion", { p_user: userId, p_token_hash: hashDeletionToken(token) })
  return typeof email === "string" ? email : null
}

/** The link is confirmed: the account is ON HOLD until the day answered, signed out everywhere. Null when the link is not the one awaited, has expired or was used already. */
export async function confirmDeletion(userId: string, token: string, now: Date = new Date()): Promise<Date | null> {
  const day = await call<string | null>("confirm_account_deletion", { p_user: userId, p_token_hash: hashDeletionToken(token), p_scheduled: accountDeletionDate(now).toISOString() })
  return typeof day === "string" ? new Date(day) : null
}

/** The member keeps their account, or the link that could not be mailed is dropped: the row and the mark go. */
export async function keepAccount(userId: string): Promise<boolean> {
  return Boolean(await call<boolean>("cancel_account_deletion", { p_user: userId }))
}

/** What deleting an account did: whether the account was found and deleted, and the feedback (with its screenshots) sent with its address that went first. */
export type Erasure = { erased: boolean; feedback: number; screenshots: number }

/**
 * Deletes an account with what it holds. The feedback sent with its address goes first and the account after: once the account is gone nothing links that feedback to it any more, so a failure here keeps the account and the next night finds it again.
 * With `dueBefore`, only an account that is ON HOLD with a day that has passed by then is deleted (the clean-up); without it, whatever its state (the member chose "Delete it now").
 */
export async function eraseAccount(userId: string, email: string | null, { dueBefore }: { dueBefore?: Date } = {}): Promise<Erasure> {
  const feedback = email && hasMailbox(email) ? await removeFeedbackOf(supabaseAdmin(), email) : { deleted: 0, screenshots: 0 }
  const erased = await call<boolean>("erase_account", { p_user: userId, ...(dueBefore ? { p_due_before: dueBefore.toISOString() } : {}) })
  return { erased: Boolean(erased), feedback: feedback.deleted, screenshots: feedback.screenshots }
}

/** The accounts whose day has passed, the oldest first, with the address their feedback was sent from. */
export async function dueAccounts(before: Date, limit: number): Promise<{ userId: string; email: string | null }[]> {
  const rows = await call<{ user_id: string; email: string | null }[] | null>("due_account_deletions", { p_before: before.toISOString(), p_limit: limit })
  return (rows ?? []).map((row) => ({ userId: row.user_id, email: row.email ?? null }))
}

/** The rows of the links that stopped working before `before`, nobody confirmed them. With `dry` nothing is deleted. */
export async function purgeDeletionLinks(before: Date, dry: boolean): Promise<number> {
  const count = await call<number>("purge_deletion_links", { p_before: before.toISOString(), p_dry: dry })
  return typeof count === "number" ? count : 0
}
