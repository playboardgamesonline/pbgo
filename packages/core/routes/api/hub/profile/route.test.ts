import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  account: null as { id: string; nickname?: string } | null,
  saveProfile: vi.fn(async (_userId: string, _handle: { nickname: string; tag: number }): Promise<"ok" | "taken" | "invalid" | "missing"> => "ok"),
  ensureProfile: vi.fn(async (_account: unknown): Promise<object | null> => ({})),
}))

vi.mock("server-only", () => ({}))
vi.mock("@pbgo/accounts/server", () => ({ getAccount: async () => mocks.account }))
vi.mock("../../../../server/player", () => ({ getPlayerId: async () => null }))
vi.mock("../../../../server/profiles", async (importOriginal) => ({ ...(await importOriginal<typeof import("../../../../server/profiles")>()), saveProfile: mocks.saveProfile, ensureProfile: mocks.ensureProfile }))

import { CORE_ERROR_MESSAGES } from "../../../../lib/api"
import { setRateLimitStore } from "../../../../server/rate-limit"
import { MemoryRateLimitStore } from "../../../../server/rate-limiter"
import { GET, POST } from "./route"

const ANN = "0b9f6a52-8c0e-4d6e-9d53-4a1d2f6a7c11"

const request = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("http://localhost/api/hub/profile", { method: "POST", headers: { "x-forwarded-for": "1.1.1.1", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) })
const change = (nickname: unknown, tag: unknown, headers?: Record<string, string>) => POST(request({ nickname, tag }, headers))
const errorOf = async (response: Response) => ((await response.json()) as { error?: string }).error

