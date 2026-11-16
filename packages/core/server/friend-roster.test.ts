import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn(), readProfiles: vi.fn(), readPlayerTotals: vi.fn() }))

vi.mock("server-only", () => ({}))
vi.mock("./supabase", () => ({ supabaseAdmin: () => ({ from: mocks.from, rpc: mocks.rpc }) }))
vi.mock("./profiles", () => ({ readProfiles: mocks.readProfiles }))
vi.mock("./standings", () => ({ readPlayerTotals: mocks.readPlayerTotals }))

import { mostPlayedFirst, readFriendRoster } from "./friend-roster"

const ME = "0b9f6a52-8c0e-4d6e-9d53-4a1d2f6a7c11"
const ANN = "11111111-1111-4111-8111-111111111111"
const BOB = "22222222-2222-4222-8222-222222222222"
const CAT = "33333333-3333-4333-8333-333333333333"

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
const totals = (...entries: [string, number, number][]) => new Map(entries.map(([id, played, wins]) => [id, { played, wins }]))
const friendsOf = (...rows: { user_b?: string; user_a?: string }[]) => ({ friendships: [{ data: rows.filter((row) => row.user_b), error: null }, { data: rows.filter((row) => row.user_a), error: null }], account_deletions: [{ data: [], error: null }] })

beforeEach(() => {
  mocks.from.mockReset()
  mocks.rpc.mockReset()
  mocks.readProfiles.mockReset()
  mocks.readPlayerTotals.mockReset()
  // The average places are answered unless a test says otherwise
  mocks.rpc.mockResolvedValue({ data: [], error: null })
})

