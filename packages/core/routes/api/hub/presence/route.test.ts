import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  account: null as { id: string } | null,
  touchMember: vi.fn(async (_userId: string): Promise<void> => {}),
  tables: [] as Array<{ game: string; code: string; status: "lobby" | "starting" | "playing" }>,
  readMemberTables: vi.fn(async (_userId: string) => mocks.tables),
}))

vi.mock("server-only", () => ({}))
vi.mock("@pbgo/accounts/server", () => ({ getAccount: async () => mocks.account }))
vi.mock("../../../../server/player", () => ({ getPlayerId: async () => null }))
vi.mock("../../../../server/presence", () => ({ touchMember: mocks.touchMember }))
vi.mock("../../../../server/tables", async (importOriginal) => ({ ...(await importOriginal<typeof import("../../../../server/tables")>()), readMemberTables: mocks.readMemberTables }))

import { setRateLimitStore } from "../../../../server/rate-limit"
import { MemoryRateLimitStore } from "../../../../server/rate-limiter"
import { POST } from "./route"

const request = (ip = "1.1.1.1") => new Request("http://localhost/api/hub/presence", { method: "POST", headers: { "x-forwarded-for": ip } })

beforeEach(() => {
  mocks.account = null
  mocks.touchMember.mockReset()
  mocks.touchMember.mockResolvedValue(undefined)
  mocks.tables = []
  mocks.readMemberTables.mockClear()
  setRateLimitStore(new MemoryRateLimitStore())
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("POST /api/hub/presence", () => {
  it("records a signed-in member as seen now", async () => {
    mocks.account = { id: "0b9f6a52-8c0e-4d6e-9d53-4a1d2f6a7c11" }
    const response = await POST(request())
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, table: null, watching: false })
    expect(mocks.touchMember).toHaveBeenCalledWith("0b9f6a52-8c0e-4d6e-9d53-4a1d2f6a7c11")
  })

  it("tells the member where their game is, so that the page takes them there", async () => {
    mocks.account = { id: "0b9f6a52-8c0e-4d6e-9d53-4a1d2f6a7c11" }
    mocks.tables = [
      { game: "hanabi", code: "LOB123", status: "lobby" },
      { game: "courtisans", code: "ABC234", status: "playing" },
    ]
    const response = await POST(request())
    expect(await response.json()).toEqual({ ok: true, table: { game: "courtisans", code: "ABC234", status: "playing" }, watching: true })
    expect(mocks.readMemberTables).toHaveBeenCalledWith("0b9f6a52-8c0e-4d6e-9d53-4a1d2f6a7c11")
  })

  it("says that a table is in its ready check, which takes the member from more pages than a game that is being played", async () => {
    mocks.account = { id: "0b9f6a52-8c0e-4d6e-9d53-4a1d2f6a7c11" }
    mocks.tables = [{ game: "courtisans", code: "ABC234", status: "starting" }]
    expect(await (await POST(request())).json()).toEqual({ ok: true, table: { game: "courtisans", code: "ABC234", status: "starting" }, watching: true })
  })

  it("has no table to take a member to while they only wait in lobbies, and asks for a closer look", async () => {
    mocks.account = { id: "0b9f6a52-8c0e-4d6e-9d53-4a1d2f6a7c11" }
    mocks.tables = [{ game: "hanabi", code: "LOB123", status: "lobby" }]
    expect(await (await POST(request())).json()).toEqual({ ok: true, table: null, watching: true })
  })

  it("still counts the member when their tables cannot be read", async () => {
    mocks.account = { id: "0b9f6a52-8c0e-4d6e-9d53-4a1d2f6a7c11" }
    mocks.readMemberTables.mockRejectedValueOnce(new Error("function public.member_tables(uuid, text) does not exist"))
    const response = await POST(request())
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, table: null, watching: false })
    expect(mocks.touchMember).toHaveBeenCalled()
  })

  it("refuses a visitor who is not signed in, and records nobody: a guest is online at a table, not on the site", async () => {
    const response = await POST(request())
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: "NOT_SIGNED_IN" })
    expect(mocks.touchMember).not.toHaveBeenCalled()
  })

  it("writes nothing for the demo account of development, which is in no database", async () => {
    mocks.account = { id: "demo" }
    const response = await POST(request())
    expect(response.status).toBe(200)
    expect(mocks.touchMember).not.toHaveBeenCalled()
    expect(mocks.readMemberTables).not.toHaveBeenCalled()
  })

  it("answers with an error when the database cannot write it, so the browser waits longer", async () => {
    mocks.account = { id: "0b9f6a52-8c0e-4d6e-9d53-4a1d2f6a7c11" }
    mocks.touchMember.mockRejectedValue(new Error("function public.touch_member(uuid) does not exist"))
    const response = await POST(request())
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: "SERVER_ERROR" })
  })

  it("limits a script that beats far more often than a tab does, per IP", async () => {
    mocks.account = { id: "0b9f6a52-8c0e-4d6e-9d53-4a1d2f6a7c11" }
    for (let i = 0; i < 30; i++) expect((await POST(request("2.2.2.2"))).status).toBe(200)
    const refused = await POST(request("2.2.2.2"))
    expect(refused.status).toBe(429)
    expect(await refused.json()).toEqual({ error: "RATE_LIMITED" })
    expect((await POST(request("3.3.3.3"))).status).toBe(200)
  })
})
