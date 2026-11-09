import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  account: null as { id: string } | null,
  saveBirthdate: vi.fn(async (_userId: string, _birthdate: string): Promise<boolean> => true),
}))

vi.mock("server-only", () => ({}))
vi.mock("@pbgo/accounts/server", () => ({ getAccount: async () => mocks.account }))
vi.mock("../../../../server/player", () => ({ getPlayerId: async () => null }))
vi.mock("../../../../server/birthdate", () => ({ saveBirthdate: mocks.saveBirthdate }))

import { CORE_ERROR_MESSAGES } from "../../../../lib/api"
import { setRateLimitStore } from "../../../../server/rate-limit"
import { MemoryRateLimitStore } from "../../../../server/rate-limiter"
import { POST } from "./route"

const ANN = "0b9f6a52-8c0e-4d6e-9d53-4a1d2f6a7c11"

const request = (body: unknown, ip = "1.1.1.1") => new Request("http://localhost/api/hub/birthdate", { method: "POST", headers: { "x-forwarded-for": ip }, body: typeof body === "string" ? body : JSON.stringify(body) })
const declare = (birthdate: unknown, ip?: string) => POST(request({ birthdate }, ip))
const errorOf = async (response: Response) => ((await response.json()) as { error?: string }).error

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date("2026-11-09T12:00:00Z"))
  mocks.account = null
  mocks.saveBirthdate.mockReset()
  mocks.saveBirthdate.mockResolvedValue(true)
  setRateLimitStore(new MemoryRateLimitStore())
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
})

describe("POST /api/hub/birthdate", () => {
  it("keeps the date a signed-in member declares, for that member, and says so", async () => {
    mocks.account = { id: ANN }
    const response = await declare("1990-04-02")
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ saved: true })
    expect(mocks.saveBirthdate).toHaveBeenCalledExactlyOnceWith(ANN, "1990-04-02")
  })

  it("keeps the date for the account that is signed in, whatever the request says of who it is", async () => {
    mocks.account = { id: ANN }
    const response = await POST(request({ birthdate: "1990-04-02", user_id: "someone-else", userId: "someone-else" }))
    expect(response.status).toBe(200)
    expect(mocks.saveBirthdate).toHaveBeenCalledExactlyOnceWith(ANN, "1990-04-02")
  })

  it("refuses a visitor who is not signed in, and keeps nothing: a guest has no date", async () => {
    const response = await declare("1990-04-02")
    expect(response.status).toBe(401)
    expect(await errorOf(response)).toBe("NOT_SIGNED_IN")
    expect(mocks.saveBirthdate).not.toHaveBeenCalled()
  })

  it.each([undefined, null, 19900402, "", "1990-4-2", "1990-13-01", "1990-02-30", "2030-01-01", "1900-01-01", "not a date", "1990-04-02T00:00:00Z", ["1990-04-02"], { year: 1990 }])(
    "refuses %j, which is not a date of birth: nothing is kept",
    async (value) => {
      mocks.account = { id: ANN }
      const response = await declare(value)
      expect(response.status).toBe(400)
      expect(await errorOf(response)).toBe("BIRTHDATE_INVALID")
      expect(mocks.saveBirthdate).not.toHaveBeenCalled()
    },
  )

  it("refuses a date that makes the member younger than 13, down to the day before their 13th birthday, and keeps nothing", async () => {
    mocks.account = { id: ANN }
    for (const value of ["2013-11-10", "2020-06-01", "2026-11-09"]) {
      const response = await declare(value)
      expect(response.status, value).toBe(400)
      expect(await errorOf(response), value).toBe("BIRTHDATE_UNDER_MINIMUM")
    }
    expect(mocks.saveBirthdate).not.toHaveBeenCalled()
  })

  it("keeps the date of a member who turns 13 today", async () => {
    mocks.account = { id: ANN }
    expect((await declare("2013-11-09")).status).toBe(200)
    expect(mocks.saveBirthdate).toHaveBeenCalledExactlyOnceWith(ANN, "2013-11-09")
  })

  it("refuses a body that is not JSON", async () => {
    mocks.account = { id: ANN }
    const response = await POST(request("{not json"))
    expect(response.status).toBe(400)
    expect(await errorOf(response)).toBe("INVALID_REQUEST")
    expect(mocks.saveBirthdate).not.toHaveBeenCalled()
  })

  it("says the date is locked when the account has one already: it is declared once and never replaced", async () => {
    mocks.account = { id: ANN }
    mocks.saveBirthdate.mockResolvedValue(false)
    const response = await declare("1980-01-01")
    expect(response.status).toBe(409)
    expect(await errorOf(response)).toBe("BIRTHDATE_LOCKED")
  })

  it("keeps nothing for the demo account of development, which is in no database, and says it is saved", async () => {
    mocks.account = { id: "demo" }
    const response = await declare("1990-04-02")
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ saved: true })
    expect(mocks.saveBirthdate).not.toHaveBeenCalled()
  })

  it("answers with an error when the database cannot keep it, so that the member is not told it is saved", async () => {
    mocks.account = { id: ANN }
    mocks.saveBirthdate.mockRejectedValue(new Error("function public.set_member_birthdate(uuid, date) does not exist"))
    const response = await declare("1990-04-02")
    expect(response.status).toBe(500)
    expect(await errorOf(response)).toBe("SERVER_ERROR")
  })

  it("limits a script that tries date after date, per IP", async () => {
    mocks.account = { id: ANN }
    mocks.saveBirthdate.mockResolvedValue(false)
    for (let i = 0; i < 20; i++) expect((await declare("1980-01-01", "2.2.2.2")).status).toBe(409)
    const refused = await declare("1980-01-01", "2.2.2.2")
    expect(refused.status).toBe(429)
    expect(await errorOf(refused)).toBe("RATE_LIMITED")
    expect((await declare("1980-01-01", "3.3.3.3")).status).toBe(409)
  })

  it("has a message in the platform's wording for each of its refusals: a member never reads [missing: …]", () => {
    for (const code of ["NOT_SIGNED_IN", "BIRTHDATE_INVALID", "BIRTHDATE_UNDER_MINIMUM", "BIRTHDATE_LOCKED", "INVALID_REQUEST", "RATE_LIMITED", "SERVER_ERROR"]) expect(CORE_ERROR_MESSAGES[code], code).toBeTruthy()
  })
})
