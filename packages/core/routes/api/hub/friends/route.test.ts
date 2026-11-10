import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  account: null as { id: string; nickname?: string } | null,
  readSocial: vi.fn(),
  sendFriendRequest: vi.fn(),
  answerFriendRequest: vi.fn(),
  removeFriend: vi.fn(),
  blockMember: vi.fn(),
  unblockMember: vi.fn(),
  trackAnonymously: vi.fn(),
}))

vi.mock("server-only", () => ({}))
vi.mock("@pbgo/accounts/server", () => ({ getAccount: async () => mocks.account }))
vi.mock("../../../../server/player", () => ({ getPlayerId: async () => null }))
vi.mock("../../../../server/analytics", async (importOriginal) => ({ ...(await importOriginal<typeof import("../../../../server/analytics")>()), trackAnonymously: mocks.trackAnonymously }))
vi.mock("../../../../server/friends", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../../server/friends")>()),
  readSocial: mocks.readSocial,
  sendFriendRequest: mocks.sendFriendRequest,
  answerFriendRequest: mocks.answerFriendRequest,
  removeFriend: mocks.removeFriend,
  blockMember: mocks.blockMember,
  unblockMember: mocks.unblockMember,
}))

import { CORE_ERROR_MESSAGES } from "../../../../lib/api"
import { FRIEND_ACTIONS, type FriendAction } from "../../../../lib/friends"
import { setRateLimitStore } from "../../../../server/rate-limit"
import { MemoryRateLimitStore } from "../../../../server/rate-limiter"
import { stateOf } from "../../../../server/friends"
import { getFriends, postFriend } from "./route"

const ANN = "0b9f6a52-8c0e-4d6e-9d53-4a1d2f6a7c11"
const names = new Map([["courtisans", "Courtisans"]])
const deps = { gameNames: async () => names }

const post = (action: FriendAction, body: unknown, headers: Record<string, string> = {}) =>
  postFriend(action)(new Request(`http://localhost/api/hub/friends/${action}`, { method: "POST", headers: { "x-forwarded-for": "1.1.1.1", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) }))
const get = (headers: Record<string, string> = {}) => getFriends(deps)(new Request("http://localhost/api/hub/friends", { headers: { "x-forwarded-for": "1.1.1.1", ...headers } }))
const errorOf = async (response: Response) => ((await response.json()) as { error?: string }).error
const BOB = { nickname: "Bob", tag: 42 }
const writes = () => [mocks.sendFriendRequest, mocks.answerFriendRequest, mocks.removeFriend, mocks.blockMember, mocks.unblockMember]

