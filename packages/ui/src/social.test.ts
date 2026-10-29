import { describe, expect, it } from "vitest"
import type { Friend } from "./friends"
import { lastMessage, sortedConversations, timeAgo, unreadOf, type Conversation } from "./social"

const NOW = Date.parse("2026-10-29T12:00:00Z")
const friend: Friend = { id: "f", nickname: "Marly", status: "online" }
const at = (minutesAgo: number) => new Date(NOW - minutesAgo * 60_000).toISOString()
const conversation = (id: string, minutesAgo: number[], unread = 0): Conversation => ({
  id,
  friend,
  unread,
  messages: minutesAgo.map((minutes, index) => ({ id: `${id}-${index}`, from: "them", text: id, at: at(minutes) })),
})

describe("timeAgo", () => {
  it("says now under a minute, then the minutes, the hours and the days", () => {
    expect(timeAgo(at(0), NOW)).toBe("now")
    expect(timeAgo(new Date(NOW - 59_000).toISOString(), NOW)).toBe("now")
    expect(timeAgo(at(2), NOW)).toBe("2m ago")
    expect(timeAgo(at(59), NOW)).toBe("59m ago")
    expect(timeAgo(at(60), NOW)).toBe("1h ago")
    expect(timeAgo(at(60 * 23), NOW)).toBe("23h ago")
    expect(timeAgo(at(60 * 24), NOW)).toBe("1d ago")
    expect(timeAgo(at(60 * 24 * 4), NOW)).toBe("4d ago")
  })

  it("does not write a time in the future", () => {
    expect(timeAgo(at(-5), NOW)).toBe("now")
  })
})

describe("sortedConversations", () => {
  it("puts the conversation with the latest message first, and the ones with no message last", () => {
    const sorted = sortedConversations([conversation("empty", []), conversation("old", [600, 500]), conversation("new", [90, 3]), conversation("mid", [40])])
    expect(sorted.map((one) => one.id)).toEqual(["new", "mid", "old", "empty"])
  })

  it("leaves the list it is given as it is", () => {
    const list = [conversation("a", [10]), conversation("b", [1])]
    sortedConversations(list)
    expect(list.map((one) => one.id)).toEqual(["a", "b"])
  })
})

describe("lastMessage and unreadOf", () => {
  it("reads the last message of a conversation, and adds up what is unread", () => {
    expect(lastMessage(conversation("a", [30, 5]))?.at).toBe(at(5))
    expect(lastMessage(conversation("b", []))).toBeUndefined()
    expect(unreadOf([conversation("a", [1], 2), conversation("b", [2], 0), conversation("c", [3], 5)])).toBe(7)
    expect(unreadOf([])).toBe(0)
  })
})
