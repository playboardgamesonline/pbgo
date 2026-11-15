import { isDemoAccount } from "@pbgo/accounts/demo"
import { getAccount } from "@pbgo/accounts/server"
import { handleOfBody } from "../../../../lib/friends"
import type { GroupAction, GroupResult } from "../../../../lib/groups"
import { ApiError, assertSameOrigin, handle, readJson } from "../../../../server/api"
import { groupsNotApplied, handOverLead, leaveGroup, removeFromGroup } from "../../../../server/groups"
import { rateLimit } from "../../../../server/rate-limit"

/** What the demo account is told: the action is done, and nothing is written. */
const DEMO_RESULTS: Record<GroupAction, GroupResult> = { leave: "left", kick: "kicked", lead: "led" }

/**
 * The `POST` of one action of the member's group (PLT-23), under `/api/hub/groups/<action>`: `leave` (their group), `kick` (the leader removes a member) and `lead` (the leader hands the lead over). `leave` takes `{}`; the others name the member by their handle,
 * `{ "nickname": "Alex", "tag": 42 }`, and answer `{ "ok": true, "result": "left" | "kicked" | "led" }`. Inviting to a group and asking to join one are invitations (`POST /api/hub/invitations/send`, `kind` `group` and `join`), and the group itself comes with the social state
 * (`GET /api/hub/friends`). The request must come from this site (403 `CROSS_ORIGIN`), 401 `NOT_SIGNED_IN`, 400 `GROUP_INVALID` for a handle that cannot be anybody's, 429 over the limit (`groupAction`), and the refusals of `kick` and `lead` (`server/groups.ts`): 404 `GROUP_NOT_IN` (they are
 * in no group), 403 `GROUP_NOT_LEADER`, 404 `GROUP_MEMBER_NOT_FOUND` (nobody goes by the handle, it is their own, or they are not in the group); 503 `GROUPS_UNAVAILABLE` where migration 0027 is not applied. A member who is in no group has left it already: `leave` answers `left` for them.
 * The demo account of development is told it is done and nothing is written.
 */
export const postGroup = (action: GroupAction) =>
  handle(async (request: Request): Promise<{ ok: true; result: GroupResult }> => {
    assertSameOrigin(request)
    await rateLimit(null, request, "groupAction")
    const account = await getAccount()
    if (!account) throw new ApiError("NOT_SIGNED_IN", 401)
    const sent = await readJson<unknown>(request)
    const body: { nickname?: unknown; tag?: unknown } = typeof sent === "object" && sent !== null ? sent : {}
    const target = action === "leave" ? null : handleOfBody(body)
    if (action !== "leave" && !target) throw new ApiError("GROUP_INVALID")
    if (isDemoAccount(account)) return { ok: true, result: DEMO_RESULTS[action] }
    try {
      if (action === "leave") return { ok: true, result: await leaveGroup(account.id) }
      if (!target) throw new ApiError("GROUP_INVALID")
      return { ok: true, result: action === "kick" ? await removeFromGroup(account.id, target) : await handOverLead(account.id, target) }
    } catch (error) {
      // A database that has not got the groups yet cannot keep them: the member is told it is not available, not that something broke
      if (groupsNotApplied(error)) throw new ApiError("GROUPS_UNAVAILABLE", 503)
      throw error
    }
  })