describe("readFriendRoster", () => {
  it("lists the friends from both sides of the friendships, with their handle, their picture and what they did, the ones who played the most first", async () => {
    tables({ friendships: [{ data: [{ user_b: ANN }], error: null }, { data: [{ user_a: BOB }, { user_a: CAT }], error: null }], account_deletions: [{ data: [], error: null }] })
    mocks.readProfiles.mockResolvedValue(
      new Map([
        [ANN, profile(ANN, "Ann", 42, { avatarUrl: "https://cdn.example/ann.png" })],
        [BOB, profile(BOB, "Bob", 7)],
        [CAT, profile(CAT, "Cat", 9)],
      ]),
    )
    mocks.readPlayerTotals.mockResolvedValue(totals([ANN, 12, 3], [BOB, 40, 25]))
    mocks.rpc.mockResolvedValue({ data: [{ friend_id: ANN, avg_place: 2.5 }, { friend_id: BOB, avg_place: "1.8" }], error: null })
    expect(await readFriendRoster(ME)).toEqual([
      { nickname: "Bob", tag: 7, avatarUrl: null, gamesPlayed: 40, winRate: 63, averagePlace: 1.8 },
      { nickname: "Ann", tag: 42, avatarUrl: "https://cdn.example/ann.png", gamesPlayed: 12, winRate: 25, averagePlace: 2.5 },
      // A friend with no game in the totals has finished none: no share of wins to say, and no place
      { nickname: "Cat", tag: 9, avatarUrl: null, gamesPlayed: 0, winRate: null, averagePlace: null },
    ])
    expect(mocks.readProfiles).toHaveBeenCalledWith([ANN, BOB, CAT])
    expect(mocks.readPlayerTotals).toHaveBeenCalledWith([ANN, BOB, CAT])
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("friend_places", { p_user: ME })
  })

  it("rounds the share of wins to a whole percent", async () => {
    tables(friendsOf({ user_b: ANN }, { user_b: BOB }, { user_b: CAT }))
    mocks.readProfiles.mockResolvedValue(new Map([[ANN, profile(ANN, "Ann", 1)], [BOB, profile(BOB, "Bob", 2)], [CAT, profile(CAT, "Cat", 3)]]))
    mocks.readPlayerTotals.mockResolvedValue(totals([ANN, 3, 1], [BOB, 3, 2], [CAT, 8, 8]))
    expect((await readFriendRoster(ME)).map((friend) => `${friend.nickname}=${friend.winRate}`)).toEqual(["Cat=100", "Ann=33", "Bob=67"])
  })

  it("leaves out a friend whose account is closed and one who has no profile", async () => {
    tables({ friendships: [{ data: [{ user_b: ANN }, { user_b: BOB }, { user_b: CAT }], error: null }, { data: [], error: null }], account_deletions: [{ data: [{ user_id: BOB }], error: null }] })
    mocks.readProfiles.mockResolvedValue(new Map([[ANN, profile(ANN, "Ann", 42)], [BOB, profile(BOB, "Bob", 7)]]))
    mocks.readPlayerTotals.mockResolvedValue(new Map())
    expect((await readFriendRoster(ME)).map((friend) => friend.nickname)).toEqual(["Ann"])
  })

  it("says nothing of a friend who keeps their games private, and lists them after the others", async () => {
    tables(friendsOf({ user_b: ANN }, { user_b: BOB }, { user_b: CAT }))
    mocks.readProfiles.mockResolvedValue(new Map([[ANN, profile(ANN, "Ann", 42, { hideHistory: true })], [BOB, profile(BOB, "Bob", 7)], [CAT, profile(CAT, "Cat", 9)]]))
    mocks.readPlayerTotals.mockResolvedValue(totals([ANN, 99, 90], [BOB, 0, 0], [CAT, 3, 1]))
    mocks.rpc.mockResolvedValue({ data: [{ friend_id: ANN, avg_place: 1.1 }, { friend_id: CAT, avg_place: 2 }], error: null })
    expect(await readFriendRoster(ME)).toEqual([
      { nickname: "Cat", tag: 9, avatarUrl: null, gamesPlayed: 3, winRate: 33, averagePlace: 2 },
      { nickname: "Bob", tag: 7, avatarUrl: null, gamesPlayed: 0, winRate: null, averagePlace: null },
      { nickname: "Ann", tag: 42, avatarUrl: null, gamesPlayed: null, winRate: null, averagePlace: null },
    ])
  })

  it("draws the list without the average places where migration 0030 is not applied yet, or where the database cannot answer them", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    for (const failure of [{ code: "PGRST202", message: "Could not find the function public.friend_places" }, { code: "42883", message: "function does not exist" }, { code: "57014", message: "canceling statement due to statement timeout" }]) {
      tables(friendsOf({ user_b: ANN }))
      mocks.readProfiles.mockResolvedValue(new Map([[ANN, profile(ANN, "Ann", 42)]]))
      mocks.readPlayerTotals.mockResolvedValue(totals([ANN, 4, 2]))
      mocks.rpc.mockResolvedValue({ data: null, error: failure })
      expect(await readFriendRoster(ME), failure.code).toEqual([{ nickname: "Ann", tag: 42, avatarUrl: null, gamesPlayed: 4, winRate: 50, averagePlace: null }])
    }
    // Only what the database could not answer is said, and not the function that is missing
    expect(error).toHaveBeenCalledTimes(1)
    error.mockRestore()
  })

  it("keeps only the places that are numbers of a place: nothing for a row that says no friend, a place that is not a number or below the first", async () => {
    tables(friendsOf({ user_b: ANN }, { user_b: BOB }, { user_b: CAT }))
    mocks.readProfiles.mockResolvedValue(new Map([[ANN, profile(ANN, "Ann", 1)], [BOB, profile(BOB, "Bob", 2)], [CAT, profile(CAT, "Cat", 3)]]))
    mocks.readPlayerTotals.mockResolvedValue(totals([ANN, 5, 1], [BOB, 5, 1], [CAT, 5, 1]))
    mocks.rpc.mockResolvedValue({ data: [{ friend_id: ANN, avg_place: "not a number" }, { friend_id: BOB, avg_place: 0 }, { friend_id: CAT, avg_place: 3.4 }, { avg_place: 2 }], error: null })
    expect((await readFriendRoster(ME)).map((friend) => friend.averagePlace)).toEqual([null, null, 3.4])
  })

  it("has nobody for a member with no friend, and asks nothing more", async () => {
    tables({ friendships: [{ data: [], error: null }, { data: [], error: null }] })
    expect(await readFriendRoster(ME)).toEqual([])
    expect(mocks.readProfiles).not.toHaveBeenCalled()
    expect(mocks.readPlayerTotals).not.toHaveBeenCalled()
    expect(mocks.rpc).not.toHaveBeenCalled()
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
    mocks.readPlayerTotals.mockResolvedValue(totals([ANN, 5, 5]))
    expect(await readFriendRoster(ME)).toEqual([{ nickname: "Ann", tag: 42, avatarUrl: null, gamesPlayed: 5, winRate: 100, averagePlace: null }])
  })

  it("throws what else the database says, so that the page logs it and draws no friend", async () => {
    tables({ friendships: [{ data: null, error: { code: "42501", message: "permission denied" } }, { data: [], error: null }] })
    await expect(readFriendRoster(ME)).rejects.toEqual({ code: "42501", message: "permission denied" })
  })
})

describe("mostPlayedFirst", () => {
  const friend = (nickname: string, tag: number, gamesPlayed: number | null) => ({ nickname, tag, avatarUrl: null, gamesPlayed, winRate: null, averagePlace: null })

  it("puts the games played first, then the name whatever its case, then the tag", () => {
    const friends = [friend("zed", 1, 5), friend("Amy", 9, 5), friend("Amy", 2, 5), friend("Bo", 1, null), friend("Cy", 1, 0)]
    expect([...friends].sort(mostPlayedFirst).map((entry) => `${entry.nickname}#${entry.tag}`)).toEqual(["Amy#2", "Amy#9", "zed#1", "Cy#1", "Bo#1"])
  })
})
