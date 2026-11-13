import { isDemoAccount } from "@pbgo/accounts/demo"
import { getAccount } from "@pbgo/accounts/server"
import { handleOfBody } from "../../../../lib/friends"
import { isInvitationId, type InvitationAction, type InvitationResult } from "../../../../lib/invitations"
import { ApiError, assertSameOrigin, handle, readJson } from "../../../../server/api"
import { acceptInvitation, declineInvitation, invitationsNotApplied, sendInvitation, type InvitationDeps } from "../../../../server/invitations"
import { rateLimit } from "../../../../server/rate-limit"

/** The code of a table as a player writes it: letters and digits, a few of them (the server's own are six). */
const isTableCode = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9]{3,12}$/.test(value)

const isGameSlug = (value: unknown): value is string => typeof value === "string" && /^[a-z0-9-]{1,64}$/.test(value)

/**
 * The `POST` of one action of the invitations to a table (PLT-109), under `/api/hub/invitations/<action>`:
 * - `send`: `{ nickname, tag, game, code }`, a friend (by their handle) and the table the visitor sits at; answers `{ ok: true, result: "sent" }`. 404 `FRIEND_NOT_FOUND`, 400 `FRIEND_SELF`, 403 `INVITE_NOT_FRIEND` (never friends, removed or blocked: one answer), 403 `INVITE_NOT_AT_TABLE`,
 *   404 `GAME_NOT_FOUND` (the game or the table), 409 `GAME_IN_PROGRESS` (it began), 409 `GAME_FULL`, 409 `INVITE_LIMIT`, 409 `INVITE_UNAVAILABLE`. A friend who blocked the sender is never told: the invitation seems to go and nothing is written.
 * - `accept`: `{ id }`, the invitation's own id (the browser has no table code until now): answers `{ ok: true, result: "accepted", game, code }`, the table to sit down at with the game's own join route. 404 `INVITE_GONE`, 410 `INVITE_EXPIRED`, 404 `INVITE_TABLE_GONE`,
 *   409 `INVITE_TABLE_STARTED`, 409 `INVITE_TABLE_FULL`.
 * - `decline`: `{ id }`; an invitation that is gone is as declined as it can be.
 * The request must come from this site (403 `CROSS_ORIGIN`), 401 `NOT_SIGNED_IN`, 400 `INVITE_INVALID` for a body that is not one, 429 over the limits (`invitationSend`, `invitationAnswer`), 503 `INVITATIONS_UNAVAILABLE` where migration 0023 is not applied. The demo account of
 * development is told it is done and nothing is written (an acceptance of its made-up invitation leads nowhere).
 */
export const postInvitation = (action: InvitationAction, deps: InvitationDeps) =>
  handle(async (request: Request): Promise<InvitationResult> => {
    assertSameOrigin(request)
    await rateLimit(null, request, action === "send" ? "invitationSend" : "invitationAnswer")
    const account = await getAccount()
    if (!account) throw new ApiError("NOT_SIGNED_IN", 401)
    const sent = await readJson<unknown>(request)
    const body: Record<string, unknown> = typeof sent === "object" && sent !== null ? (sent as Record<string, unknown>) : {}
    try {
      if (action === "send") {
        const target = handleOfBody(body)
        if (!target || !isGameSlug(body.game) || !isTableCode(body.code)) throw new ApiError("INVITE_INVALID")
        if (isDemoAccount(account)) return { ok: true, result: "sent" }
        await sendInvitation(deps, account, target, { game: body.game, code: body.code })
        return { ok: true, result: "sent" }
      }
      if (!isInvitationId(body.id)) throw new ApiError("INVITE_INVALID")
      if (isDemoAccount(account)) throw new ApiError("INVITE_GONE", 404)
      if (action === "decline") return { ok: true, result: await declineInvitation(account, body.id) }
      return { ok: true, result: "accepted", ...(await acceptInvitation(deps, account, body.id)) }
    } catch (error) {
      if (invitationsNotApplied(error)) throw new ApiError("INVITATIONS_UNAVAILABLE", 503)
      throw error
    }
  })