beforeEach(() => {
  mocks.account = null
  for (const mock of [mocks.readSocial, mocks.trackAnonymously, ...writes()]) mock.mockReset()
  mocks.sendFriendRequest.mockResolvedValue("sent")
  mocks.answerFriendRequest.mockResolvedValue("accepted")
  mocks.removeFriend.mockResolvedValue("removed")
  mocks.blockMember.mockResolvedValue("blocked")
  mocks.unblockMember.mockResolvedValue("unblocked")
  setRateLimitStore(new MemoryRateLimitStore())
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("POST /api/hub/friends/request", () => {
  it("sends a request, from the signed-in account, to the handle, and says it waits", async () => {
    mocks.account = { id: ANN, nickname: "Ann" }
    const response = await post("request", BOB)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, result: "sent" })
    expect(mocks.sendFriendRequest).toHaveBeenCalledExactlyOnceWith(mocks.account, BOB)
  })

  it("takes the tag as the member typed it, and the nickname as a profile keeps it", async () => {
    mocks.account = { id: ANN }
    await post("request", { nickname: "  Marly   74 ", tag: " #0042 " })
    expect(mocks.sendFriendRequest).toHaveBeenCalledExactlyOnceWith(mocks.account, { nickname: "Marly 74", tag: 42 })
  })

  it("asks as the account that is signed in, whatever the request says of who it is", async () => {
    mocks.account = { id: ANN }
    await post("request", { ...BOB, user_id: "someone-else", userId: "someone-else", from: "someone-else" })
    expect(mocks.sendFriendRequest).toHaveBeenCalledExactlyOnceWith(mocks.account, BOB)
  })

  it("counts a request that waits, with where it was sent from, and nothing that names anyone", async () => {
    mocks.account = { id: ANN }
    await post("request", { ...BOB, source: "profile" })
    await post("request", BOB)
    await post("request", { ...BOB, source: "somewhere else" })
    expect(mocks.trackAnonymously.mock.calls).toEqual([
      ["friend_request_sent", { source: "profile" }],
      ["friend_request_sent", { source: "form" }],
      ["friend_request_sent", { source: "form" }],
    ])
  })

  it("counts a request that accepts one the member had sent as an answer, not as a request", async () => {
    mocks.account = { id: ANN }
    mocks.sendFriendRequest.mockResolvedValue("accepted")
    const response = await post("request", BOB)
    expect(await response.json()).toEqual({ ok: true, result: "accepted" })
    expect(mocks.trackAnonymously.mock.calls).toEqual([["friend_request_answered", { answer: "accepted" }]])
  })

  it("says they are friends already, and counts nothing", async () => {
    mocks.account = { id: ANN }
    mocks.sendFriendRequest.mockResolvedValue("friends")
    expect(await (await post("request", BOB)).json()).toEqual({ ok: true, result: "friends" })
    expect(mocks.trackAnonymously).not.toHaveBeenCalled()
  })

  it.each([
    ["missing", 404, "FRIEND_NOT_FOUND"],
    ["self", 400, "FRIEND_SELF"],
    ["blocked_by_you", 409, "FRIEND_BLOCKED"],
    ["full", 409, "FRIEND_LIMIT"],
    ["too_many_sent", 409, "FRIEND_REQUESTS_LIMIT"],
    ["unavailable", 409, "FRIEND_REQUEST_UNAVAILABLE"],
    ["no_profile", 503, "FRIENDS_UNAVAILABLE"],
  ])("refuses %s with %i %s, and counts nothing", async (outcome, status, code) => {
    mocks.account = { id: ANN }
    mocks.sendFriendRequest.mockResolvedValue(outcome)
    const response = await post("request", BOB)
    expect(response.status).toBe(status)
    expect(await errorOf(response)).toBe(code)
    expect(mocks.trackAnonymously).not.toHaveBeenCalled()
  })

  it("is limited to 30 requests in ten minutes for one address, and the others are not", async () => {
    mocks.account = { id: ANN }
    for (let i = 0; i < 30; i++) expect((await post("request", BOB)).status).toBe(200)
    const refused = await post("request", BOB)
    expect(refused.status).toBe(429)
    expect(await errorOf(refused)).toBe("RATE_LIMITED")
    expect(refused.headers.get("Retry-After")).toBeTruthy()
    expect((await post("accept", BOB)).status).toBe(200)
  })
})

describe("the answers", () => {
  it.each([
    ["accept", "accepted", "accepted"],
    ["decline", "declined", "declined"],
    ["cancel", "cancelled", "cancelled"],
  ] as const)("%s asks the database for that answer and says %s", async (action, outcome, result) => {
    mocks.account = { id: ANN }
    mocks.answerFriendRequest.mockResolvedValue(outcome)
    const response = await post(action, BOB)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, result })
    expect(mocks.answerFriendRequest).toHaveBeenCalledExactlyOnceWith(mocks.account, BOB, action)
    expect(mocks.trackAnonymously.mock.calls).toEqual([["friend_request_answered", { answer: outcome }]])
  })

  it("refuses to accept a request that is not there, so that the member knows", async () => {
    mocks.account = { id: ANN }
    mocks.answerFriendRequest.mockResolvedValue("missing")
    const response = await post("accept", BOB)
    expect(response.status).toBe(404)
    expect(await errorOf(response)).toBe("FRIEND_REQUEST_GONE")
    expect(mocks.trackAnonymously).not.toHaveBeenCalled()
  })

  it.each([
    ["full", 409, "FRIEND_LIMIT"],
    ["unavailable", 409, "FRIEND_REQUEST_UNAVAILABLE"],
    ["no_profile", 503, "FRIENDS_UNAVAILABLE"],
  ])("refuses to accept when the database says %s", async (outcome, status, code) => {
    mocks.account = { id: ANN }
    mocks.answerFriendRequest.mockResolvedValue(outcome)
    const response = await post("accept", BOB)
    expect(response.status).toBe(status)
    expect(await errorOf(response)).toBe(code)
  })

  it.each(["decline", "cancel"] as const)("%s on a request that is gone is done, as far as the member can tell, and counts nothing", async (action) => {
    mocks.account = { id: ANN }
    mocks.answerFriendRequest.mockResolvedValue("missing")
    const response = await post(action, BOB)
    expect(response.status).toBe(200)
    expect(mocks.trackAnonymously).not.toHaveBeenCalled()
  })
})

