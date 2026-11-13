import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), ensureProfile: vi.fn() }))

vi.mock("server-only", () => ({}))
vi.mock("./supabase", () => ({ supabaseAdmin: () => ({ rpc: mocks.rpc }) }))
vi.mock("./profiles", () => ({ ensureProfile: mocks.ensureProfile }))

import { MAX_BLOCKS, MAX_FRIENDS, MAX_REQUESTS_RECEIVED, MAX_REQUESTS_SENT } from "../lib/friends"
import { EMPTY_SOCIAL, answerFriendRequest, blockMember, friendsNotApplied, readRelation, readSocial, removeFriend, sendFriendRequest, socialRecordOf, unblockMember } from "./friends"

const ANN = "0b9f6a52-8c0e-4d6e-9d53-4a1d2f6a7c11"
const account = { id: ANN, nickname: "Ann", avatarUrl: "https://cdn.example/ann.png", createdAt: "2026-10-01T09:00:00.000Z", preferences: { hideHistory: false } } as never
const BOB = { nickname: "Bob", tag: 42 }

beforeEach(() => {
  mocks.rpc.mockReset()
  mocks.ensureProfile.mockReset()
  mocks.ensureProfile.mockResolvedValue({ userId: ANN })
})

const state = (over: Record<string, unknown> = {}) => ({
  friends: [
    { nickname: "Bob", tag: 42, avatar_url: "https://cdn.example/bob.png", online: true, game: "courtisans", phase: "playing" },
    { nickname: "Cat", tag: 7, avatar_url: null, online: false, game: null, phase: null },
  ],
  incoming: [{ nickname: "Dan", tag: 1, avatar_url: null, at: "2026-11-09T10:00:00+00:00" }],
  outgoing: [{ nickname: "Eve", tag: 9999, avatar_url: "https://cdn.example/eve.png", at: "2026-11-08T10:00:00+00:00" }],
  blocked: [{ nickname: "Fay", tag: 5, avatar_url: null }],
  ...over,
})

describe("socialRecordOf", () => {
  it("reads the state the database answers: friends with their presence, the requests in and out, the blocks", () => {
    expect(socialRecordOf(state())).toEqual({
      friends: [
        { nickname: "Bob", tag: 42, avatarUrl: "https://cdn.example/bob.png", online: true, game: "courtisans", phase: "playing" },
        { nickname: "Cat", tag: 7, avatarUrl: null, online: false, game: null, phase: null },
      ],
      incoming: [{ nickname: "Dan", tag: 1, avatarUrl: null, at: "2026-11-09T10:00:00+00:00" }],
      outgoing: [{ nickname: "Eve", tag: 9999, avatarUrl: "https://cdn.example/eve.png", at: "2026-11-08T10:00:00+00:00" }],
      blocked: [{ nickname: "Fay", tag: 5, avatarUrl: null }],
      invitations: [],
    })
  })

  it("shows a friend at a game only while they are online, and only with its phase", () => {
    const { friends } = socialRecordOf(
      state({
        friends: [
          { nickname: "Bob", tag: 1, avatar_url: null, online: false, game: "courtisans", phase: "lobby" },
          { nickname: "Cat", tag: 2, avatar_url: null, online: true, game: "courtisans", phase: "waiting" },
          { nickname: "Dan", tag: 3, avatar_url: null, online: true, game: "", phase: "lobby" },
          { nickname: "Eve", tag: 4, avatar_url: null, online: true, game: "courtisans", phase: "lobby" },
        ],
      }),
    )
    expect(friends.map((friend) => [friend.game, friend.phase])).toEqual([[null, null], [null, null], [null, null], ["courtisans", "lobby"]])
  })

  it("leaves out what is not a person or a request: no nickname, a tag out of range, a picture that is not https, a date that is not one", () => {
    const record = socialRecordOf(
      state({
        friends: [{ nickname: "", tag: 1, online: true }, { nickname: "Bob", tag: 0, online: true }, { nickname: "Cat", tag: 10000, online: true }, { nickname: "Dan", tag: 4, online: "yes" }, null, "x", { nickname: "Eve", tag: 5, avatar_url: "http://cdn.example/e.png", online: true }],
        incoming: [{ nickname: "Dan", tag: 1, at: "yesterday" }, { nickname: "Fay", tag: 2 }],
      }),
    )
    expect(record.friends).toEqual([{ nickname: "Eve", tag: 5, avatarUrl: null, online: true, game: null, phase: null }])
    expect(record.incoming).toEqual([])
  })

  it("holds no account and no table: only the fields the screens draw", () => {
    const keys = new Set(socialRecordOf(state({ friends: [{ ...state().friends[0], user_id: "someone", code: "ABC123", table: "ABC123" }] })).friends.flatMap((friend) => Object.keys(friend)))
    expect([...keys].sort()).toEqual(["avatarUrl", "game", "nickname", "online", "phase", "tag"])
  })

  it("is nobody's state for an answer that is not an object, and an empty list for a list that is not one", () => {
    expect(socialRecordOf(null)).toEqual(EMPTY_SOCIAL)
    expect(socialRecordOf("x")).toEqual(EMPTY_SOCIAL)
    expect(socialRecordOf({ friends: "x", incoming: 3, outgoing: {}, blocked: null })).toEqual(EMPTY_SOCIAL)
  })
})

