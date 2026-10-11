import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  getPlayerId: vi.fn(async (_slug: string): Promise<string | null> => null),
  loginAdmin: vi.fn(async (_login: string, _password: string): Promise<void> => {}),
}))
vi.mock("server-only", () => ({}))
vi.mock("./player", () => ({ getPlayerId: mocks.getPlayerId }))
vi.mock("./admin", () => ({ loginAdmin: mocks.loginAdmin }))

import { POST as adminLogin } from "../routes/api/admin/login/route"
import { ApiError } from "./api"
import { rateLimit, setRateLimitStore } from "./rate-limit"
import { MemoryRateLimitStore } from "./rate-limiter"

const request = (ip: string, body: unknown = { login: "admin", password: "wrong" }) =>
  new Request("http://localhost/api/admin/login", { method: "POST", headers: { "x-forwarded-for": ip }, body: JSON.stringify(body) })

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date("2026-01-01T00:00:00Z"))
  setRateLimitStore(new MemoryRateLimitStore())
  mocks.getPlayerId.mockReset()
  mocks.loginAdmin.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
})

describe("rateLimit", () => {
  it("limits a route shared by every game (no slug) per IP, without reading any player cookie", async () => {
    for (let i = 0; i < 5; i++) await rateLimit(null, request("1.1.1.1"), "adminLogin")
    const error = await rateLimit(null, request("1.1.1.1"), "adminLogin").catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ code: "RATE_LIMITED", status: 429, headers: { "Retry-After": "600" } })
    await expect(rateLimit(null, request("2.2.2.2"), "adminLogin")).resolves.toBeUndefined()
    expect(mocks.getPlayerId).not.toHaveBeenCalled()
  })

  it("accepts the same IP again once the 10 minutes have passed", async () => {
    for (let i = 0; i < 5; i++) await rateLimit(null, request("1.1.1.1"), "adminLogin")
    await expect(rateLimit(null, request("1.1.1.1"), "adminLogin")).rejects.toMatchObject({ status: 429 })
    vi.advanceTimersByTime(10 * 60_000 + 1)
    await expect(rateLimit(null, request("1.1.1.1"), "adminLogin")).resolves.toBeUndefined()
  })

  it("keeps reading the player cookie of the game for the game routes", async () => {
    mocks.getPlayerId.mockResolvedValue("p1")
    await rateLimit("skyjo", request("1.1.1.1"), "action")
    expect(mocks.getPlayerId).toHaveBeenCalledWith("skyjo")
  })
})

describe("POST /api/admin/login", () => {
  it("counts every attempt before looking at the credentials: the 6th one is refused unchecked", async () => {
    mocks.loginAdmin.mockRejectedValue(new ApiError("INVALID_CREDENTIALS", 401))
    for (let i = 0; i < 5; i++) expect((await adminLogin(request("3.3.3.3"))).status).toBe(401)

    const refused = await adminLogin(request("3.3.3.3"))
    expect(refused.status).toBe(429)
    expect(refused.headers.get("Retry-After")).toBe("600")
    expect(await refused.json()).toEqual({ error: "RATE_LIMITED" })
    expect(mocks.loginAdmin).toHaveBeenCalledTimes(5)
  })

  it("refuses even the right password once the limit is reached", async () => {
    mocks.loginAdmin.mockRejectedValue(new ApiError("INVALID_CREDENTIALS", 401))
    for (let i = 0; i < 5; i++) await adminLogin(request("4.4.4.4"))
    mocks.loginAdmin.mockResolvedValue(undefined) // the 6th guess would have been the right one

    expect((await adminLogin(request("4.4.4.4", { login: "admin", password: "right" }))).status).toBe(429)
    expect(mocks.loginAdmin).toHaveBeenCalledTimes(5)
    expect((await adminLogin(request("5.5.5.5", { login: "admin", password: "right" }))).status).toBe(200)
  })
})
