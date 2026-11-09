import { beforeEach, describe, expect, it, vi } from "vitest"

type Held = { id: string; email: string | null }

const mocks = vi.hoisted(() => ({
  account: null as { id: string; email: string | null; nickname: string } | null,
  held: null as Held | null,
  auth: { refreshSession: vi.fn(async () => ({})), signOut: vi.fn(async () => ({})) },
  available: true,
  sent: "sent" as "sent" | "logged" | "unavailable" | "failed",
  requestDeletionLink: vi.fn(),
  confirmDeletion: vi.fn(),
  keepAccount: vi.fn(),
  eraseAccount: vi.fn(),
  sendMail: vi.fn(),
}))

vi.mock("server-only", () => ({}))
vi.mock("@pbgo/accounts/server", () => ({ getAccount: async () => mocks.account, getHeldAccount: async () => mocks.held, createAuthClient: async () => ({ auth: mocks.auth }) }))
vi.mock("../../../../../server/player", () => ({ getPlayerId: async () => null }))
vi.mock("../../../../../server/account-deletion", () => ({
  requestDeletionLink: mocks.requestDeletionLink,
  confirmDeletion: mocks.confirmDeletion,
  keepAccount: mocks.keepAccount,
  eraseAccount: mocks.eraseAccount,
}))
vi.mock("../../../../../server/mail", () => ({ mailAvailable: () => mocks.available, sendMail: mocks.sendMail }))

import { setRateLimitStore } from "../../../../../server/rate-limit"
import { MemoryRateLimitStore } from "../../../../../server/rate-limiter"
import { deletionRoute } from "./route"

const USER = "3f2b8c1e-5a47-4d0e-9b6a-1c2d3e4f5a6b"
const TOKEN = "T".repeat(43)
const compose = vi.fn((input: { to: string; name: string; link: string }) => ({ from: "Site <no-reply@mail.example.test>", to: input.to, subject: `for ${input.name}`, text: input.link, html: input.link }))
const POST = deletionRoute(compose)

const call = (body: unknown, { origin, ip = "1.1.1.1" }: { origin?: string; ip?: string } = {}) =>
  POST(new Request("http://localhost:3140/api/hub/account/deletion", { method: "POST", headers: { "x-forwarded-for": ip, "content-type": "application/json", ...(origin ? { origin } : {}) }, body: typeof body === "string" ? body : JSON.stringify(body) }))