describe("readSocial", () => {
  it("asks for the state of the account in one call", async () => {
    mocks.rpc.mockImplementation(async (name: string) => (name === "social_state" ? { data: state(), error: null } : { data: [], error: null }))
    const record = await readSocial(ANN)
    expect(mocks.rpc).toHaveBeenCalledWith("social_state", { p_user: ANN })
    expect(record.friends).toHaveLength(2)
  })

  it("reads the invitations that wait for the account with the state, and leaves out an entry that is not one", async () => {
    const ID = "5d0f5b8e-6f8e-4f55-9d6e-3f1a2b4c5d6e"
    mocks.rpc.mockImplementation(async (name: string) =>
      name === "social_state"
        ? { data: state(), error: null }
        : {
            data: [
              { id: ID, nickname: "Bob", tag: 42, avatar_url: null, game: "hanabi", at: "2026-11-13T10:00:00+00:00", expires_at: "2026-11-13T10:30:00+00:00" },
              { id: "not-an-id", nickname: "Cat", tag: 7, avatar_url: null, game: "hanabi", at: "2026-11-13T10:00:00+00:00", expires_at: "2026-11-13T10:30:00+00:00" },
              { id: ID, nickname: "Dan", tag: 1, avatar_url: null, game: "", at: "2026-11-13T10:00:00+00:00", expires_at: "2026-11-13T10:30:00+00:00" },
              { id: ID, nickname: "Eve", tag: 1, avatar_url: null, game: "hanabi", at: "yesterday", expires_at: "2026-11-13T10:30:00+00:00" },
            ],
            error: null,
          },
    )
    const record = await readSocial(ANN)
    expect(mocks.rpc).toHaveBeenCalledWith("invitations_for", { p_user: ANN })
    expect(record.invitations).toEqual([{ id: ID, from: { nickname: "Bob", tag: 42, avatarUrl: null }, game: "hanabi", at: "2026-11-13T10:00:00+00:00", expiresAt: "2026-11-13T10:30:00+00:00" }])
  })

  it("has the friends and no invitation where migration 0023 is not applied yet", async () => {
    mocks.rpc.mockImplementation(async (name: string) => (name === "social_state" ? { data: state(), error: null } : { data: null, error: { code: "PGRST202", message: "no function" } }))
    const record = await readSocial(ANN)
    expect(record.friends).toHaveLength(2)
    expect(record.invitations).toEqual([])
  })

  it("throws what the database says of the invitations when it is not a missing migration", async () => {
    const error = { code: "57014", message: "timeout" }
    mocks.rpc.mockImplementation(async (name: string) => (name === "social_state" ? { data: state(), error: null } : { data: null, error }))
    await expect(readSocial(ANN)).rejects.toBe(error)
  })

  it("has nobody where migration 0017 is not applied yet, and throws the rest", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "PGRST202", message: "Could not find the function public.social_state" } })
    expect(await readSocial(ANN)).toEqual(EMPTY_SOCIAL)
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "42883", message: "function does not exist" } })
    expect(await readSocial(ANN)).toEqual(EMPTY_SOCIAL)
    const error = { code: "57014", message: "canceling statement due to statement timeout" }
    mocks.rpc.mockResolvedValue({ data: null, error })
    await expect(readSocial(ANN)).rejects.toBe(error)
  })
})

