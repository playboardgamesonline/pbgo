import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ readProfileByHandle: vi.fn(), readProfileXp: vi.fn(), readRelation: vi.fn(), memberGames: vi.fn(), readFriendRoster: vi.fn() }))

vi.mock("server-only", () => ({}))
vi.mock("@pbgo/core/server/profiles", () => ({ ensureProfile: vi.fn(), readProfileByHandle: mocks.readProfileByHandle, readProfileDetails: vi.fn(), readProfileXp: mocks.readProfileXp }))
vi.mock("@pbgo/core/server/friends", () => ({ readRelation: mocks.readRelation }))
vi.mock("@pbgo/core/server/friend-roster", () => ({ readFriendRoster: mocks.readFriendRoster, mostPlayedFirst: (a: { gamesPlayed: number | null }, b: { gamesPlayed: number | null }) => (b.gamesPlayed ?? -1) - (a.gamesPlayed ?? -1) }))
vi.mock("./member-games", () => ({ memberGames: mocks.memberGames }))

import { noProfileDetails, type Account } from "@pbgo/accounts"
import { DEMO_ACCOUNT, DEMO_TAG } from "@pbgo/accounts/demo"
import { DEMO_FRIENDS } from "./demo-data"
import { profilePage } from "./profile-data"

const ME = "0b9f6a52-8c0e-4d6e-9d53-4a1d2f6a7c11"
const ANN = "11111111-1111-4111-8111-111111111111"

const account = (id: string): Account => ({ ...DEMO_ACCOUNT, id })
const record = (userId: string, nickname: string, tag: number, over: Record<string, unknown> = {}) => ({ userId, nickname, tag, avatarUrl: null, hideHistory: false, createdAt: "2026-10-01T09:00:00.000Z", details: noProfileDetails(), ...over })
const roster = [{ nickname: "Bob", tag: 2, avatarUrl: null, gamesPlayed: 12, winRate: 50, averagePlace: 2.4 }]

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset()
  mocks.memberGames.mockResolvedValue({ games: [], perGame: [], ranks: [] })
  mocks.readProfileXp.mockResolvedValue(0)
  mocks.readRelation.mockResolvedValue("none")
  mocks.readFriendRoster.mockResolvedValue(roster)
})

describe("the friends of a profile page", () => {
  it("are the member's own, on their own profile", async () => {
    mocks.readProfileByHandle.mockResolvedValue(record(ME, "Me", 1))
    const page = await profilePage({ nickname: "Me", tag: 1 }, account(ME), 10)
    expect(page?.own).toBe(true)
    expect(page?.friends).toEqual(roster)
    expect(mocks.readFriendRoster).toHaveBeenCalledExactlyOnceWith(ME)
  })

  it("are never given to another visitor, and the database is not asked for them", async () => {
    mocks.readProfileByHandle.mockResolvedValue(record(ANN, "Ann", 7))
    const page = await profilePage({ nickname: "Ann", tag: 7 }, account(ME), 10)
    expect(page?.own).toBe(false)
    expect(page).not.toHaveProperty("friends")
    expect(mocks.readFriendRoster).not.toHaveBeenCalled()
  })

  it("are never given to a visitor who is not signed in, nor when the member hides their games", async () => {
    mocks.readProfileByHandle.mockResolvedValue(record(ANN, "Ann", 7))
    expect(await profilePage({ nickname: "Ann", tag: 7 }, null, 10)).not.toHaveProperty("friends")
    mocks.readProfileByHandle.mockResolvedValue(record(ANN, "Ann", 7, { hideHistory: true }))
    expect(await profilePage({ nickname: "Ann", tag: 7 }, account(ME), 10)).not.toHaveProperty("friends")
    expect(mocks.readFriendRoster).not.toHaveBeenCalled()
  })

  it("are the visitor's, never the member's whose page it is: the roster is read for the visitor's account", async () => {
    mocks.readProfileByHandle.mockResolvedValue(record(ME, "Me", 1))
    await profilePage({ nickname: "Me", tag: 1 }, account(ME), 10)
    expect(mocks.readFriendRoster.mock.calls.map(([id]) => id)).toEqual([ME])
  })

  it("leave the zone out, as a null, where the member's friends cannot be read: the page does not say they have none", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    mocks.readProfileByHandle.mockResolvedValue(record(ME, "Me", 1))
    mocks.readFriendRoster.mockRejectedValue(new Error("the database is away"))
    const page = await profilePage({ nickname: "Me", tag: 1 }, account(ME), 10)
    expect(page?.own).toBe(true)
    expect(page?.friends).toBeNull()
    error.mockRestore()
  })

  it("are the made-up ones for the demo account on its own profile, and are not given to it on anybody else's", async () => {
    const own = await profilePage({ nickname: DEMO_ACCOUNT.nickname, tag: DEMO_TAG }, DEMO_ACCOUNT, 10)
    expect(own?.own).toBe(true)
    expect(own?.friends?.map((friend) => friend.nickname).sort()).toEqual(DEMO_FRIENDS.map((friend) => friend.nickname).sort())
    expect(mocks.readFriendRoster).not.toHaveBeenCalled()

    mocks.readProfileByHandle.mockResolvedValue(record(ANN, "Ann", 7))
    const other = await profilePage({ nickname: "Ann", tag: 7 }, DEMO_ACCOUNT, 10)
    expect(other?.own).toBe(false)
    expect(other).not.toHaveProperty("friends")
  })
})