describe("remove, block and unblock", () => {
  it("remove a friend, for the account, and count it", async () => {
    mocks.account = { id: ANN }
    const response = await post("remove", BOB)
    expect(await response.json()).toEqual({ ok: true, result: "removed" })
    expect(mocks.removeFriend).toHaveBeenCalledExactlyOnceWith(ANN, BOB)
    expect(mocks.trackAnonymously.mock.calls).toEqual([["friend_removed", {}]])
  })

  it("remove somebody who is not a friend any more is done, and counts nothing", async () => {
    mocks.account = { id: ANN }
    mocks.removeFriend.mockResolvedValue("missing")
    expect((await post("remove", BOB)).status).toBe(200)
    expect(mocks.trackAnonymously).not.toHaveBeenCalled()
  })

  it.each([
    ["blocked", false],
    ["blocked_friend", true],
  ])("block a member (%s) and count whether they were friends, never who", async (outcome, wereFriends) => {
    mocks.account = { id: ANN }
    mocks.blockMember.mockResolvedValue(outcome)
    const response = await post("block", BOB)
    expect(await response.json()).toEqual({ ok: true, result: "blocked" })
    expect(mocks.blockMember).toHaveBeenCalledExactlyOnceWith(ANN, BOB)
    expect(mocks.trackAnonymously.mock.calls).toEqual([["member_blocked", { were_friends: wereFriends }]])
  })

  it.each([
    ["missing", 404, "FRIEND_NOT_FOUND"],
    ["self", 400, "FRIEND_SELF"],
    ["full", 409, "FRIEND_BLOCK_LIMIT"],
  ])("refuse to block when the database says %s", async (outcome, status, code) => {
    mocks.account = { id: ANN }
    mocks.blockMember.mockResolvedValue(outcome)
    const response = await post("block", BOB)
    expect(response.status).toBe(status)
    expect(await errorOf(response)).toBe(code)
    expect(mocks.trackAnonymously).not.toHaveBeenCalled()
  })

  it("unblock a member, whether or not they were blocked", async () => {
    mocks.account = { id: ANN }
    expect(await (await post("unblock", BOB)).json()).toEqual({ ok: true, result: "unblocked" })
    mocks.unblockMember.mockResolvedValue("missing")
    expect(await (await post("unblock", BOB)).json()).toEqual({ ok: true, result: "unblocked" })
    expect(mocks.unblockMember).toHaveBeenCalledWith(ANN, BOB)
    expect(mocks.trackAnonymously).not.toHaveBeenCalled()
  })
})