describe("friendsNotApplied", () => {
  it("is the database saying the table or the function is not there", () => {
    expect(friendsNotApplied({ code: "42P01" })).toBe(true)
    expect(friendsNotApplied({ code: "PGRST205" })).toBe(true)
    expect(friendsNotApplied({ code: "42883" })).toBe(true)
    expect(friendsNotApplied({ code: "PGRST202" })).toBe(true)
    expect(friendsNotApplied({ code: "57014" })).toBe(false)
    expect(friendsNotApplied(new Error("boom"))).toBe(false)
    expect(friendsNotApplied(null)).toBe(false)
  })
})

describe("sendFriendRequest", () => {
  it("sends the request from the account, to the handle, with the limits written in one place", async () => {
    mocks.rpc.mockResolvedValue({ data: "sent", error: null })
    expect(await sendFriendRequest(account, BOB)).toBe("sent")
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("friend_request_send", {
      p_user: ANN,
      p_nickname: "Bob",
      p_tag: 42,
      p_max_friends: MAX_FRIENDS,
      p_max_received: MAX_REQUESTS_RECEIVED,
      p_max_sent: MAX_REQUESTS_SENT,
    })
    expect([MAX_FRIENDS, MAX_REQUESTS_RECEIVED, MAX_REQUESTS_SENT]).toEqual([200, 50, 100])
  })

  it("makes the sender's profile first, from their account", async () => {
    mocks.rpc.mockResolvedValue({ data: "sent", error: null })
    await sendFriendRequest(account, BOB)
    expect(mocks.ensureProfile).toHaveBeenCalledExactlyOnceWith(account)
  })

  it("sends nothing for a sender whose profile cannot be made", async () => {
    mocks.ensureProfile.mockResolvedValue(null)
    expect(await sendFriendRequest(account, BOB)).toBe("no_profile")
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it.each(["sent", "accepted", "friends", "missing", "self", "blocked_by_you", "full", "too_many_sent", "unavailable", "no_profile"])("answers what the database says: %s", async (word) => {
    mocks.rpc.mockResolvedValue({ data: word, error: null })
    expect(await sendFriendRequest(account, BOB)).toBe(word)
  })

  it("throws what the database says, and does not guess at a word that is not one of its own", async () => {
    const error = { code: "23503", message: "violates foreign key" }
    mocks.rpc.mockResolvedValue({ data: null, error })
    await expect(sendFriendRequest(account, BOB)).rejects.toBe(error)
    mocks.rpc.mockResolvedValue({ data: "banana", error: null })
    await expect(sendFriendRequest(account, BOB)).rejects.toThrow(/banana/)
    mocks.rpc.mockResolvedValue({ data: null, error: null })
    await expect(sendFriendRequest(account, BOB)).rejects.toThrow()
  })

  it("throws what the profiles say, so that a database that cannot be read is not a request that went", async () => {
    const error = new Error("the profiles are down")
    mocks.ensureProfile.mockRejectedValue(error)
    await expect(sendFriendRequest(account, BOB)).rejects.toBe(error)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
})

describe("answerFriendRequest", () => {
  it.each([
    ["accept", "accepted"],
    ["decline", "declined"],
    ["cancel", "cancelled"],
  ] as const)("%s asks the database, with the answer and the limit of friends", async (answer, outcome) => {
    mocks.rpc.mockResolvedValue({ data: outcome, error: null })
    expect(await answerFriendRequest(account, BOB, answer)).toBe(outcome)
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("friend_request_answer", { p_user: ANN, p_nickname: "Bob", p_tag: 42, p_answer: answer, p_max_friends: MAX_FRIENDS })
  })

  it("makes the profile of the account only to accept: a friend sees whoever accepts, nobody sees who declines or cancels", async () => {
    mocks.rpc.mockResolvedValue({ data: "declined", error: null })
    await answerFriendRequest(account, BOB, "decline")
    await answerFriendRequest(account, BOB, "cancel")
    expect(mocks.ensureProfile).not.toHaveBeenCalled()
    await answerFriendRequest(account, BOB, "accept")
    expect(mocks.ensureProfile).toHaveBeenCalledOnce()
  })

  it("accepts nothing for an account whose profile cannot be made", async () => {
    mocks.ensureProfile.mockResolvedValue(null)
    expect(await answerFriendRequest(account, BOB, "accept")).toBe("no_profile")
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it.each(["missing", "full", "unavailable"])("answers what the database says: %s", async (word) => {
    mocks.rpc.mockResolvedValue({ data: word, error: null })
    expect(await answerFriendRequest(account, BOB, "accept")).toBe(word)
  })

  it("throws what the database says", async () => {
    const error = { code: "XX000", message: "boom" }
    mocks.rpc.mockResolvedValue({ data: null, error })
    await expect(answerFriendRequest(account, BOB, "decline")).rejects.toBe(error)
  })
})

describe("removeFriend, blockMember and unblockMember", () => {
  it("remove the friendship with the handle, for the account", async () => {
    mocks.rpc.mockResolvedValue({ data: "removed", error: null })
    expect(await removeFriend(ANN, BOB)).toBe("removed")
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("friend_remove", { p_user: ANN, p_nickname: "Bob", p_tag: 42 })
    mocks.rpc.mockResolvedValue({ data: "missing", error: null })
    expect(await removeFriend(ANN, BOB)).toBe("missing")
  })

  it("block the handle, with the limit of blocks", async () => {
    mocks.rpc.mockResolvedValue({ data: "blocked_friend", error: null })
    expect(await blockMember(ANN, BOB)).toBe("blocked_friend")
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("friend_block", { p_user: ANN, p_nickname: "Bob", p_tag: 42, p_max_blocks: MAX_BLOCKS })
    for (const word of ["blocked", "missing", "self", "full"]) {
      mocks.rpc.mockResolvedValue({ data: word, error: null })
      expect(await blockMember(ANN, BOB)).toBe(word)
    }
  })

  it("lift the block on the handle", async () => {
    mocks.rpc.mockResolvedValue({ data: "unblocked", error: null })
    expect(await unblockMember(ANN, BOB)).toBe("unblocked")
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("friend_unblock", { p_user: ANN, p_nickname: "Bob", p_tag: 42 })
    mocks.rpc.mockResolvedValue({ data: "missing", error: null })
    expect(await unblockMember(ANN, BOB)).toBe("missing")
  })

  it("throw what the database says", async () => {
    const error = { code: "XX000", message: "boom" }
    mocks.rpc.mockResolvedValue({ data: null, error })
    await expect(removeFriend(ANN, BOB)).rejects.toBe(error)
    await expect(blockMember(ANN, BOB)).rejects.toBe(error)
    await expect(unblockMember(ANN, BOB)).rejects.toBe(error)
  })
})

describe("readRelation", () => {
  const OTHER = "5c3e1d8a-1f2b-4c47-8a9e-6d0b7e2f4a90"

  it("asks what is between the two accounts", async () => {
    mocks.rpc.mockResolvedValue({ data: "outgoing", error: null })
    expect(await readRelation(ANN, OTHER)).toBe("outgoing")
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("friend_relation", { p_user: ANN, p_other: OTHER })
  })

  it("is nothing for a word it does not know, and where the friends are not there yet", async () => {
    mocks.rpc.mockResolvedValue({ data: "enemies", error: null })
    expect(await readRelation(ANN, OTHER)).toBe("none")
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "PGRST202", message: "Could not find the function" } })
    expect(await readRelation(ANN, OTHER)).toBe("none")
  })

  it("throws the rest", async () => {
    const error = { code: "57014", message: "timeout" }
    mocks.rpc.mockResolvedValue({ data: null, error })
    await expect(readRelation(ANN, OTHER)).rejects.toBe(error)
  })
})
