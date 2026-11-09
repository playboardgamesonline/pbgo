import { deletionDate, hasMailbox, isReopenToken, isUserId, maskEmail, reopenLink, type DeletionAnswer } from "@pbgo/accounts"
import { isDemoAccount } from "@pbgo/accounts/demo"
import { clearSessionCookies, getAccount } from "@pbgo/accounts/server"
import { accountDeletionDate } from "../../../../../lib/retention"
import type { DeletionMailInput, MailMessage } from "../../../../../lib/deletion-mail"
import { closeAccount, eraseAccount, newReopenToken, peekReopenLink, reopenAccount } from "../../../../../server/account-deletion"
import { ApiError, handle, readJson } from "../../../../../server/api"
import { mailAvailable, sendMail } from "../../../../../server/mail"
import { rateLimit } from "../../../../../server/rate-limit"

/** What the app tells the route to compose: the member's address and name, the link (whose token only the e-mail holds) and the day it works until. */
export type ComposeDeletionMail = (input: DeletionMailInput) => MailMessage

/** A request that changes an account on the strength of its cookie must come from this site: a browser says where a request comes from, and a form of another site is refused. A client that says nothing is a script, which has no cookie of ours to abuse. */
function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin")
  if (origin && origin !== new URL(request.url).origin) throw new ApiError("CROSS_ORIGIN", 403)
}

/**
 * `POST /api/hub/account/deletion`: the deletion of an account (PLT-36, `docs/accounts.md`, "Deleting an account"). It is not a game's route. The body says what is asked (`intent`):
 * - `close`: the signed-in member deletes their account. The e-mail that holds the link goes first, to the address of the account, which is taken from the session and never from the request (a member without an address cannot ask), and the account
 *   is closed only once it has left: nobody can sign in to it, every session of it ends and the cookies of this device go. The link reopens it until the day answered (`ACCOUNT_DELETION_GRACE_DAYS` days at least), then the nightly clean-up deletes it.
 * - `reopen`: the link of the e-mail, with the account and the token it carries. No session is needed (the link opens on any device, and a closed account has none): the token is the proof. The account is open again.
 * - `now`: the same link, and the member does not wait for the clean-up: the account is deleted right away, with the feedback sent with its address.
 * `close` acts on the strength of the session's cookies, so it refuses a request that comes from another site. The demo account of development is in no database: it can do none of this.
 */
export function deletionRoute(compose: ComposeDeletionMail) {
  return handle(async (request: Request) => {
    await rateLimit(null, request, "accountDeletion")
    const body = await readJson<Record<string, unknown>>(request)
    switch (body.intent) {
      case "close":
        return close(request, compose)
      case "reopen":
        return reopen(body)
      case "now":
        return deleteNow(body)
      default:
        throw new ApiError("INVALID_REQUEST")
    }
  })
}

async function close(request: Request, compose: ComposeDeletionMail): Promise<DeletionAnswer> {
  assertSameOrigin(request)
  const account = await getAccount()
  if (!account || isDemoAccount(account)) throw new ApiError("NOT_SIGNED_IN", 401)
  if (!hasMailbox(account.email)) throw new ApiError("NO_MAILBOX", 409)
  if (!mailAvailable()) throw new ApiError("MAIL_UNAVAILABLE", 503)

  const token = newReopenToken()
  const reopensUntil = accountDeletionDate()
  // The e-mail first, so that an account is never closed with no way back: one that could not leave leaves the account open and says so. The link points to the site the member is on: a preview deployment holds its own accounts, and the link would
  // mean nothing on another site
  const sent = await sendMail(
    compose({
      to: account.email,
      name: account.nickname,
      link: reopenLink(new URL(request.url).origin, account.id, token),
      until: deletionDate(reopensUntil.toISOString()),
    }),
  )
  if (sent === "unavailable" || sent === "failed") throw new ApiError(sent === "failed" ? "MAIL_FAILED" : "MAIL_UNAVAILABLE", sent === "failed" ? 502 : 503)

  const day = await closeAccount(account.id, token, reopensUntil)
  if (!day) throw new ApiError("NOT_SIGNED_IN", 401)
  // The sessions ended with the account; this takes the cookies of this browser with them
  await clearSessionCookies()
  return { ok: true, to: maskEmail(account.email), scheduledFor: day.toISOString() }
}

/** The account and the token of a link, or the refusal for anything that is not what a link carries (before the database is asked anything). */
function linkOf(body: Record<string, unknown>): { user: string; token: string } {
  if (!isUserId(body.user) || !isReopenToken(body.token)) throw new ApiError("INVALID_REQUEST")
  return { user: body.user, token: body.token }
}

async function reopen(body: Record<string, unknown>): Promise<DeletionAnswer> {
  const { user, token } = linkOf(body)
  if (!(await reopenAccount(user, token))) throw new ApiError("LINK_INVALID", 410)
  return { ok: true }
}

async function deleteNow(body: Record<string, unknown>): Promise<DeletionAnswer> {
  const { user, token } = linkOf(body)
  // The token proves who asks: it is looked at before anything is deleted, since `erase_account` itself takes anyone's id
  const link = await peekReopenLink(user, token)
  if (!link) throw new ApiError("LINK_INVALID", 410)
  await eraseAccount(user, link.email)
  return { ok: true }
}
