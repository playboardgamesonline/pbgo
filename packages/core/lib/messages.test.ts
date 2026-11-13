import { describe, expect, it } from "vitest"
import { MESSAGE_MAX_LENGTH, chatMessageOf, cleanMessageText, conversationOf, messageActionPath, threadOf } from "./messages"

describe("cleanMessageText", () => {
  it("takes the spaces at both ends off and keeps what is inside", () => {
    expect(cleanMessageText("  hello  there \n")).toBe("hello  there")
  })

  it("is none for what is not text, is empty or is only spaces and invisible characters", () => {
    for (const value of [undefined, null, 5, {}, [], "", "   ", "\n\t ", "\u200B\u200B", "\u0000"]) expect(cleanMessageText(value)).toBeNull()
  })

  it("takes control characters and invisible direction marks out, and keeps a line break", () => {
    expect(cleanMessageText("a\u0000b\u0007c")).toBe("abc")
    expect(cleanMessageText("a\u202Eb")).toBe("ab")
    expect(cleanMessageText("one\r\ntwo")).toBe("one\ntwo")
  })

  it("keeps two line breaks at the most in a row", () => {
    expect(cleanMessageText("a\n\n\n\n\nb")).toBe("a\n\nb")
  })

  it("keeps emoji and accents, and counts a character as the person sees it", () => {
    expect(cleanMessageText("Café 😀")).toBe("Café 😀")
    expect(cleanMessageText("😀".repeat(MESSAGE_MAX_LENGTH))).toBe("😀".repeat(MESSAGE_MAX_LENGTH))
    expect(cleanMessageText("😀".repeat(MESSAGE_MAX_LENGTH + 1))).toBeNull()
  })

  it("refuses a message over the limit and takes one of exactly the limit", () => {
    expect(cleanMessageText("x".repeat(MESSAGE_MAX_LENGTH))).toHaveLength(MESSAGE_MAX_LENGTH)
    expect(cleanMessageText("x".repeat(MESSAGE_MAX_LENGTH + 1))).toBeNull()
  })

  it("does not count the spaces that are cut off", () => {
    expect(cleanMessageText(` ${"x".repeat(MESSAGE_MAX_LENGTH)} `)).toHaveLength(MESSAGE_MAX_LENGTH)
  })
})

describe("the wire", () => {
  const conversation = { nickname: "Bob", tag: 42, avatarUrl: null, unread: 2, lastText: "hi", lastAt: "2026-11-13T10:00:00.000Z", lastMine: false }

  it("reads a conversation and a message, and nothing that is not one", () => {
    expect(conversationOf(conversation)).toEqual(conversation)
    for (const bad of [null, "x", { ...conversation, unread: -1 }, { ...conversation, unread: 1.5 }, { ...conversation, lastText: 3 }, { ...conversation, lastAt: "soon" }, { ...conversation, lastMine: "no" }, { ...conversation, nickname: "" }]) expect(conversationOf(bad)).toBeNull()
    expect(chatMessageOf({ id: 3, mine: true, text: "x", at: "2026-11-13T10:00:00.000Z" })).toEqual({ id: 3, mine: true, text: "x", at: "2026-11-13T10:00:00.000Z" })
    for (const bad of [null, { id: 0, mine: true, text: "x", at: "2026-11-13T10:00:00.000Z" }, { id: 1, mine: 1, text: "x", at: "2026-11-13T10:00:00.000Z" }, { id: 1, mine: true, text: 2, at: "2026-11-13T10:00:00.000Z" }, { id: 1, mine: true, text: "x", at: "never" }]) expect(chatMessageOf(bad)).toBeNull()
  })

  it("reads a thread, dropping the messages that are not", () => {
    const ok = { id: 1, mine: true, text: "x", at: "2026-11-13T10:00:00.000Z" }
    expect(threadOf({ messages: [ok, null, { id: "2" }], unread: 1 })).toEqual({ messages: [ok], unread: 1 })
    expect(threadOf({ messages: "x", unread: 1 })).toBeNull()
    expect(threadOf({ messages: [], unread: "1" })).toBeNull()
    expect(threadOf(null)).toBeNull()
  })

  it("names the routes", () => {
    expect(messageActionPath("send")).toBe("/api/hub/messages/send")
  })
})
