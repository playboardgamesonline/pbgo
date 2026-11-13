import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  account: null as { id: string; nickname?: string } | null,
  sendInvitation: vi.fn(),
  acceptInvitation: vi.fn(),
  declineInvitation: vi.fn(),
}))

vi.mock("server-only", () => ({}))
vi.mock("@pbgo/accounts/server", () => ({ getAccount: async () => mocks.account }))
vi.mock("../../../../server/player", () => ({ getPlayerId: async () => null }))
vi.mock("../../../../server/invitations", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../../server/invitations")>()),
  sendInvitation: mocks.sendInvitation,
  acceptInvitation: mocks.acceptInvitation,
  declineInvitation: mocks.declineInvitation,
}))

import { DEMO_ACCOUNT } from "@pbgo/accounts/demo"
import { CORE_ERROR_MESSAGES } from "../../../../lib/api"
import { INVITATION_ACTIONS, type InvitationAction } from "../../../../lib/invitations"
import { ApiError } from "../../../../server/api"
import { setRateLimitStore } from "../../../../server/rate-limit"
import { MemoryRateLimitStore } from "../../../../server/rate-limiter"
import { postInvitation } from "./route"

const ANN = "0b9f6a52-8c0e-4d6e-9d53-4a1d2f6a7c11"
const ID = "5d0f5b8e-6f8e-4f55-9d6e-3f1a2b4c5d6e"
const deps = { loadGame: async () => null }
const post = (action: InvitationAction, body: unknown, headers: Record<string, string> = {}) =>
  postInvitation(action, deps)(new Request(`http://localhost/api/hub/invitations/${action}`, { method: "POST", headers: { "x-forwarded-for": "1.1.1.1", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) }))
const errorOf = async (response: Response) => ((await response.json()) as { error?: string }).error
const SEND = { nickname: "Bob", tag: 42, game: "hanabi", code: "K7Q2" }

beforeEach(() => {
  mocks.account = null
  for (const mock of [mocks.sendInvitation, mocks.acceptInvitation, mocks.declineInvitation]) mock.mockReset()
  mocks.sendInvitation.mockResolvedValue("sent")
  mocks.acceptInvitation.mockResolvedValue({ game: "hanabi", code: "K7Q2" })
  mocks.declineInvitation.mockResolvedValue("declined")
  setRateLimitStore(new MemoryRateLimitStore())
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("POST /api/hub/invitations/send", () => {
  it("invites the friend of the handle to the table, as the signed-in account", async () => {
    mocks.account = { id: ANN, nickname: "Ann" }
    const response = await post("send", SEND)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, result: "sent" })
    expect(mocks.sendInvitation).toHaveBeenCalledExactlyOnceWith(deps, mocks.account, { nickname: "Bob", tag: 42 }, { game: "hanabi", code: "K7Q2" })
  })

  it("invites as the account that is signed in, whatever the request says of who it is", async () => {
    mocks.account = { id: ANN }
    await post("send", { ...SEND, sender: "someone-else", userId: "someone-else" })
    expect(mocks.sendInvitation).toHaveBeenCalledExactlyOnceWith(deps, mocks.account, { nickname: "Bob", tag: 42 }, { game: "hanabi", code: "K7Q2" })
  })

  it.each([
    ["no handle", { game: "hanabi", code: "K7Q2" }],
    ["a tag that is not one", { ...SEND, tag: 0 }],
    ["no game", { nickname: "Bob", tag: 42, code: "K7Q2" }],
    ["a game that is not a slug", { ...SEND, game: "../x" }],
    ["no code", { nickname: "Bob", tag: 42, game: "hanabi" }],
    ["a code that is not one", { ...SEND, code: "K7 Q2; drop" }],
    ["a body that is not an object", "[1]"],
  ])("refuses %s with 400 INVITE_INVALID, and writes nothing", async (_name, body) => {
    mocks.account = { id: ANN }
    const response = await post("send", body)
    expect(response.status).toBe(400)
    expect(await errorOf(response)).toBe("INVITE_INVALID")
    expect(mocks.sendInvitation).not.toHaveBeenCalled()
  })

  it("refuses a body that is not JSON", async () => {
    mocks.account = { id: ANN }
    expect(await errorOf(await post("send", "not json"))).toBe("INVALID_REQUEST")
  })

  it.each([
    ["FRIEND_NOT_FOUND", 404],
    ["FRIEND_SELF", 400],
    ["INVITE_NOT_FRIEND", 403],
    ["INVITE_NOT_AT_TABLE", 403],
    ["GAME_NOT_FOUND", 404],
    ["GAME_IN_PROGRESS", 409],
    ["GAME_FULL", 409],
    ["INVITE_LIMIT", 409],
    ["INVITE_UNAVAILABLE", 409],
  ])("passes the refusal %s on, with %i", async (code, status) => {
    mocks.account = { id: ANN }
    mocks.sendInvitation.mockRejectedValue(new ApiError(code, status))
    const response = await post("send", SEND)
    expect(response.status).toBe(status)
    expect(await errorOf(response)).toBe(code)
  })

  it("says that invitations are not available where migration 0024 is not applied", async () => {
    mocks.account = { id: ANN }
    mocks.sendInvitation.mockRejectedValue({ code: "PGRST202" })
    const response = await post("send", SEND)
    expect(response.status).toBe(503)
    expect(await errorOf(response)).toBe("INVITATIONS_UNAVAILABLE")
  })

  it("is told it is done by the demo account of development, and writes nothing", async () => {
    mocks.account = DEMO_ACCOUNT
    expect(await (await post("send", SEND)).json()).toEqual({ ok: true, result: "sent" })
    expect(mocks.sendInvitation).not.toHaveBeenCalled()
  })
})