beforeEach(() => {
  mocks.account = null
  mocks.saveProfile.mockReset()
  mocks.saveProfile.mockResolvedValue("ok")
  mocks.ensureProfile.mockReset()
  mocks.ensureProfile.mockResolvedValue({})
  setRateLimitStore(new MemoryRateLimitStore())
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("POST /api/hub/profile", () => {
  it("gives the signed-in member the nickname and the tag they ask for, and says what was kept", async () => {
    mocks.account = { id: ANN }
    const response = await change("Alex", 42)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ saved: true, nickname: "Alex", tag: 42 })
    expect(mocks.saveProfile).toHaveBeenCalledExactlyOnceWith(ANN, { nickname: "Alex", tag: 42 })
  })

  it("keeps the nickname as it is cleaned, and takes the tag as the member typed it", async () => {
    mocks.account = { id: ANN }
    const response = await change("  Marly   74 ", " #0042 ")
    expect(await response.json()).toEqual({ saved: true, nickname: "Marly 74", tag: 42 })
    expect(mocks.saveProfile).toHaveBeenCalledExactlyOnceWith(ANN, { nickname: "Marly 74", tag: 42 })
  })

  it("changes the profile of the account that is signed in, whatever the request says of who it is", async () => {
    mocks.account = { id: ANN }
    const response = await POST(request({ nickname: "Alex", tag: 42, user_id: "someone-else", userId: "someone-else" }))
    expect(response.status).toBe(200)
    expect(mocks.saveProfile).toHaveBeenCalledExactlyOnceWith(ANN, { nickname: "Alex", tag: 42 })
  })

  it("refuses a visitor who is not signed in, and keeps nothing: a guest has no profile", async () => {
    const response = await change("Alex", 42)
    expect(response.status).toBe(401)
    expect(await errorOf(response)).toBe("NOT_SIGNED_IN")
    expect(mocks.saveProfile).not.toHaveBeenCalled()
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
    ["A\\B", 42],
    ["Alex", undefined],
    ["Alex", null],
    ["Alex", 0],
    ["Alex", "0000"],
    ["Alex", 10000],
    ["Alex", "12345"],
    ["Alex", 4.2],
    ["Alex", "x"],
    ["Alex", [42]],
    ["Alex", {}],
  ])("refuses %j with the tag %j, which no profile can have: nothing is kept", async (nickname, tag) => {
    mocks.account = { id: ANN }
    const response = await change(nickname, tag)
    expect(response.status).toBe(400)
    expect(await errorOf(response)).toBe("PROFILE_INVALID")
    expect(mocks.saveProfile).not.toHaveBeenCalled()
  })

  it("refuses a body that is not JSON", async () => {
    mocks.account = { id: ANN }
    const response = await POST(request("{not json"))
    expect(response.status).toBe(400)
    expect(await errorOf(response)).toBe("INVALID_REQUEST")
    expect(mocks.saveProfile).not.toHaveBeenCalled()
  })

  it("says the pair is taken when somebody else has it, as a conflict", async () => {
    mocks.account = { id: ANN }
    mocks.saveProfile.mockResolvedValue("taken")
    const response = await change("Alex", 42)
    expect(response.status).toBe(409)
    expect(await errorOf(response)).toBe("PROFILE_TAKEN")
  })

  it("refuses what the database finds invalid, though the route let it through", async () => {
    mocks.account = { id: ANN }
    mocks.saveProfile.mockResolvedValue("invalid")
    const response = await change("Alex", 42)
    expect(response.status).toBe(400)
    expect(await errorOf(response)).toBe("PROFILE_INVALID")
  })

  it("makes the profile of an account that has none, and asks again", async () => {
    mocks.account = { id: ANN, nickname: "Ann" }
    mocks.saveProfile.mockResolvedValueOnce("missing").mockResolvedValueOnce("ok")
    const response = await change("Alex", 42)
    expect(response.status).toBe(200)
    expect(mocks.ensureProfile).toHaveBeenCalledExactlyOnceWith(mocks.account)
    expect(mocks.saveProfile).toHaveBeenCalledTimes(2)
  })

  it("says it is not available when the account has no profile and none can be made", async () => {
    mocks.account = { id: ANN }
    mocks.saveProfile.mockResolvedValue("missing")
    mocks.ensureProfile.mockResolvedValue(null)
    const response = await change("Alex", 42)
    expect(response.status).toBe(503)
    expect(await errorOf(response)).toBe("PROFILE_UNAVAILABLE")
    expect(mocks.saveProfile).toHaveBeenCalledTimes(1)
  })

  it("says it is not available when the profile that was made is still not there", async () => {
    mocks.account = { id: ANN }
    mocks.saveProfile.mockResolvedValue("missing")
    const response = await change("Alex", 42)
    expect(response.status).toBe(503)
    expect(await errorOf(response)).toBe("PROFILE_UNAVAILABLE")
    expect(mocks.saveProfile).toHaveBeenCalledTimes(2)
  })

  it("says it is not available where the database has not got the profiles yet, and not that something broke", async () => {
    mocks.account = { id: ANN }
    mocks.saveProfile.mockRejectedValue({ code: "PGRST202", message: "Could not find the function public.set_profile" })
    const response = await change("Alex", 42)
    expect(response.status).toBe(503)
    expect(await errorOf(response)).toBe("PROFILE_UNAVAILABLE")
  })

  it("answers with an error when the database fails otherwise, so that the member is not told it is saved", async () => {
    mocks.account = { id: ANN }
    mocks.saveProfile.mockRejectedValue(new Error("connection refused"))
    const response = await change("Alex", 42)
    expect(response.status).toBe(500)
    expect(await errorOf(response)).toBe("SERVER_ERROR")
  })

  it("keeps nothing for the demo account of development, which is in no database, and says it is saved", async () => {
    mocks.account = { id: "demo" }
    const response = await change("Alex", 42)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ saved: true, nickname: "Alex", tag: 42 })
    expect(mocks.saveProfile).not.toHaveBeenCalled()
  })

  it("refuses a request that comes from another site: it acts on the strength of a cookie", async () => {
    mocks.account = { id: ANN }
    const refused = await change("Alex", 42, { origin: "https://evil.example" })
    expect(refused.status).toBe(403)
    expect(await errorOf(refused)).toBe("CROSS_ORIGIN")
    expect(mocks.saveProfile).not.toHaveBeenCalled()
    expect((await change("Alex", 42, { origin: "http://localhost" })).status).toBe(200)
    // A client that says nothing is a script, with no cookie of ours to abuse
    expect((await change("Alex", 43)).status).toBe(200)
  })

  it("limits a script that tries pair after pair, per IP", async () => {
    mocks.account = { id: ANN }
    mocks.saveProfile.mockResolvedValue("taken")
    for (let i = 0; i < 20; i++) expect((await change("Alex", 42, { "x-forwarded-for": "2.2.2.2" })).status).toBe(409)
    const refused = await change("Alex", 42, { "x-forwarded-for": "2.2.2.2" })
    expect(refused.status).toBe(429)
    expect(await errorOf(refused)).toBe("RATE_LIMITED")
    expect((await change("Alex", 42, { "x-forwarded-for": "3.3.3.3" })).status).toBe(409)
  })

  it("has a message in the platform's wording for each of its refusals: a member never reads [missing: …]", () => {
    for (const code of ["NOT_SIGNED_IN", "PROFILE_INVALID", "PROFILE_TAKEN", "PROFILE_UNAVAILABLE", "CROSS_ORIGIN", "INVALID_REQUEST", "RATE_LIMITED", "SERVER_ERROR"]) expect(CORE_ERROR_MESSAGES[code], code).toBeTruthy()
  })
})

