import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  account: null as { id: string; email: string | null; nickname: string } | null,
  available: true,
  sent: "sent" as "sent" | "logged" | "unavailable" | "failed",
  order: [] as string[],
  clearSessionCookies: vi.fn(),
  closeAccount: vi.fn(),
  reopenAccount: vi.fn(),
  peekReopenLink: vi.fn(),
  eraseAccount: vi.fn(),
  sendMail: vi.fn(),
}))

vi.mock("server-only", () => ({}))
vi.mock("@pbgo/accounts/server", () => ({ getAccount: async () => mocks.account, clearSessionCookies: mocks.clearSessionCookies }))
vi.mock("../../../../../server/player", () => ({ getPlayerId: async () => null }))
vi.mock("../../../../../server/account-deletion", () => ({
  newReopenToken: () => "T".repeat(43),
  closeAccount: mocks.closeAccount,
  reopenAccount: mocks.reopenAccount,
  peekReopenLink: mocks.peekReopenLink,
  eraseAccount: mocks.eraseAccount,
}))
vi.mock("../../../../../server/mail", () => ({ mailAvailable: () => mocks.available, sendMail: mocks.sendMail }))

import { setRateLimitStore } from "../../../../../server/rate-limit"
import { MemoryRateLimitStore } from "../../../../../server/rate-limiter"
import { deletionRoute } from "./route"

const USER = "3f2b8c1e-5a47-4d0e-9b6a-1c2d3e4f5a6b"
const TOKEN = "T".repeat(43)
const compose = vi.fn((input: { to: string; name: string; link: string; until: string }) => ({
  from: "Site <no-reply@mail.example.test>",
  to: input.to,
  subject: `for ${input.name}`,
  text: `${input.link} until ${input.until}`,
  html: input.link,
}))
const POST = deletionRoute(compose)

