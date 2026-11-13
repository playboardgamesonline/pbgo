import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  account: null as { id: string; nickname?: string } | null,
  sendMessage: vi.fn(),
  readThread: vi.fn(),
  markRead: vi.fn(),
}))

vi.mock("server-only", () => ({}))
vi.mock("@pbgo/accounts/server", () => ({ getAccount: async () => mocks.account }))
vi.mock("../../../../server/player", () => ({ getPlayerId: async () => null }))
vi.mock("../../../../server/messages", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../../server/messages")>()),
  sendMessage: mocks.sendMessage,
  readThread: mocks.readThread,
  markRead: mocks.markRead,
}))

import { DEMO_ACCOUNT } from "@pbgo/accounts/demo"
import { CORE_ERROR_MESSAGES } from "../../../../lib/api"
import { MESSAGE_ACTIONS, MESSAGE_MAX_LENGTH, type MessageAction } from "../../../../lib/messages"
import { ApiError } from "../../../../server/api"
import { setRateLimitStore } from "../../../../server/rate-limit"
import { MemoryRateLimitStore } from "../../../../server/rate-limiter"
import { getMessages, postMessage } from "./route"

const ANN = "0b9f6a52-8c0e-4d6e-9d53-4a1d2f6a7c11"
const MESSAGE = { id: 7, mine: true, text: "hello", at: "2026-11-13T10:00:00.000Z" }
const post = (action: MessageAction, body: unknown, headers: Record<string, string> = {}) =>
  postMessage(action)(new Request(`http://localhost/api/hub/messages/${action}`, { method: "POST", headers: { "x-forwarded-for": "1.1.1.1", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) }))
const get = (query = "?nickname=Bob&tag=42", headers: Record<string, string> = {}) => getMessages(new Request(`http://localhost/api/hub/messages${query}`, { headers: { "x-forwarded-for": "1.1.1.1", ...headers } }))
const errorOf = async (response: Response) => ((await response.json()) as { error?: string }).error
const BOB = { nickname: "Bob", tag: 42 }

beforeEach(() => {
  mocks.account = null
  for (const mock of [mocks.sendMessage, mocks.readThread, mocks.markRead]) mock.mockReset()
  mocks.sendMessage.mockResolvedValue(MESSAGE)
  mocks.readThread.mockResolvedValue({ messages: [{ ...MESSAGE, mine: false }], unread: 1 })
  mocks.markRead.mockResolvedValue(2)
  setRateLimitStore(new MemoryRateLimitStore())
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("POST /api/hub/messages/send", () => {
  it("writes to the friend as the signed-in account and gives the message", async () => {
    mocks.account = { id: ANN, nickname: "Ann" }
    const response = await post("send", { ...BOB, text: "  hello  " })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, message: MESSAGE })
    expect(mocks.sendMessage).toHaveBeenCalledExactlyOnceWith(mocks.account, BOB, "hello")
  })

  it("writes as the account that is signed in, whatever the request says of who it is", async () => {
    mocks.account = { id: ANN }
    await post("send", { ...BOB, text: "hi", sender: "someone-else", userId: "someone-else" })
    expect(mocks.sendMessage).toHaveBeenCalledExactlyOnceWith(mocks.account, BOB, "hi")
  })

  it.each([
    ["no text", BOB],
    ["text that is not a string", { ...BOB, text: 5 }],
    ["only spaces", { ...BOB, text: "   " }],
    [`more than ${MESSAGE_MAX_LENGTH} characters`, { ...BOB, text: "x".repeat(MESSAGE_MAX_LENGTH + 1) }],
  ])("refuses %s with 400 MESSAGE_INVALID, and writes nothing", async (_name, body) => {
    mocks.account = { id: ANN }
    const response = await post("send", body)
    expect(response.status).toBe(400)
    expect(await errorOf(response)).toBe("MESSAGE_INVALID")
    expect(mocks.sendMessage).not.toHaveBeenCalled()
  })

  it("refuses a handle that cannot be anybody's, and a body that is not JSON", async () => {
    mocks.account = { id: ANN }
    expect(await errorOf(await post("send", { nickname: "Bob", tag: 0, text: "x" }))).toBe("FRIEND_INVALID")
    expect(await errorOf(await post("send", { text: "x" }))).toBe("FRIEND_INVALID")
    expect(await errorOf(await post("send", "not json"))).toBe("INVALID_REQUEST")
  })

  it.each([
    ["FRIEND_NOT_FOUND", 404],
    ["FRIEND_SELF", 400],
    ["MESSAGE_NOT_FRIEND", 403],
    ["MESSAGE_UNREAD_LIMIT", 409],
  ])("passes the refusal %s on, with %i", async (code, status) => {
    mocks.account = { id: ANN }
    mocks.sendMessage.mockRejectedValue(new ApiError(code, status))
    const response = await post("send", { ...BOB, text: "x" })
    expect(response.status).toBe(status)
    expect(await errorOf(response)).toBe(code)
  })

  it("says that messages are not available where migration 0025 is not applied", async () => {
    mocks.account = { id: ANN }
    mocks.sendMessage.mockRejectedValue({ code: "PGRST202" })
    const response = await post("send", { ...BOB, text: "x" })
    expect(response.status).toBe(503)
    expect(await errorOf(response)).toBe("MESSAGES_UNAVAILABLE")
  })

  it("is told it is done by the demo account of development, and writes nothing", async () => {
    mocks.account = DEMO_ACCOUNT
    const body = (await (await post("send", { ...BOB, text: "hi" })).json()) as { ok: boolean; message: { text: string; mine: boolean } }
    expect(body).toMatchObject({ ok: true, message: { text: "hi", mine: true } })
    expect(mocks.sendMessage).not.toHaveBeenCalled()
  })
})

