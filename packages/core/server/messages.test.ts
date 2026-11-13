import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), ensureProfile: vi.fn() }))

vi.mock("server-only", () => ({}))
vi.mock("./supabase", () => ({ supabaseAdmin: () => ({ rpc: mocks.rpc }) }))
vi.mock("./profiles", () => ({ ensureProfile: mocks.ensureProfile }))

import { MAX_UNREAD_MESSAGES, MESSAGE_MAX_LENGTH, MESSAGES_HISTORY_LIMIT } from "../lib/messages"
import { markRead, readThread, sendMessage } from "./messages"

const ANN = "0b9f6a52-8c0e-4d6e-9d53-4a1d2f6a7c11"
const account = { id: ANN, nickname: "Ann" } as never
const BOB = { nickname: "Bob", tag: 42 }
const refusedWith = async (promise: Promise<unknown>, code: string, status?: number) => {
  const error = (await promise.then(
    () => null,
    (reason: unknown) => reason,
  )) as { code?: string; status?: number } | null
  expect(error?.code).toBe(code)
  if (status) expect(error?.status).toBe(status)
}

beforeEach(() => {
  mocks.rpc.mockReset()
  mocks.ensureProfile.mockReset()
  mocks.ensureProfile.mockResolvedValue({ userId: ANN })
})

describe("sendMessage", () => {
  it("writes to the friend with the limits the code gives, and gives the message as the conversation shows it", async () => {
    mocks.rpc.mockResolvedValue({ data: { result: "sent", id: 7, at: "2026-11-13T10:00:00+00:00" }, error: null })
    expect(await sendMessage(account, BOB, "hello")).toEqual({ id: 7, mine: true, text: "hello", at: "2026-11-13T10:00:00+00:00" })
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("message_send", { p_user: ANN, p_nickname: "Bob", p_tag: 42, p_body: "hello", p_max_length: MESSAGE_MAX_LENGTH, p_max_unread: MAX_UNREAD_MESSAGES })
  })

  it.each([
    ["missing", "FRIEND_NOT_FOUND", 404],
    ["self", "FRIEND_SELF", 400],
    ["not_friends", "MESSAGE_NOT_FRIEND", 403],
    ["empty", "MESSAGE_INVALID", 400],
    ["too_long", "MESSAGE_INVALID", 400],
    ["too_many", "MESSAGE_UNREAD_LIMIT", 409],
  ])("turns the database's %s into %s", async (word, code, status) => {
    mocks.rpc.mockResolvedValue({ data: { result: word }, error: null })
    await refusedWith(sendMessage(account, BOB, "hello"), code, status)
  })

  it("throws a word it does not know, a message with no id, and what the database says", async () => {
    mocks.rpc.mockResolvedValue({ data: { result: "maybe" }, error: null })
    await expect(sendMessage(account, BOB, "x")).rejects.toThrow("something else than a word")
    mocks.rpc.mockResolvedValue({ data: { result: "sent" }, error: null })
    await expect(sendMessage(account, BOB, "x")).rejects.toThrow("did not say which message")
    const error = { code: "57014", message: "timeout" }
    mocks.rpc.mockResolvedValue({ data: null, error })
    await expect(sendMessage(account, BOB, "x")).rejects.toBe(error)
  })

  it("is unavailable when the sender has no profile to be named by, and writes nothing", async () => {
    mocks.ensureProfile.mockResolvedValue(null)
    await refusedWith(sendMessage(account, BOB, "x"), "MESSAGES_UNAVAILABLE", 503)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
})

describe("readThread", () => {
  const row = { id: 1, mine: false, text: "hi", at: "2026-11-13T10:00:00+00:00" }

  it("reads the last messages and the unread count", async () => {
    mocks.rpc.mockResolvedValue({ data: { result: "ok", messages: [row, { id: "x" }], unread: 1 }, error: null })
    expect(await readThread(ANN, BOB)).toEqual({ messages: [row], unread: 1 })
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("messages_with", { p_user: ANN, p_nickname: "Bob", p_tag: 42, p_limit: MESSAGES_HISTORY_LIMIT })
  })

  it("is not found for nobody, and one answer for a stranger, a removed friend or a block", async () => {
    mocks.rpc.mockResolvedValue({ data: { result: "missing" }, error: null })
    await refusedWith(readThread(ANN, BOB), "FRIEND_NOT_FOUND", 404)
    mocks.rpc.mockResolvedValue({ data: { result: "not_friends" }, error: null })
    await refusedWith(readThread(ANN, BOB), "MESSAGE_NOT_FRIEND", 403)
  })

  it("throws what is not a conversation", async () => {
    mocks.rpc.mockResolvedValue({ data: { result: "ok" }, error: null })
    await expect(readThread(ANN, BOB)).rejects.toThrow("something else than a conversation")
  })
})

describe("markRead", () => {
  it("says how many it marked, and none for what is not a number", async () => {
    mocks.rpc.mockResolvedValue({ data: 3, error: null })
    expect(await markRead(ANN, BOB)).toBe(3)
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("messages_read", { p_user: ANN, p_nickname: "Bob", p_tag: 42 })
    mocks.rpc.mockResolvedValue({ data: null, error: null })
    expect(await markRead(ANN, BOB)).toBe(0)
  })
})
