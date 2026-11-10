import type { Handle } from "@pbgo/accounts"
import { isDemoAccount } from "@pbgo/accounts/demo"
import { getAccount } from "@pbgo/accounts/server"
import type { FriendRequestSource } from "@pbgo/analytics"
import { NO_SOCIAL, handleOfBody, requestSourceOf, type FriendAction, type FriendResult, type SocialState } from "../../../../lib/friends"
import { trackAnonymously } from "../../../../server/analytics"
import { ApiError, assertSameOrigin, handle, readJson } from "../../../../server/api"
import { answerFriendRequest, blockMember, friendsNotApplied, readSocial, removeFriend, sendFriendRequest, stateOf, unblockMember } from "../../../../server/friends"
import { rateLimit } from "../../../../server/rate-limit"

/** What the app gives the friends' routes, which core cannot read: the name the hub gives each game (the catalog's), so that a friend's game is told by name. */
export type FriendsDeps = {
  gameNames: () => Promise<ReadonlyMap<string, string>>
}

/**
 * `GET /api/hub/friends`: the whole social state of the signed-in member in one answer (PLT-23): their friends with whether they are online and the game they are at (never the table), the requests that came in and went out, and the members they
 * blocked. The panel of every page of the hub asks for it about every 20 s while a tab is in view, and after each change. 401 when not signed in. Where migration 0017 is not applied the state is empty. The demo account of development is in no database: its
 * friends are made up by the browser, so this answers nobody for it. Never cached.
 */
export const getFriends = (deps: FriendsDeps) =>
  handle(async (request: Request): Promise<SocialState> => {
    await rateLimit(null, request, "friendsRead")
    const account = await getAccount()
    if (!account) throw new ApiError("NOT_SIGNED_IN", 401)
    if (isDemoAccount(account)) return NO_SOCIAL
    const record = await readSocial(account.id)
    // A friend is told at a game by name: without the names (the catalog cannot be read) they are online and nothing more
    const names = await deps.gameNames().catch((error: unknown) => {
      console.error("The names of the games could not be read for the friends", error instanceof Error ? error.message : error)
      return new Map<string, string>()
    })
    return stateOf(record, names)
  })

/** What the demo account is told: the action is done, and nothing is written. */
const DEMO_RESULTS: Record<FriendAction, FriendResult> = { request: "sent", accept: "accepted", decline: "declined", cancel: "cancelled", remove: "removed", block: "blocked", unblock: "unblocked" }

type Signed = Parameters<typeof sendFriendRequest>[0]

/** The work of each action, which says what it did (`FriendResult`) or refuses with the code of what it could not do, and counts what changed. */
async function act(action: FriendAction, account: Signed, target: Handle, source: FriendRequestSource): Promise<FriendResult> {
  switch (action) {
    case "request": {
      const outcome = await sendFriendRequest(account, target)
      if (outcome === "sent") trackAnonymously("friend_request_sent", { source })
      if (outcome === "accepted") trackAnonymously("friend_request_answered", { answer: "accepted" })
      if (outcome === "sent" || outcome === "accepted" || outcome === "friends") return outcome
      if (outcome === "missing") throw new ApiError("FRIEND_NOT_FOUND", 404)
      if (outcome === "self") throw new ApiError("FRIEND_SELF")
      if (outcome === "blocked_by_you") throw new ApiError("FRIEND_BLOCKED", 409)
      if (outcome === "full") throw new ApiError("FRIEND_LIMIT", 409)
      if (outcome === "too_many_sent") throw new ApiError("FRIEND_REQUESTS_LIMIT", 409)
      if (outcome === "unavailable") throw new ApiError("FRIEND_REQUEST_UNAVAILABLE", 409)
      throw new ApiError("FRIENDS_UNAVAILABLE", 503)
    }
    case "accept": {
      const outcome = await answerFriendRequest(account, target, "accept")
      if (outcome === "accepted") {
        trackAnonymously("friend_request_answered", { answer: "accepted" })
        return "accepted"
      }
      if (outcome === "missing") throw new ApiError("FRIEND_REQUEST_GONE", 404)
      if (outcome === "full") throw new ApiError("FRIEND_LIMIT", 409)
      if (outcome === "unavailable") throw new ApiError("FRIEND_REQUEST_UNAVAILABLE", 409)
      throw new ApiError("FRIENDS_UNAVAILABLE", 503)
    }
    case "decline":
    case "cancel": {
      // A request that is gone already (answered, or taken back, in the meantime) leaves the member where they wanted to be: it is done, and nothing is counted
      const outcome = await answerFriendRequest(account, target, action)
      if (outcome === "declined" || outcome === "cancelled") trackAnonymously("friend_request_answered", { answer: outcome })
      return action === "decline" ? "declined" : "cancelled"
    }
    case "remove": {
      if ((await removeFriend(account.id, target)) === "removed") trackAnonymously("friend_removed", {})
      return "removed"
    }
    case "block": {
      const outcome = await blockMember(account.id, target)
      if (outcome === "blocked" || outcome === "blocked_friend") {
        trackAnonymously("member_blocked", { were_friends: outcome === "blocked_friend" })
        return "blocked"
      }
      if (outcome === "missing") throw new ApiError("FRIEND_NOT_FOUND", 404)
      if (outcome === "self") throw new ApiError("FRIEND_SELF")
      throw new ApiError("FRIEND_BLOCK_LIMIT", 409)
    }
    case "unblock": {
      await unblockMember(account.id, target)
      return "unblocked"
    }
  }
}