describe("POST /api/hub/invitations/accept and decline", () => {
  it("accepts and gives the table to go to", async () => {
    mocks.account = { id: ANN }
    const response = await post("accept", { id: ID })
    expect(await response.json()).toEqual({ ok: true, result: "accepted", game: "hanabi", code: "K7Q2" })
    expect(mocks.acceptInvitation).toHaveBeenCalledExactlyOnceWith(deps, mocks.account, ID)
  })

  it("declines", async () => {
    mocks.account = { id: ANN }
    expect(await (await post("decline", { id: ID })).json()).toEqual({ ok: true, result: "declined" })
    expect(mocks.declineInvitation).toHaveBeenCalledExactlyOnceWith(mocks.account, ID)
  })

  it.each(["accept", "decline"] as const)("refuses an id that is not one, for %s", async (action) => {
    mocks.account = { id: ANN }
    for (const body of [{}, { id: "1" }, { id: 7 }, { id: `${ID}; drop` }]) {
      const response = await post(action, body)
      expect(response.status).toBe(400)
      expect(await errorOf(response)).toBe("INVITE_INVALID")
    }
    expect(mocks.acceptInvitation).not.toHaveBeenCalled()
    expect(mocks.declineInvitation).not.toHaveBeenCalled()
  })

  it.each([
    ["INVITE_GONE", 404],
    ["INVITE_EXPIRED", 410],
    ["INVITE_TABLE_GONE", 404],
    ["INVITE_TABLE_STARTED", 409],
    ["INVITE_TABLE_FULL", 409],
  ])("passes the refusal %s of an acceptance on, with %i", async (code, status) => {
    mocks.account = { id: ANN }
    mocks.acceptInvitation.mockRejectedValue(new ApiError(code, status))
    const response = await post("accept", { id: ID })
    expect(response.status).toBe(status)
    expect(await errorOf(response)).toBe(code)
  })

  it("says the invitation of the demo account's is gone: it leads nowhere", async () => {
    mocks.account = DEMO_ACCOUNT
    expect(await errorOf(await post("accept", { id: ID }))).toBe("INVITE_GONE")
    expect(mocks.acceptInvitation).not.toHaveBeenCalled()
  })
})

describe("every action", () => {
  it.each(INVITATION_ACTIONS)("%s: refuses a request from another site, a visitor who is not signed in, and too many presses", async (action) => {
    const body = action === "send" ? SEND : { id: ID }
    expect(await errorOf(await post(action, body, { origin: "https://evil.example" }))).toBe("CROSS_ORIGIN")
    const guest = await post(action, body)
    expect(guest.status).toBe(401)
    expect(await errorOf(guest)).toBe("NOT_SIGNED_IN")
    mocks.account = { id: ANN }
    let last = 200
    for (let i = 0; i < 80; i++) last = (await post(action, body, { "x-forwarded-for": "2.2.2.2" })).status
    expect(last).toBe(429)
  })

  it("has a message for each refusal", () => {
    for (const code of ["INVITE_INVALID", "INVITE_NOT_FRIEND", "INVITE_NOT_AT_TABLE", "INVITE_LIMIT", "INVITE_UNAVAILABLE", "INVITE_GONE", "INVITE_EXPIRED", "INVITE_TABLE_GONE", "INVITE_TABLE_STARTED", "INVITE_TABLE_FULL", "INVITATIONS_UNAVAILABLE"]) {
      expect(CORE_ERROR_MESSAGES[code], code).toBeTruthy()
    }
  })
})
