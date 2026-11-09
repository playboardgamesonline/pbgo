import "server-only"
import { createHash, randomBytes } from "node:crypto"
import { hasMailbox } from "@pbgo/accounts"
import { removeFeedbackOf } from "./feedback-removal"
import { supabaseAdmin } from "./supabase"

// The deletion of an account (PLT-36), the server's part: what the route asks (`routes/api/hub/account/deletion`) and what the nightly clean-up does (`retention.ts`). Everything that changes state is a function of migration 0011 that
// decides in one transaction; this only hashes the token, keeps the order of the steps and reads the answers. docs/accounts.md, "Deleting an account".

/** A new token for a link: 32 random bytes in base64url, 43 characters. Only the e-mail holds it; the database keeps its hash. */
export const newReopenToken = (): string => randomBytes(32).toString("base64url")

/** What the database keeps of a token: its SHA-256 in hex. A token is as long as a key, so its hash can be compared as it is. */
export const hashReopenToken = (token: string): string => createHash("sha256").update(token).digest("hex")

async function call<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabaseAdmin().rpc(name, args)
  if (error) throw new Error(`${name}: ${error.message}`)
  return data as T
}

/**
 * The account is closed: nobody can sign in to it, every session of it ends, and the link whose token this is reopens it until `reopensUntil`, when the nightly clean-up deletes it. The e-mail that holds the token is sent before this is
 * called, so that an account is never closed with no way back. Answers the day, or null when there is no such account or it is closed already.
 */
export async function closeAccount(userId: string, token: string, reopensUntil: Date): Promise<Date | null> {
  const day = await call<string | null>("close_account", { p_user: userId, p_token_hash: hashReopenToken(token), p_scheduled: reopensUntil.toISOString() })
  return typeof day === "string" ? new Date(day) : null
}

/** What a good link shows: the address of the closed account (null when it has none) and the day the link stops working. */
export type ReopenLink = { email: string | null; reopensUntil: Date }

/** What the link is worth, or null when it is not the one of a closed account or its day has passed. It changes nothing: a mail scanner that opens the link spends nothing. */
export async function peekReopenLink(userId: string, token: string): Promise<ReopenLink | null> {
  const rows = await call<{ email: string | null; scheduled_for: string }[] | null>("peek_reopen_link", { p_user: userId, p_token_hash: hashReopenToken(token) })
  const row = rows?.[0]
  return row ? { email: row.email ?? null, reopensUntil: new Date(row.scheduled_for) } : null
}

/** The member follows the link: the account is open again, with the ban it had before (none, as a rule). False when the link is not the one of a closed account, or its day has passed. */
export async function reopenAccount(userId: string, token: string): Promise<boolean> {
  return Boolean(await call<boolean>("reopen_account", { p_user: userId, p_token_hash: hashReopenToken(token) }))
}

/** What deleting an account did: whether the account was found and deleted, and the feedback (with its screenshots) sent with its address that went first. */
export type Erasure = { erased: boolean; feedback: number; screenshots: number }

/**
 * Deletes an account with what it holds. The feedback sent with its address goes first and the account after: once the account is gone nothing links that feedback to it any more, so a failure here keeps the account and the next night finds it again.
 * With `dueBefore`, only an account that is closed with a day that has passed by then is deleted (the clean-up); without it, whatever its state (the member chose "Delete it now").
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
