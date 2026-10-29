import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))

vi.mock("server-only", () => ({}))
vi.mock("./supabase", () => ({ supabaseAdmin: () => ({ rpc: mocks.rpc }) }))

import { loadPlayerCount } from "./stats"

describe("loadPlayerCount", () => {
  beforeEach(() => mocks.rpc.mockReset())

  it("asks the database for player_count() and returns the number", async () => {
    mocks.rpc.mockResolvedValue({ data: 1280, error: null })
    expect(await loadPlayerCount()).toBe(1280)
    expect(mocks.rpc).toHaveBeenCalledWith("player_count")
  })

  it("reads a bigint that came as a string", async () => {
    mocks.rpc.mockResolvedValue({ data: "42", error: null })
    expect(await loadPlayerCount()).toBe(42)
  })

  it("counts none as zero, not as missing", async () => {
    mocks.rpc.mockResolvedValue({ data: 0, error: null })
    expect(await loadPlayerCount()).toBe(0)
  })

  it("throws what the database says, so the page can leave the figure out", async () => {
    const error = new Error("function public.player_count() does not exist")
    mocks.rpc.mockResolvedValue({ data: null, error })
    await expect(loadPlayerCount()).rejects.toBe(error)
  })

  it("throws on an answer that is not a count", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null })
    await expect(loadPlayerCount()).rejects.toThrow("player_count() answered")
    mocks.rpc.mockResolvedValue({ data: -3, error: null })
    await expect(loadPlayerCount()).rejects.toThrow("player_count() answered")
  })
})