const call = (body: unknown, { origin, ip = "1.1.1.1" }: { origin?: string; ip?: string } = {}) =>
  POST(new Request("http://localhost:3140/api/hub/account/deletion", { method: "POST", headers: { "x-forwarded-for": ip, "content-type": "application/json", ...(origin ? { origin } : {}) }, body: typeof body === "string" ? body : JSON.stringify(body) }))

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date("2026-11-09T12:00:00.000Z"))
  mocks.account = { id: USER, email: "ore@example.com", nickname: "Oré" }
  mocks.available = true
  mocks.sent = "sent"
  mocks.order.length = 0
  mocks.clearSessionCookies.mockReset().mockImplementation(async () => {
    mocks.order.push("cookies")
  })
  mocks.closeAccount.mockReset().mockImplementation(async (_user: string, _token: string, day: Date) => {
    mocks.order.push("close")
    return day
  })
  mocks.reopenAccount.mockReset().mockResolvedValue(true)
  mocks.peekReopenLink.mockReset().mockResolvedValue({ email: "ore@example.com", reopensUntil: new Date("2026-11-16T23:59:59.999Z") })
  mocks.eraseAccount.mockReset().mockResolvedValue({ erased: true, feedback: 0, screenshots: 0 })
  mocks.sendMail.mockReset().mockImplementation(async () => {
    mocks.order.push("mail")
    return mocks.sent
  })
  compose.mockClear()
  setRateLimitStore(new MemoryRateLimitStore())
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe("a member deletes their account (intent close)", () => {
  it("mails the link first, then closes the account, then takes the cookies of the browser, and answers with the address masked and the day", async () => {
    const response = await call({ intent: "close" }, { origin: "http://localhost:3140" })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, to: "o•••@example.com", scheduledFor: "2026-11-16T23:59:59.999Z" })
    expect(mocks.order).toEqual(["mail", "close", "cookies"])
    expect(compose).toHaveBeenCalledWith({ to: "ore@example.com", name: "Oré", link: `http://localhost:3140/auth/reopen-account?u=${USER}&t=${TOKEN}`, until: "16 November 2026" })
    expect(mocks.closeAccount).toHaveBeenCalledWith(USER, TOKEN, new Date("2026-11-16T23:59:59.999Z"))
  })

  it("never takes the address from the request: a body that names another one changes nothing", async () => {
    await call({ intent: "close", email: "someone@else.com", to: "someone@else.com" })
    expect(compose).toHaveBeenCalledWith(expect.objectContaining({ to: "ore@example.com" }))
  })

  it("points the link to the site the member is on, so that a preview deployment's link opens on that preview", async () => {
    await POST(new Request("https://pbgo-git-plt-36-playboardgamesonline.vercel.app/api/hub/account/deletion", { method: "POST", body: JSON.stringify({ intent: "close" }) }))
    expect(compose.mock.calls[0]![0].link.startsWith("https://pbgo-git-plt-36-playboardgamesonline.vercel.app/auth/reopen-account?")).toBe(true)
  })

  it("is for a signed-in member alone", async () => {
    mocks.account = null
    const response = await call({ intent: "close" })
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: "NOT_SIGNED_IN" })
    expect(mocks.sendMail).not.toHaveBeenCalled()
    expect(mocks.closeAccount).not.toHaveBeenCalled()
  })

  it("is for no demo account: it is in no database", async () => {
    mocks.account = { id: "demo", email: "ore@example.com", nickname: "Oré" }
    expect((await call({ intent: "close" })).status).toBe(401)
    expect(mocks.sendMail).not.toHaveBeenCalled()
    expect(mocks.closeAccount).not.toHaveBeenCalled()
  })

  it("refuses an account without an address that mail can reach, the stand-in of a provider that gives none included: there would be no way back", async () => {
    for (const email of [null, "steam-3f2b8c1e@external.pbgo.invalid"]) {
      mocks.account = { id: USER, email, nickname: "Marly" }
      const response = await call({ intent: "close" })
      expect(response.status).toBe(409)
      expect(await response.json()).toEqual({ error: "NO_MAILBOX" })
    }
    expect(mocks.sendMail).not.toHaveBeenCalled()
    expect(mocks.closeAccount).not.toHaveBeenCalled()
  })

  it("is closed where no e-mail can leave (production with no key), before anything is sent or closed", async () => {
    mocks.available = false
    const response = await call({ intent: "close" })
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: "MAIL_UNAVAILABLE" })
    expect(mocks.sendMail).not.toHaveBeenCalled()
    expect(mocks.closeAccount).not.toHaveBeenCalled()
  })

  it("leaves the account open when the e-mail could not leave, and says so: nobody is locked out of an account with no link to get back in", async () => {
    mocks.sent = "failed"
    const response = await call({ intent: "close" })
    expect(response.status).toBe(502)
    expect(await response.json()).toEqual({ error: "MAIL_FAILED" })
    mocks.sent = "unavailable"
    expect(await (await call({ intent: "close" })).json()).toEqual({ error: "MAIL_UNAVAILABLE" })
    expect(mocks.closeAccount).not.toHaveBeenCalled()
    expect(mocks.clearSessionCookies).not.toHaveBeenCalled()
  })

  it("counts an e-mail printed by a development server with no key as sent", async () => {
    mocks.sent = "logged"
    expect((await call({ intent: "close" })).status).toBe(200)
    expect(mocks.closeAccount).toHaveBeenCalledTimes(1)
  })

  it("answers that the member is signed out when the account was closed in the meantime, and keeps the cookies as they are", async () => {
    mocks.closeAccount.mockResolvedValue(null)
    const response = await call({ intent: "close" })
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: "NOT_SIGNED_IN" })
    expect(mocks.clearSessionCookies).not.toHaveBeenCalled()
  })

  it("answers an error, and leaves the cookies, when the database cannot close the account", async () => {
    mocks.closeAccount.mockRejectedValue(new Error("close_account: deadlock detected"))
    const response = await call({ intent: "close" })
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: "SERVER_ERROR" })
    expect(mocks.clearSessionCookies).not.toHaveBeenCalled()
  })

  it("refuses a request that comes from another site: the cookie is the only proof here", async () => {
    const response = await call({ intent: "close" }, { origin: "https://evil.example" })
    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: "CROSS_ORIGIN" })
    expect(mocks.sendMail).not.toHaveBeenCalled()
    expect(mocks.closeAccount).not.toHaveBeenCalled()
  })
})

