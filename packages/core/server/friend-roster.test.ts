import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ from: vi.fn(), readProfiles: vi.fn(), readGamesPlayed: vi.fn() }))

vi.mock("server-only", () => ({}))
vi.mock("./supabase", () => ({ supabaseAdmin: () => ({ from: mocks.from }) }))
vi.mock("./profiles", () => ({ readProfiles: mocks.readProfiles }))
vi.mock("./standings", () => ({ readGamesPlayed: mocks.readGamesPlayed }))

import { mostPlayedFirst, readFriendRoster } from "./friend-roster"

const ME = "0b9f6a52-8c0e-4d6e-9d53-4a1d2f6a7c11"
const ANN = "11111111-1111-4111-8111-111111111111"
const BOB = "22222222-2222-4222-8222-222222222222"
const CAT = "33333333-3333-4333-8333-333333333333"
const DAN = "44444444-4444-4444-8444-444444444444"

type Answer = { data: unknown; error: unknown }

/** Each read of a table answers from what is queued for it, in turn: the friendships once for each side of the pair, `account_deletions` once. */
function tables(answers: Record<string, Answer[]>) {
  mocks.from.mockImplementation((table: string) => {
    const answer = answers[table]?.shift() ?? { data: null, error: { message: `no answer left for ${table}` } }
    const chain: object = new Proxy({}, { get: (_target, name) => (name === "then" ? (resolve: (value: Answer) => unknown) => resolve(answer) : () => chain) })
    return chain
  })
}

const profile = (userId: string, nickname: string, tag: number, over: Record<string, unknown> = {}) => ({ userId, nickname, tag, avatarUrl: null, hideHistory: false, createdAt: "2026-10-01T09:00:00+00:00", ...over })

beforeEach(() => {
  mocks.from.mockReset()
  mocks.readProfiles.mockReset()
  mocks.readGamesPlayed.mockReset()
})

describe("readFriendRoster", () => {
  it("lists the friends from both sides of the friendships, with their handle, their picture and the games they finished, the ones who played the most first", async () => {
    tables({ friendships: [{ data: [{ user_b: ANN }], error: null }, { data: [{ user_a: BOB }, { user_a: CAT }], error: null }], account_deletions: [{ data: [], error: null }] })
    mocks.readProfiles.mockResolvedValue(
      new Map([
        [ANN, profile(ANN, "Ann", 42, { avatarUrl: "https://cdn.example/ann.png" })],
        [BOB, profile(BOB, "Bob", 7)],
        [CAT, profile(CAT, "Cat", 9)],
      ]),
    )
    mocks.readGamesPlayed.mockResolvedValue(new Map([[ANN, 12], [BOB, 40]]))
    expect(await readFriendRoster(ME)).toEqual([
      { nickname: "Bob", tag: 7, avatarUrl: null, gamesPlayed: 40 },
      { nickname: "Ann", tag: 42, avatarUrl: "https://cdn.example/ann.png", gamesPlayed: 12 },
      // A friend with no game in the totals has finished none
      { nickname: "Cat", tag: 9, avatarUrl: null, gamesPlayed: 0 },
    ])
    expect(mocks.readProfiles).toHaveBeenCalledWith([ANN, BOB, CAT])
    expect(mocks.readGamesPlayed).toHaveBeenCalledWith([ANN, BOB, CAT])
  })

  it("leaves out a friend whose account is closed and one who has no profile", async () => {
    tables({ friendships: [{ data: [{ user_b: ANN }, { user_b: BOB }, { user_b: CAT }], error: null }, { data: [], error: null }], account_deletions: [{ data: [{ user_id: BOB }], error: null }] })
    mocks.readProfiles.mockResolvedValue(new Map([[ANN, profile(ANN, "Ann", 42)], [BOB, profile(BOB, "Bob", 7)]]))
    mocks.readGamesPlayed.mockResolvedValue(new Map())
    expect((await readFriendRoster(ME)).map((friend) => friend.nickname)).toEqual(["Ann"])
  })

  it("says no number for a friend who keeps their games private, and lists them after the others", async () => {
    tables({ friendships: [{ data: [{ user_b: ANN }, { user_b: BOB }, { user_b: CAT }], error: null }, { data: [], error: null }], account_deletions: [{ data: [], error: null }] })
    mocks.readProfiles.mockResolvedValue(new Map([[ANN, profile(ANN, "Ann", 42, { hideHistory: true })], [BOB, profile(BOB, "Bob", 7)], [CAT, profile(CAT, "Cat", 9)]]))
    mocks.readGamesPlayed.mockResolvedValue(new Map([[ANN, 99], [BOB, 0], [CAT, 3]]))
    expect(await readFriendRoster(ME)).toEqual([
      { nickname: "Cat", tag: 9, avatarUrl: null, gamesPlayed: 3 },
      { nickname: "Bob", tag: 7, avatarUrl: null, gamesPlayed: 0 },
      { nickname: "Ann", tag: 42, avatarUrl: null, gamesPlayed: null },
    ])
  })

  it("has nobody for a member with no friend, and asks nothing more", async () => {
    tables({ friendships: [{ data: [], error: null }, { data: [], error: null }] })
    expect(await readFriendRoster(ME)).toEqual([])
    expect(mocks.readProfiles).not.toHaveBeenCalled()
    expect(mocks.readGamesPlayed).not.toHaveBeenCalled()
  })

  it("has nobody where the friends are not there yet (migration 0017), and for an id that is no account (the demo account)", async () => {
    tables({ friendships: [{ data: null, error: { code: "42P01", message: "relation public.friendships does not exist" } }, { data: null, error: { code: "42P01", message: "relation public.friendships does not exist" } }] })
    expect(await readFriendRoster(ME)).toEqual([])
    mocks.from.mockReset()
    expect(await readFriendRoster("demo")).toEqual([])
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it("lists every friend where the table of the closed accounts is not there (migration 0011)", async () => {
    tables({ friendships: [{ data: [{ user_b: ANN }], error: null }, { data: [], error: null }], account_deletions: [{ data: null, error: { code: "42P01", message: "relation public.account_deletions does not exist" } }] })
    mocks.readProfiles.mockResolvedValue(new Map([[ANN, profile(ANN, "Ann", 42)]]))
    mocks.readGamesPlayed.mockResolvedValue(new Map([[ANN, 5]]))
    expect(await readFriendRoster(ME)).toEqual([{ nickname: "Ann", tag: 42, avatarUrl: null, gamesPlayed: 5 }])
  })

  it("throws what else the database says, so that the page logs it and draws no friend", async () => {
    tables({ friendships: [{ data: null, error: { code: "42501", message: "permission denied" } }, { data: [], error: null }] })
    await expect(readFriendRoster(ME)).rejects.toEqual({ code: "42501", message: "permission denied" })
  })
})

describe("mostPlayedFirst", () => {
  it("puts the games played first, then the name whatever its case, then the tag", () => {
    const friends = [
      { nickname: "zed", tag: 1, avatarUrl: null, gamesPlayed: 5 },
      { nickname: "Amy", tag: 9, avatarUrl: null, gamesPlayed: 5 },
      { nickname: "Amy", tag: 2, avatarUrl: null, gamesPlayed: 5 },
      { nickname: "Bo", tag: 1, avatarUrl: null, gamesPlayed: null },
      { nickname: "Cy", tag: 1, avatarUrl: null, gamesPlayed: 0 },
    ]
    expect([...friends].sort(mostPlayedFirst).map((friend) => `${friend.nickname}#${friend.tag}`)).toEqual(["Amy#2", "Amy#9", "zed#1", "Cy#1", "Bo#1"])
  })
})