describe("POST /api/hub/messages/read", () => {
  it("marks the friend's messages as read and says how many", async () => {
    mocks.account = { id: ANN }
    expect(await (await post("read", BOB)).json()).toEqual({ ok: true, read: 2 })
    expect(mocks.markRead).toHaveBeenCalledExactlyOnceWith(ANN, BOB)
  })

  it("marks nothing for the demo account", async () => {
    mocks.account = DEMO_ACCOUNT
    expect(await (await post("read", BOB)).json()).toEqual({ ok: true, read: 0 })
    expect(mocks.markRead).not.toHaveBeenCalled()
  })
})

describe("GET /api/hub/messages", () => {
  it("gives the conversation with a friend", async () => {
    mocks.account = { id: ANN }
    const response = await get()
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ messages: [{ ...MESSAGE, mine: false }], unread: 1 })
    expect(mocks.readThread).toHaveBeenCalledExactlyOnceWith(ANN, BOB)
  })

  it("is 401 for a visitor who is not signed in, 400 for a handle that is not one", async () => {
    expect((await get()).status).toBe(401)
    mocks.account = { id: ANN }
    for (const query of ["", "?nickname=Bob", "?tag=42", "?nickname=Bob&tag=abc", "?nickname=&tag=42"]) expect(await errorOf(await get(query))).toBe("FRIEND_INVALID")
    expect(mocks.readThread).not.toHaveBeenCalled()
  })

  it("passes the refusals on: a stranger, a removed friend and a block read nothing", async () => {
    mocks.account = { id: ANN }
    mocks.readThread.mockRejectedValue(new ApiError("MESSAGE_NOT_FRIEND", 403))
    const response = await get()
    expect(response.status).toBe(403)
    expect(await errorOf(response)).toBe("MESSAGE_NOT_FRIEND")
    mocks.readThread.mockRejectedValue({ code: "42883" })
    expect(await errorOf(await get())).toBe("MESSAGES_UNAVAILABLE")
  })

  it("has no conversation for the demo account of development, which is made up by the browser", async () => {
    mocks.account = DEMO_ACCOUNT
    expect(await (await get()).json()).toEqual({ messages: [], unread: 0 })
    expect(mocks.readThread).not.toHaveBeenCalled()
  })

  it("is limited to 240 reads a minute for one address", async () => {
    mocks.account = { id: ANN }
    let last = 200
    for (let i = 0; i < 250; i++) last = (await get("?nickname=Bob&tag=42", { "x-forwarded-for": "3.3.3.3" })).status
    expect(last).toBe(429)
  })
})

describe("every POST", () => {
  it.each(MESSAGE_ACTIONS)("%s: refuses a request from another site, a visitor who is not signed in, and too many presses", async (action) => {
    const body = action === "send" ? { ...BOB, text: "x" } : BOB
    expect(await errorOf(await post(action, body, { origin: "https://evil.example" }))).toBe("CROSS_ORIGIN")
    const guest = await post(action, body)
    expect(guest.status).toBe(401)
    expect(await errorOf(guest)).toBe("NOT_SIGNED_IN")
    mocks.account = { id: ANN }
    let last = 200
    for (let i = 0; i < 130; i++) last = (await post(action, body, { "x-forwarded-for": "2.2.2.2" })).status
    expect(last).toBe(429)
  })

  it("has a message for each refusal", () => {
    for (const code of ["MESSAGE_INVALID", "MESSAGE_NOT_FRIEND", "MESSAGE_UNREAD_LIMIT", "MESSAGES_UNAVAILABLE"]) expect(CORE_ERROR_MESSAGES[code], code).toBeTruthy()
  })
})
