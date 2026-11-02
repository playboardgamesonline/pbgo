import { describe, expect, it } from "vitest"
import { QUEUE_MAX_AGE_MS, parseQueue, queueSeconds, queueTime } from "./queue"

const NOW = Date.parse("2026-11-02T18:00:00Z")

describe("queueSeconds", () => {
  it("is the whole seconds waited", () => {
    expect(queueSeconds({ since: NOW }, NOW)).toBe(0)
    expect(queueSeconds({ since: NOW - 12_000 }, NOW)).toBe(12)
    expect(queueSeconds({ since: NOW - 12_999 }, NOW)).toBe(12)
  })

  it("is never negative: a clock that moved back does not count down", () => {
    expect(queueSeconds({ since: NOW + 5_000 }, NOW)).toBe(0)
  })
})

describe("queueTime", () => {
  it.each([
    [0, "0:00"],
    [9, "0:09"],
    [12, "0:12"],
    [60, "1:00"],
    [65, "1:05"],
    [754, "12:34"],
    [3599, "59:59"],
    [3600, "1:00:00"],
    [3723, "1:02:03"],
    [36_000, "10:00:00"],
  ])("writes %s seconds as %s", (seconds, text) => {
    expect(queueTime(seconds)).toBe(text)
  })

  it("keeps whole seconds and never writes less than nothing", () => {
    expect(queueTime(12.9)).toBe("0:12")
    expect(queueTime(-4)).toBe("0:00")
  })
})

describe("parseQueue", () => {
  const stored = { slug: "courtisans", name: "Courtisans", since: NOW - 30_000 }

  it("reads a queue as it was kept", () => {
    expect(parseQueue(stored, NOW)).toEqual(stored)
    expect(parseQueue(JSON.parse(JSON.stringify(stored)), NOW)).toEqual(stored)
  })

  it("keeps nothing but the three fields", () => {
    expect(parseQueue({ ...stored, token: "secret" }, NOW)).toEqual(stored)
  })

  it.each([
    ["nothing", null],
    ["a text", "courtisans"],
    ["a list", [stored]],
    ["no slug", { ...stored, slug: undefined }],
    ["an empty slug", { ...stored, slug: "  " }],
    ["a slug that is not a text", { ...stored, slug: 4 }],
    ["a slug with a control character", { ...stored, slug: "court\u001bisans" }],
    ["a name that is too long", { ...stored, name: "x".repeat(81) }],
    ["no name", { ...stored, name: "" }],
    ["a start that is not a number", { ...stored, since: "yesterday" }],
    ["a start that is not finite", { ...stored, since: Number.POSITIVE_INFINITY }],
    ["a start that has not happened", { ...stored, since: NOW + 3_600_000 }],
    ["a start older than the queue is believed", { ...stored, since: NOW - QUEUE_MAX_AGE_MS - 1 }],
  ])("is no queue: %s", (_label, raw) => {
    expect(parseQueue(raw, NOW)).toBeNull()
  })

  it("takes a start a moment ahead of the clock (two clocks never agree) and one just inside the age", () => {
    expect(parseQueue({ ...stored, since: NOW + 30_000 }, NOW)).not.toBeNull()
    expect(parseQueue({ ...stored, since: NOW - QUEUE_MAX_AGE_MS }, NOW)).not.toBeNull()
  })
})
