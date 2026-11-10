import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))

vi.mock("server-only", () => ({}))
vi.mock("./supabase", () => ({ supabaseAdmin: () => ({ rpc: mocks.rpc }) }))

import { markSeen, seatMember, touchMember } from "./presence"

const USER = "0b9f6a52-8c0e-4d6e-9d53-4a1d2f6a7c11"

beforeEach(() => {
  mocks.rpc.mockReset()
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("touchMember", () => {
  it("asks the database to record the member as seen now", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null })
    await touchMember(USER)
    expect(mocks.rpc).toHaveBeenCalledWith("touch_member", { p_user: USER })
  })

  it("throws what the database says, so the route can answer with an error and the browser wait longer", async () => {
    const error = new Error("function public.touch_member(uuid) does not exist")
    mocks.rpc.mockResolvedValue({ data: null, error })
    await expect(touchMember(USER)).rejects.toBe(error)
  })
})

describe("seatMember", () => {
  it("records which account holds the seat of a table", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null })
    await seatMember({ slug: "courtisans" }, "ABCD", "seat-1", USER)
    expect(mocks.rpc).toHaveBeenCalledWith("seat_member", { p_game: "courtisans", p_code: "ABCD", p_seat: "seat-1", p_user: USER })
  })

  it("writes nothing for a guest", async () => {
    await seatMember({ slug: "courtisans" }, "ABCD", "seat-1", null)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it("never throws: a failure is logged and the join goes on", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: new Error("column games.member_ids does not exist") })
    await expect(seatMember({ slug: "courtisans" }, "ABCD", "seat-1", USER)).resolves.toBeUndefined()
    mocks.rpc.mockRejectedValue(new Error("network down"))
    await expect(seatMember({ slug: "courtisans" }, "ABCD", "seat-1", USER)).resolves.toBeUndefined()
    expect(console.error).toHaveBeenCalledTimes(2)
  })
})

describe("markSeen", () => {
  const NOW = Date.parse("2026-11-10T10:00:00.000Z")
  const table = (players: Array<{ id: string; nickname: string; left?: boolean }>) => ({ code: "ABCD", players, seen: {} })

  it("records a player who sits at the table", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null })
    await markSeen({ slug: "courtisans" }, table([{ id: "p1", nickname: "Ann" }]), "p1", NOW)
    expect(mocks.rpc).toHaveBeenCalledWith("touch_game_player", { p_game: "courtisans", p_code: "ABCD", p_player: "p1" })
  })

  it("records nobody who is not at the table, and nobody who left it: they are not present any more", async () => {
    await markSeen({ slug: "courtisans" }, table([{ id: "p1", nickname: "Ann", left: true }]), "p1", NOW)
    await markSeen({ slug: "courtisans" }, table([{ id: "p1", nickname: "Ann" }]), "stranger", NOW)
    await markSeen({ slug: "courtisans" }, table([{ id: "p1", nickname: "Ann" }]), null, NOW)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
})
