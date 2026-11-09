import { deletionLink, hasMailbox, isDeletionToken, isUserId, maskEmail, type DeletionAnswer } from "@pbgo/accounts"
import { isDemoAccount } from "@pbgo/accounts/demo"
import { createAuthClient, getAccount, getHeldAccount } from "@pbgo/accounts/server"
import type { MailMessage } from "../../../../../lib/deletion-mail"
import { confirmDeletion, eraseAccount, keepAccount, requestDeletionLink } from "../../../../../server/account-deletion"
import { ApiError, handle, readJson } from "../../../../../server/api"
import { mailAvailable, sendMail } from "../../../../../server/mail"
import { rateLimit } from "../../../../../server/rate-limit"

/** What the app tells the route to compose: the member's address and name, and the link (whose token only the e-mail holds). */
export type ComposeDeletionMail = (input: { to: string; name: string; link: string }) => MailMessage

/** A request that changes an account on the strength of its cookie must come from this site: a browser says where a request comes from, and a form of another site is refused. A client that says nothing is a script, which has no cookie of ours to abuse. */
function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin")
  if (origin && origin !== new URL(request.url).origin) throw new ApiError("CROSS_ORIGIN", 403)
}

/**
 * `POST /api/hub/account/deletion`: the deletion of an account (PLT-36, `docs/accounts.md`, "Deleting an account"). It is not a game's route. The body says what is asked (`intent`):
 * - `request`: the signed-in member asks for the e-mail that confirms it. A link is made (the database keeps the hash of its token and when it stops working: at most one a minute) and mailed to the address of the account, which is taken from the session,
 *   never from the request; a member without an address cannot ask. An e-mail that could not leave takes the link back, so that a second try is not held up.
 * - `confirm`: the link of the e-mail, with the account and the token it carries. No session is needed (the link opens on any device): the token is the proof, and it works once. The account goes on hold for `ACCOUNT_DELETION_GRACE_DAYS` days and every
 *   session of it ends.
 * - `keep`: the member signed in to an account on hold keeps it. Its session is renewed here, so that the next page already sees an account that is not on hold.
 * - `now`: the same member deletes it now, with the feedback sent with its address; the cookies of the session go.
 * `request`, `keep` and `now` act on the strength of the session's cookies, so they refuse a request that comes from another site. The demo account of development is in no database: it can do none of this.
 */
export function deletionRoute(compose: ComposeDeletionMail) {
  return handle(async (request: Request) => {
    await rateLimit(null, request, "accountDeletion")
    const body = await readJson<Record<string, unknown>>(request)
    switch (body.intent) {
      case "request":
        return requestLink(request, compose)
      case "confirm":
        return confirmLink(body)
      case "keep":
        return keep(request)
      case "now":
        return deleteNow(request)
      default:
        throw new ApiError("INVALID_REQUEST")
    }
  })
}

async function requestLink(request: Request, compose: ComposeDeletionMail): Promise<DeletionAnswer> {
  assertSameOrigin(request)
  const account = await getAccount()
  if (!account || isDemoAccount(account)) throw new ApiError("NOT_SIGNED_IN", 401)
  if (!hasMailbox(account.email)) throw new ApiError("NO_MAILBOX", 409)
  if (!mailAvailable()) throw new ApiError("MAIL_UNAVAILABLE", 503)

  const link = await requestDeletionLink(account.id)
  if (link.status !== "sent") {
    if (link.status === "wait") throw new ApiError("WAIT", 429, { "Retry-After": "60" })
    if (link.status === "on_hold") throw new ApiError("ON_HOLD", 409)
    throw new ApiError("NOT_SIGNED_IN", 401)
  }

  // The link points to the site the member is on: a preview deployment holds its own accounts, and the link would mean nothing on another site
  const message = compose({ to: account.email, name: account.nickname, link: deletionLink(new URL(request.url).origin, account.id, link.token) })
  const sent = await sendMail(message)
  if (sent === "unavailable" || sent === "failed") {
    await keepAccount(account.id)
    throw new ApiError(sent === "failed" ? "MAIL_FAILED" : "MAIL_UNAVAILABLE", sent === "failed" ? 502 : 503)
  }
  return { ok: true, to: maskEmail(account.email) }
}

async function confirmLink(body: Record<string, unknown>): Promise<DeletionAnswer> {
  if (!isUserId(body.user) || !isDeletionToken(body.token)) throw new ApiError("INVALID_REQUEST")
  const day = await confirmDeletion(body.user, body.token)
  if (!day) throw new ApiError("LINK_INVALID", 410)
  return { ok: true, scheduledFor: day.toISOString() }
}

async function keep(request: Request): Promise<DeletionAnswer> {
  assertSameOrigin(request)
  const held = await getHeldAccount()
  if (!held || isDemoAccount(held)) throw new ApiError("NOT_ON_HOLD", 409)
  await keepAccount(held.id)
  // The token of the session still carries the mark until it is renewed: renew it now, so that the cookies the browser gets are those of an account that is not on hold. Best effort: the proxy asks the Auth server whenever the claims say "on hold"
  try {
    await (await createAuthClient())?.auth.refreshSession()
  } catch {}
  return { ok: true }
}

async function deleteNow(request: Request): Promise<DeletionAnswer> {
  assertSameOrigin(request)
  const held = await getHeldAccount()
  if (!held || isDemoAccount(held)) throw new ApiError("NOT_ON_HOLD", 409)
  await eraseAccount(held.id, held.email)
  // The session went with the account; this takes the cookies of the browser with it
  try {
    await (await createAuthClient())?.auth.signOut({ scope: "local" })
  } catch {}
  return { ok: true }
}