describe("GET /api/hub/profile", () => {
  const ask = (ip = "1.1.1.1") => GET(new Request("http://localhost/api/hub/profile", { headers: { "x-forwarded-for": ip } }))

  it("says the signed-in member's own nickname and tag, the profile's", async () => {
    mocks.account = { id: ANN, nickname: "Anne Martin" }
    mocks.ensureProfile.mockResolvedValue({ userId: ANN, nickname: "Annie", tag: 7 })
    const response = await ask()
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ nickname: "Annie", tag: 7 })
    expect(mocks.ensureProfile).toHaveBeenCalledExactlyOnceWith(mocks.account)
  })

  it("is a 401 for a visitor who is not signed in, and reads nothing", async () => {
    const response = await ask()
    expect(response.status).toBe(401)
    expect(await errorOf(response)).toBe("NOT_SIGNED_IN")
    expect(mocks.ensureProfile).not.toHaveBeenCalled()
  })

  it("says the account's name with no tag where the database has no profile for the member (the migration is not applied yet)", async () => {
    mocks.account = { id: ANN, nickname: "Anne Martin" }
    mocks.ensureProfile.mockResolvedValue(null)
    expect(await (await ask()).json()).toEqual({ nickname: "Anne Martin", tag: null })
  })

  it("says the same when the database cannot be read, and the menu is not broken by it: the cause is in the log", async () => {
    mocks.account = { id: ANN, nickname: "Anne Martin" }
    mocks.ensureProfile.mockRejectedValue(new Error("connection refused"))
    const response = await ask()
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ nickname: "Anne Martin", tag: null })
    expect(console.error).toHaveBeenCalled()
  })

  it("gives the demo account of development its made-up tag, and reads nothing", async () => {
    mocks.account = { id: "demo", nickname: "Demo" }
    expect(await (await ask()).json()).toEqual({ nickname: "Demo", tag: 1 })
    expect(mocks.ensureProfile).not.toHaveBeenCalled()
  })

  it("is limited per IP, with room for a page load each time a few tabs are open", async () => {
    mocks.account = { id: ANN, nickname: "Anne" }
    mocks.ensureProfile.mockResolvedValue({ userId: ANN, nickname: "Anne", tag: 1 })
    for (let i = 0; i < 120; i++) expect((await ask("2.2.2.2")).status).toBe(200)
    const refused = await ask("2.2.2.2")
    expect(refused.status).toBe(429)
    expect(await errorOf(refused)).toBe("RATE_LIMITED")
    expect((await ask("3.3.3.3")).status).toBe(200)
  })
})
