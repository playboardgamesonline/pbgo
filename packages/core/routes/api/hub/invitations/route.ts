import { isDemoAccount } from "@pbgo/accounts/demo"
import { getAccount } from "@pbgo/accounts/server"
import { handleOfBody } from "../../../../lib/friends"
import { INVITATION_KINDS, isInvitationId, type InvitationAction, type InvitationResult } from "../../../../lib/invitations"
import { ApiError, assertSameOrigin, handle, readJson } from "../../../../server/api"
import { askToJoinGroup, inviteToGroup } from "../../../../server/groups"
import { acceptInvitation, declineInvitation, invitationsNotApplied, sendInvitation, type InvitationDeps } from "../../../../server/invitations"
import { rateLimit } from "../../../../server/rate-limit"

/** The code of a table as a player writes it: letters and digits, a few of them (the server's own are six). */
const isTableCode = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9]{3,12}$/.test(value)

const isGameSlug = (value: unknown): value is string => typeof value === "string" && /^[a-z0-9-]{1,64}$/.test(value)

/**
 * The `POST` of one action of the invitations (PLT-109 to a table, PLT-23 to a group), under `/api/hub/invitations/<action>`:
 * - `send`: `{ nickname, tag, kind?, game?, code? }`, a friend (by their handle) and what to invite them to. `kind` is `table` (the default: `game` and `code` name the table the visitor sits at), `group` (the visitor's group, made when the friend accepts if they have none) or `join` (a request to join
 *   the friend's group, which goes to every member of it); answers `{ ok: true, result: "sent" }`. 404 `FRIEND_NOT_FOUND`, 400 `FRIEND_SELF`, 403 `INVITE_NOT_FRIEND` (never friends, removed or blocked: one answer), 409 `INVITE_LIMIT`, 409 `INVITE_UNAVAILABLE`; for a table 403 `INVITE_NOT_AT_TABLE`, 404
 *   `GAME_NOT_FOUND` (the game or the table), 409 `GAME_IN_PROGRESS` (it began), 409 `GAME_FULL`; for a group or a request the refusals of `server/groups.ts` (`GROUP_FULL`, `GROUP_ALREADY_MEMBER`, `GROUP_TARGET_IN_GROUP`, `GROUP_ALREADY_IN`, `GROUP_GONE`, `GROUP_UNAVAILABLE`). A member who blocked the sender is never told: the invitation
 *   seems to go and nothing is written.
 * - `accept`: `{ id }`, the invitation's own id (the browser has no table code until now): answers `{ ok: true, result: "accepted", kind: "table", game, code }`, the table to sit down at with the game's own join route, or `{ ok: true, result: "accepted", kind: "group" | "join" }` once the member is in the group. 404 `INVITE_GONE`, 410
 *   `INVITE_EXPIRED`, 404 `INVITE_TABLE_GONE`, 409 `INVITE_TABLE_STARTED`, 409 `INVITE_TABLE_FULL`, and for a group 409 `GROUP_ALREADY_IN`, `GROUP_FULL`, `GROUP_UNAVAILABLE`.
 * - `decline`: `{ id }`; an invitation that is gone is as declined as it can be, and a request to join that any member declines is declined for all.
 * The request must come from this site (403 `CROSS_ORIGIN`), 401 `NOT_SIGNED_IN`, 400 `INVITE_INVALID` for a body that is not one, 429 over the limits (`invitationSend`, `invitationAnswer`), 503 `INVITATIONS_UNAVAILABLE` where migration 0024 is not applied (`GROUPS_UNAVAILABLE` for a group or a request
 * where 0027 is not). The demo account of development is told it is done and nothing is written (an acceptance of its made-up invitation leads nowhere).
 */
export const postInvitation = (action: InvitationAction, deps: InvitationDeps) =>
  handle(async (request: Request): Promise<InvitationResult> => {
    assertSameOrigin(request)
    await rateLimit(null, request, action === "send" ? "invitationSend" : "invitationAnswer")
    const account = await getAccount()
    if (!account) throw new ApiError("NOT_SIGNED_IN", 401)
    const sent = await readJson<unknown>(request)
    const body: Record<string, unknown> = typeof sent === "object" && sent !== null ? (sent as Record<string, unknown>) : {}
    // What a send is for: a table when it does not say, else one of the kinds. Anything else is not an invitation
    const kind = action === "send" ? (body.kind === undefined ? "table" : INVITATION_KINDS.find((known) => known === body.kind)) : undefined
    try {
      if (action === "send") {
        const target = handleOfBody(body)
        const table = kind === "table" && isGameSlug(body.game) && isTableCode(body.code) ? { game: body.game, code: body.code } : null
        if (!target || !kind || (kind === "table" && !table)) throw new ApiError("INVITE_INVALID")
        if (isDemoAccount(account)) return { ok: true, result: "sent" }
        if (table) await sendInvitation(deps, account, target, table)
        else if (kind === "group") await inviteToGroup(account, target)
        else await askToJoinGroup(account, target)
        return { ok: true, result: "sent" }
      }
      if (!isInvitationId(body.id)) throw new ApiError("INVITE_INVALID")
      if (isDemoAccount(account)) throw new ApiError("INVITE_GONE", 404)
      if (action === "decline") return { ok: true, result: await declineInvitation(account, body.id) }
      return { ok: true, result: "accepted", ...(await acceptInvitation(deps, account, body.id)) }
    } catch (error) {
      if (invitationsNotApplied(error)) throw new ApiError(kind === "group" || kind === "join" ? "GROUPS_UNAVAILABLE" : "INVITATIONS_UNAVAILABLE", 503)
      throw error
    }
  })

