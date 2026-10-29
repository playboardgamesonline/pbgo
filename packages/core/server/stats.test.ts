import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))

vi.mock("server-only", () => ({}))
vi.mock("./supabase", () => ({ supabaseAdmin: () => ({ rpc: mocks.rpc }) }))

import { loadMemberCount, loadOnlinePlayerCount } from "./stats"

describe.each([
  ["loadOnlinePlayerCount", loadOnlinePlayerCount, "online_player_count"],
  ["loadMemberCount", loadMemberCount, "member_count"],
] as const)("%s", (_name, load, fn) => {
  beforeEach(() => mocks.rpc.mockReset())

  it(`asks the database for ${fn}() and returns the number`, async () => {
    mocks.rpc.mockResolvedValue({ data: 1280, error: null })
    expect(await load()).toBe(1280)
    expect(mocks.rpc).toHaveBeenCalledWith(fn)
  })

  it("reads a bigint that came as a string", async () => {
    mocks.rpc.mockResolvedValue({ data: "42", error: null })
    expect(await load()).toBe(42)
  })

  it("counts none as zero, not as missing", async () => {
    mocks.rpc.mockResolvedValue({ data: 0, error: null })
    expect(await load()).toBe(0)
  })

  it("throws what the database says, so the page can leave the figure out", async () => {
    const error = new Error(`function public.${fn}() does not exist`)
    mocks.rpc.mockResolvedValue({ data: null, error })
    await expect(load()).rejects.toBe(error)
  })

  it("throws on an answer that is not a count", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null })
    await expect(load()).rejects.toThrow(`${fn}() answered`)
    mocks.rpc.mockResolvedValue({ data: -3, error: null })
    await expect(load()).rejects.toThrow(`${fn}() answered`)
  })
})