/**
 * The `POST` of one action of the friends (PLT-23), under `/api/hub/friends/<action>`: `request` (to the member who goes by the handle: a request that waits, or the acceptance of one that member had sent), `accept` and `decline` (the request that member sent), `cancel`
 * (the request the member sent them), `remove` (the friendship), `block` and `unblock`. The body names the member by their handle, `{ "nickname": "Alex", "tag": 42 }`, and a request may say where it comes from, `"source": "form" | "profile"`.
 * It answers `{ "ok": true, "result": … }` (`FriendResult`). The request must come from this site (403 `CROSS_ORIGIN`), 401 `NOT_SIGNED_IN`, 400 `FRIEND_INVALID` for a handle that cannot be anybody's, 429 over the limits (`friendRequest`, `friendAction`), and the refusals
 * of each action in `CORE_ERROR_MESSAGES`: 404 `FRIEND_NOT_FOUND`, 400 `FRIEND_SELF`, 409 `FRIEND_BLOCKED` (the member sending blocked them), `FRIEND_LIMIT`, `FRIEND_REQUESTS_LIMIT`, `FRIEND_REQUEST_UNAVAILABLE`, `FRIEND_BLOCK_LIMIT`, 404 `FRIEND_REQUEST_GONE` (accepting a request that is not
 * there), 503 `FRIENDS_UNAVAILABLE` where migration 0017 is not applied. A member who blocked the sender is never told: their request answers `sent` and nothing is written. Declining, cancelling, removing and unblocking what is not there are done, as far as the member can tell.
 * The demo account of development is told it is done and nothing is written.
 */
export const postFriend = (action: FriendAction) =>
  handle(async (request: Request) => {
    assertSameOrigin(request)
    await rateLimit(null, request, action === "request" ? "friendRequest" : "friendAction")
    const account = await getAccount()
    if (!account) throw new ApiError("NOT_SIGNED_IN", 401)
    const sent = await readJson<unknown>(request)
    const body: { nickname?: unknown; tag?: unknown; source?: unknown } = typeof sent === "object" && sent !== null ? sent : {}
    const target = handleOfBody(body)
    if (!target) throw new ApiError("FRIEND_INVALID")
    if (isDemoAccount(account)) return { ok: true, result: DEMO_RESULTS[action] }
    try {
      return { ok: true, result: await act(action, account, target, requestSourceOf(body.source)) }
    } catch (error) {
      // A database that has not got the friends yet cannot keep them: the member is told it is not available, not that something broke
      if (friendsNotApplied(error)) throw new ApiError("FRIENDS_UNAVAILABLE", 503)
      throw error
    }
  })