beforeEach(() => {
  mocks.account = { id: USER, email: "ore@example.com", nickname: "Oré" }
  mocks.held = null
  mocks.available = true
  mocks.sent = "sent"
  mocks.auth.refreshSession.mockReset().mockResolvedValue({})
  mocks.auth.signOut.mockReset().mockResolvedValue({})
  mocks.requestDeletionLink.mockReset().mockResolvedValue({ status: "sent", token: TOKEN, expiresAt: new Date("2026-11-09T13:00:00Z") })
  mocks.confirmDeletion.mockReset().mockResolvedValue(new Date("2026-12-09T12:00:00Z"))
  mocks.keepAccount.mockReset().mockResolvedValue(true)
  mocks.eraseAccount.mockReset().mockResolvedValue({ erased: true, feedback: 0, screenshots: 0 })
  mocks.sendMail.mockReset().mockImplementation(async () => mocks.sent)
  compose.mockClear()
  setRateLimitStore(new MemoryRateLimitStore())
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("the e-mail that confirms the deletion (intent request)", () => {
  it("mails a link to the address of the account, taken from the session, and answers with that address masked", async () => {
    const response = await call({ intent: "request" }, { origin: "http://localhost:3140" })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, to: "o•••@example.com" })
    expect(mocks.requestDeletionLink).toHaveBeenCalledWith(USER)
    expect(compose).toHaveBeenCalledWith({ to: "ore@example.com", name: "Oré", link: `http://localhost:3140/auth/delete-account?u=${USER}&t=${TOKEN}` })
    expect(mocks.sendMail).toHaveBeenCalledTimes(1)
  })

  it("never takes the address from the request: a body that names another one changes nothing", async () => {
    await call({ intent: "request", email: "someone@else.com", to: "someone@else.com" })
    expect(compose).toHaveBeenCalledWith(expect.objectContaining({ to: "ore@example.com" }))
  })

  it("points the link to the site the member is on, so that a preview deployment's link opens on that preview", async () => {
    await POST(new Request("https://pbgo-git-plt-36-playboardgamesonline.vercel.app/api/hub/account/deletion", { method: "POST", body: JSON.stringify({ intent: "request" }) }))
    expect(compose.mock.calls[0]![0].link.startsWith("https://pbgo-git-plt-36-playboardgamesonline.vercel.app/auth/delete-account?")).toBe(true)
  })

  it("is for a signed-in member alone, and for one that is not on hold (an account on hold is nobody to getAccount)", async () => {
    mocks.account = null
    const response = await call({ intent: "request" })
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: "NOT_SIGNED_IN" })
    expect(mocks.requestDeletionLink).not.toHaveBeenCalled()
  })

  it("is for no demo account: it is in no database", async () => {
    mocks.account = { id: "demo", email: "ore@example.com", nickname: "Oré" }
    expect((await call({ intent: "request" })).status).toBe(401)
    expect(mocks.requestDeletionLink).not.toHaveBeenCalled()
  })

  it("refuses an account without an address that mail can reach, the stand-in of a provider that gives none included", async () => {
    for (const email of [null, "steam-3f2b8c1e@external.pbgo.invalid"]) {
      mocks.account = { id: USER, email, nickname: "Marly" }
      const response = await call({ intent: "request" })
      expect(response.status).toBe(409)
      expect(await response.json()).toEqual({ error: "NO_MAILBOX" })
    }
    expect(mocks.requestDeletionLink).not.toHaveBeenCalled()
  })

  it("is closed where no e-mail can leave (production with no key), before any link is made", async () => {
    mocks.available = false
    const response = await call({ intent: "request" })
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: "MAIL_UNAVAILABLE" })
    expect(mocks.requestDeletionLink).not.toHaveBeenCalled()
  })

  it("holds up a second link within the minute, and says to wait", async () => {
    mocks.requestDeletionLink.mockResolvedValue({ status: "wait" })
    const response = await call({ intent: "request" })
    expect(response.status).toBe(429)
    expect(response.headers.get("Retry-After")).toBe("60")
    expect(await response.json()).toEqual({ error: "WAIT" })
    expect(mocks.sendMail).not.toHaveBeenCalled()
  })

  it("sends nothing for an account that is on hold already, or that the database does not know", async () => {
    mocks.requestDeletionLink.mockResolvedValue({ status: "on_hold" })
    expect(await (await call({ intent: "request" })).json()).toEqual({ error: "ON_HOLD" })
    mocks.requestDeletionLink.mockResolvedValue({ status: "unknown" })
    expect(await (await call({ intent: "request" })).json()).toEqual({ error: "NOT_SIGNED_IN" })
    expect(mocks.sendMail).not.toHaveBeenCalled()
  })

  it("takes the link back when the e-mail could not leave, so that the next try is not held up by a link nobody got", async () => {
    mocks.sent = "failed"
    const response = await call({ intent: "request" })
    expect(response.status).toBe(502)
    expect(await response.json()).toEqual({ error: "MAIL_FAILED" })
    expect(mocks.keepAccount).toHaveBeenCalledWith(USER)
    mocks.sent = "unavailable"
    expect(await (await call({ intent: "request" }, { ip: "9.9.9.9" })).json()).toEqual({ error: "MAIL_UNAVAILABLE" })
  })

  it("counts an e-mail printed by a development server with no key as sent", async () => {
    mocks.sent = "logged"
    expect((await call({ intent: "request" })).status).toBe(200)
    expect(mocks.keepAccount).not.toHaveBeenCalled()
  })

  it("refuses a request that comes from another site: the cookie is the only proof here", async () => {
    const response = await call({ intent: "request" }, { origin: "https://evil.example" })
    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: "CROSS_ORIGIN" })
    expect(mocks.requestDeletionLink).not.toHaveBeenCalled()
  })
})