describe("every POST", () => {
  it.each(FRIEND_ACTIONS)("%s refuses a request from another site, and writes nothing", async (action) => {
    mocks.account = { id: ANN }
    const response = await post(action, BOB, { origin: "https://evil.example" })
    expect(response.status).toBe(403)
    expect(await errorOf(response)).toBe("CROSS_ORIGIN")
    for (const write of writes()) expect(write).not.toHaveBeenCalled()
  })

  it.each(FRIEND_ACTIONS)("%s takes a request from this site", async (action) => {
    mocks.account = { id: ANN }
    const response = await post(action, BOB, { origin: "http://localhost" })
    expect(response.status).toBe(200)
  })

  it.each(FRIEND_ACTIONS)("%s refuses a visitor who is not signed in, and writes nothing", async (action) => {
    const response = await post(action, BOB)
    expect(response.status).toBe(401)
    expect(await errorOf(response)).toBe("NOT_SIGNED_IN")
    for (const write of writes()) expect(write).not.toHaveBeenCalled()
  })

  it.each(FRIEND_ACTIONS)("%s tells the demo account of development it is done, and writes nothing", async (action) => {
    mocks.account = { id: "demo", nickname: "Demo" }
    const response = await post(action, BOB)
    expect(response.status).toBe(200)
    expect(((await response.json()) as { ok: boolean }).ok).toBe(true)
    for (const write of writes()) expect(write).not.toHaveBeenCalled()
    expect(mocks.trackAnonymously).not.toHaveBeenCalled()
  })

  it.each([
    [undefined, 42],
    [null, 42],
    [7, 42],
    ["", 42],
    ["   ", 42],
    ["a".repeat(21), 42],
    ["Alex#1", 42],
    ["A/B", 42],
    ["Alex", undefined],
    ["Alex", null],
    ["Alex", 0],
    ["Alex", "0000"],
    ["Alex", 10000],
    ["Alex", "12345"],
    ["Alex", 4.2],
    ["Alex", [42]],
  ])("refuses the handle %j#%j, which nobody can have: nothing is written", async (nickname, tag) => {
    mocks.account = { id: ANN }
    const response = await post("request", { nickname, tag })
    expect(response.status).toBe(400)
    expect(await errorOf(response)).toBe("FRIEND_INVALID")
    for (const write of writes()) expect(write).not.toHaveBeenCalled()
  })

  it.each([["null", "null"], ["a list", "[1,2]"], ["a number", "7"], ["a string", '"Alex#0042"']])("refuses a body that is %s", async (_what, body) => {
    mocks.account = { id: ANN }
    const response = await post("request", body)
    expect(response.status).toBe(400)
    expect(await errorOf(response)).toBe("FRIEND_INVALID")
    expect(mocks.sendFriendRequest).not.toHaveBeenCalled()
  })

  it("refuses a body that is not JSON", async () => {
    mocks.account = { id: ANN }
    const response = await post("request", "{not json")
    expect(response.status).toBe(400)
    expect(await errorOf(response)).toBe("INVALID_REQUEST")
  })

  it.each(FRIEND_ACTIONS)("%s says friends are not available where the database has not got them yet, and not that something broke", async (action) => {
    mocks.account = { id: ANN }
    const missing = Object.assign(new Error("Could not find the function"), { code: "PGRST202" })
    for (const write of writes()) write.mockRejectedValue(missing)
    const response = await post(action, BOB)
    expect(response.status).toBe(503)
    expect(await errorOf(response)).toBe("FRIENDS_UNAVAILABLE")
  })

  it("answers a server error for what it does not know, and keeps it out of the answer", async () => {
    mocks.account = { id: ANN }
    mocks.sendFriendRequest.mockRejectedValue(new Error("connection reset by peer"))
    const response = await post("request", BOB)
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: "SERVER_ERROR" })
  })

  it("has words for every code it refuses with", async () => {
    for (const code of ["FRIEND_INVALID", "FRIEND_NOT_FOUND", "FRIEND_SELF", "FRIEND_BLOCKED", "FRIEND_LIMIT", "FRIEND_REQUESTS_LIMIT", "FRIEND_REQUEST_UNAVAILABLE", "FRIEND_REQUEST_GONE", "FRIEND_BLOCK_LIMIT", "FRIENDS_UNAVAILABLE"]) {
      expect(CORE_ERROR_MESSAGES[code], code).toMatch(/^[A-Z].*[.]$/)
    }
  })
})