describe("the account is reopened, from the page the link opens (intent reopen)", () => {
  it("opens it again on the token of the link, with no session at all, and answers that it worked", async () => {
    mocks.account = null
    const response = await call({ intent: "reopen", user: USER, token: TOKEN })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
    expect(mocks.reopenAccount).toHaveBeenCalledWith(USER, TOKEN)
  })

  it("does not look at where it comes from: the token is the proof, and a form of another site does not have it", async () => {
    expect((await call({ intent: "reopen", user: USER, token: TOKEN }, { origin: "https://mail.example" })).status).toBe(200)
  })

  it("refuses a link whose days are over, that was used, or that is not the one of a closed account", async () => {
    mocks.reopenAccount.mockResolvedValue(false)
    const response = await call({ intent: "reopen", user: USER, token: TOKEN })
    expect(response.status).toBe(410)
    expect(await response.json()).toEqual({ error: "LINK_INVALID" })
  })

  it("refuses what is not an account and a token before it asks the database anything", async () => {
    for (const body of [{ intent: "reopen" }, { intent: "reopen", user: "demo", token: TOKEN }, { intent: "reopen", user: USER, token: "short" }, { intent: "reopen", user: USER, token: 42 }, { intent: "reopen", user: [USER], token: TOKEN }]) {
      const response = await call(body)
      expect(response.status, JSON.stringify(body)).toBe(400)
      expect(await response.json()).toEqual({ error: "INVALID_REQUEST" })
    }
    expect(mocks.reopenAccount).not.toHaveBeenCalled()
  })
})

describe("the account is deleted without waiting (intent now)", () => {
  it("looks at the link first, then deletes the account with the feedback sent with the address the database found for it", async () => {
    mocks.account = null
    const response = await call({ intent: "now", user: USER, token: TOKEN })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
    expect(mocks.peekReopenLink).toHaveBeenCalledWith(USER, TOKEN)
    expect(mocks.eraseAccount).toHaveBeenCalledWith(USER, "ore@example.com")
  })

  it("deletes nothing for a link that is not good: the token is the only proof, and the function that deletes takes anyone's id", async () => {
    mocks.peekReopenLink.mockResolvedValue(null)
    const response = await call({ intent: "now", user: USER, token: TOKEN })
    expect(response.status).toBe(410)
    expect(await response.json()).toEqual({ error: "LINK_INVALID" })
    expect(mocks.eraseAccount).not.toHaveBeenCalled()
  })

  it("refuses what is not an account and a token, and answers an error when the database cannot delete", async () => {
    expect((await call({ intent: "now", user: USER })).status).toBe(400)
    expect((await call({ intent: "now", user: "demo", token: TOKEN })).status).toBe(400)
    expect(mocks.peekReopenLink).not.toHaveBeenCalled()
    mocks.eraseAccount.mockRejectedValue(new Error("erase_account: deadlock detected"))
    const response = await call({ intent: "now", user: USER, token: TOKEN })
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: "SERVER_ERROR" })
  })
})

describe("what is asked", () => {
  it("refuses an intent nobody planned, those of the held-account design included, and a body that is not JSON", async () => {
    for (const intent of ["export", "request", "confirm", "keep"]) expect((await call({ intent })).status, intent).toBe(400)
    expect((await call({})).status).toBe(400)
    expect((await call("not json")).status).toBe(400)
  })

  it("limits a script, per IP: ten asks an hour", async () => {
    for (let i = 0; i < 10; i++) expect((await call({ intent: "reopen", user: USER, token: TOKEN }, { ip: "2.2.2.2" })).status).toBe(200)
    const response = await call({ intent: "reopen", user: USER, token: TOKEN }, { ip: "2.2.2.2" })
    expect(response.status).toBe(429)
    expect(await response.json()).toEqual({ error: "RATE_LIMITED" })
    expect((await call({ intent: "reopen", user: USER, token: TOKEN }, { ip: "3.3.3.3" })).status).toBe(200)
  })
})