describe("the last confirmation, from the page the link opens (intent confirm)", () => {
  it("puts the account on hold on the token of the link, with no session at all, and answers the day", async () => {
    mocks.account = null
    const response = await call({ intent: "confirm", user: USER, token: TOKEN })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, scheduledFor: "2026-12-09T12:00:00.000Z" })
    expect(mocks.confirmDeletion).toHaveBeenCalledWith(USER, TOKEN)
  })

  it("does not look at where it comes from: the token is the proof, and a form of another site does not have it", async () => {
    expect((await call({ intent: "confirm", user: USER, token: TOKEN }, { origin: "https://mail.example" })).status).toBe(200)
  })

  it("refuses a link that has expired, was used or is not the one awaited", async () => {
    mocks.confirmDeletion.mockResolvedValue(null)
    const response = await call({ intent: "confirm", user: USER, token: TOKEN })
    expect(response.status).toBe(410)
    expect(await response.json()).toEqual({ error: "LINK_INVALID" })
  })

  it("refuses what is not an account and a token before it asks the database anything", async () => {
    for (const body of [{ intent: "confirm" }, { intent: "confirm", user: "demo", token: TOKEN }, { intent: "confirm", user: USER, token: "short" }, { intent: "confirm", user: USER, token: 42 }, { intent: "confirm", user: [USER], token: TOKEN }]) {
      const response = await call(body)
      expect(response.status, JSON.stringify(body)).toBe(400)
      expect(await response.json()).toEqual({ error: "INVALID_REQUEST" })
    }
    expect(mocks.confirmDeletion).not.toHaveBeenCalled()
  })
})

describe("an account on hold that is kept (intent keep)", () => {
  beforeEach(() => {
    mocks.held = { id: USER, email: "ore@example.com" }
  })

  it("takes the row and the mark away and renews the session, so that the browser gets the cookies of an account that is not on hold", async () => {
    const response = await call({ intent: "keep" }, { origin: "http://localhost:3140" })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
    expect(mocks.keepAccount).toHaveBeenCalledWith(USER)
    expect(mocks.auth.refreshSession).toHaveBeenCalledTimes(1)
  })

  it("keeps the account even when the session cannot be renewed: the proxy asks the Auth server whenever the claims say on hold", async () => {
    mocks.auth.refreshSession.mockRejectedValue(new Error("network"))
    expect((await call({ intent: "keep" })).status).toBe(200)
    expect(mocks.keepAccount).toHaveBeenCalled()
  })

  it("is for an account that is on hold alone", async () => {
    mocks.held = null
    const response = await call({ intent: "keep" })
    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ error: "NOT_ON_HOLD" })
    expect(mocks.keepAccount).not.toHaveBeenCalled()
  })

  it("refuses a request that comes from another site", async () => {
    expect((await call({ intent: "keep" }, { origin: "https://evil.example" })).status).toBe(403)
    expect(mocks.keepAccount).not.toHaveBeenCalled()
  })
})

describe("an account on hold that is deleted now (intent now)", () => {
  beforeEach(() => {
    mocks.held = { id: USER, email: "ore@example.com" }
  })

  it("deletes it with the feedback sent with its address and takes the cookies of the browser with it", async () => {
    const response = await call({ intent: "now" }, { origin: "http://localhost:3140" })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
    expect(mocks.eraseAccount).toHaveBeenCalledWith(USER, "ore@example.com")
    expect(mocks.auth.signOut).toHaveBeenCalledWith({ scope: "local" })
  })

  it("is for an account that is on hold alone: an account in use is deleted by the e-mail, never by this", async () => {
    mocks.held = null
    const response = await call({ intent: "now" })
    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ error: "NOT_ON_HOLD" })
    expect(mocks.eraseAccount).not.toHaveBeenCalled()
  })

  it("refuses a request that comes from another site, and answers an error when the database cannot delete", async () => {
    expect((await call({ intent: "now" }, { origin: "https://evil.example" })).status).toBe(403)
    mocks.eraseAccount.mockRejectedValue(new Error("erase_account: deadlock detected"))
    const response = await call({ intent: "now" })
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: "SERVER_ERROR" })
    expect(mocks.auth.signOut).not.toHaveBeenCalled()
  })
})

describe("what is asked", () => {
  it("refuses an intent nobody planned, and a body that is not JSON", async () => {
    expect((await call({ intent: "export" })).status).toBe(400)
    expect((await call({})).status).toBe(400)
    expect((await call("not json")).status).toBe(400)
  })

  it("limits a script, per IP: ten asks an hour", async () => {
    for (let i = 0; i < 10; i++) expect((await call({ intent: "confirm", user: USER, token: TOKEN }, { ip: "2.2.2.2" })).status).toBe(200)
    const response = await call({ intent: "confirm", user: USER, token: TOKEN }, { ip: "2.2.2.2" })
    expect(response.status).toBe(429)
    expect(await response.json()).toEqual({ error: "RATE_LIMITED" })
    expect((await call({ intent: "confirm", user: USER, token: TOKEN }, { ip: "3.3.3.3" })).status).toBe(200)
  })
})