describe("GET /api/hub/friends", () => {
  const record = {
    friends: [
      { nickname: "Bob", tag: 42, avatarUrl: null, online: true, game: "courtisans", phase: "lobby" },
      { nickname: "Cat", tag: 7, avatarUrl: null, online: true, game: "an-old-game", phase: "playing" },
      { nickname: "Dan", tag: 9, avatarUrl: null, online: false, game: null, phase: null },
    ],
    incoming: [{ nickname: "Eve", tag: 1, avatarUrl: null, at: "2026-11-09T10:00:00+00:00" }],
    outgoing: [],
    blocked: [{ nickname: "Fay", tag: 5, avatarUrl: null }],
  }

  it("gives the whole state of the signed-in member, with each friend's game by name", async () => {
    mocks.account = { id: ANN }
    mocks.readSocial.mockResolvedValue(record)
    const response = await get()
    expect(response.status).toBe(200)
    expect(mocks.readSocial).toHaveBeenCalledExactlyOnceWith(ANN)
    const state = await response.json()
    expect(state.friends[0]).toEqual({ nickname: "Bob", tag: 42, avatarUrl: null, online: true, game: { slug: "courtisans", name: "Courtisans" }, phase: "lobby" })
    expect(state.incoming).toHaveLength(1)
    expect(state.blocked).toHaveLength(1)
  })

  it("says a friend is online and nothing more where the hub has no name for the game", async () => {
    mocks.account = { id: ANN }
    mocks.readSocial.mockResolvedValue(record)
    const { friends } = await (await get()).json()
    expect(friends[1]).toEqual({ nickname: "Cat", tag: 7, avatarUrl: null, online: true, game: null, phase: null })
    expect(friends[2].online).toBe(false)
  })

  it("does the same when the names cannot be read, and says so in the log", async () => {
    mocks.account = { id: ANN }
    mocks.readSocial.mockResolvedValue(record)
    const response = await getFriends({ gameNames: async () => Promise.reject(new Error("the catalog is down")) })(new Request("http://localhost/api/hub/friends", { headers: { "x-forwarded-for": "1.1.1.1" } }))
    const { friends } = await response.json()
    expect(friends.map((friend: { game: unknown }) => friend.game)).toEqual([null, null, null])
    expect(console.error).toHaveBeenCalled()
  })

  it("holds no account and no table: the state has only what a screen draws", async () => {
    mocks.account = { id: ANN }
    mocks.readSocial.mockResolvedValue(record)
    const text = JSON.stringify(await (await get()).json())
    expect(text).not.toContain(ANN)
    expect(text).not.toMatch(/"(user_?id|code|table)"/)
  })

  it("refuses a visitor who is not signed in", async () => {
    const response = await get()
    expect(response.status).toBe(401)
    expect(await errorOf(response)).toBe("NOT_SIGNED_IN")
    expect(mocks.readSocial).not.toHaveBeenCalled()
  })

  it("has nobody for the demo account of development, whose friends the browser makes up", async () => {
    mocks.account = { id: "demo" }
    expect(await (await get()).json()).toEqual({ friends: [], incoming: [], outgoing: [], blocked: [] })
    expect(mocks.readSocial).not.toHaveBeenCalled()
  })

  it("answers a server error when the database cannot be read, so that the panel keeps what it had", async () => {
    mocks.account = { id: ANN }
    mocks.readSocial.mockRejectedValue(new Error("the database is down"))
    const response = await get()
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: "SERVER_ERROR" })
  })

  it("is limited to 120 reads a minute for one address", async () => {
    mocks.account = { id: ANN }
    mocks.readSocial.mockResolvedValue(record)
    for (let i = 0; i < 120; i++) expect((await get()).status).toBe(200)
    expect((await get()).status).toBe(429)
  })
})

describe("stateOf", () => {
  it("names the game of each friend and leaves the other lists as they are", () => {
    const state = stateOf(record(), names)
    expect(state.friends).toEqual([{ nickname: "Bob", tag: 1, avatarUrl: null, online: true, game: { slug: "courtisans", name: "Courtisans" }, phase: "playing" }])
    expect(state.incoming).toEqual([])
  })

  function record() {
    return { friends: [{ nickname: "Bob", tag: 1, avatarUrl: null, online: true, game: "courtisans", phase: "playing" as const }], incoming: [], outgoing: [], blocked: [] }
  }
})
