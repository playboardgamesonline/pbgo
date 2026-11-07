import { describe, expect, it } from "vitest"
import { QUEUE_MAX_AGE_MS, QUEUE_MAX_GAMES, QUEUE_MODE_LABELS, QUEUE_MODES, parseQueue, queueGamesLabel, queueSeconds, queueTime } from "./queue"

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

describe("modes", () => {
  it("are ranked, then normal, each with a name", () => {
    expect(QUEUE_MODES).toEqual(["ranked", "normal"])
    expect(QUEUE_MODES.map((mode) => QUEUE_MODE_LABELS[mode])).toEqual(["Ranked", "Normal"])
  })
})

describe("queueGamesLabel", () => {
  const names = (...list: string[]) => list.map((name) => ({ name }))

  it.each([
    [[], ""],
    [["Courtisans"], "Courtisans"],
    [["Courtisans", "Flip 7"], "Courtisans and Flip 7"],
    [["Courtisans", "Flip 7", "Skull King"], "Courtisans, Flip 7 and Skull King"],
    [["Courtisans", "Flip 7", "Skull King", "Hanabi"], "Courtisans, Flip 7 and 2 more"],
    [["A", "B", "C", "D", "E", "F"], "A, B and 4 more"],
  ])("says %j as %j", (list, text) => {
    expect(queueGamesLabel(names(...list))).toBe(text)
  })
})

describe("parseQueue", () => {
  const stored = {
    games: [
      { slug: "courtisans", name: "Courtisans" },
      { slug: "flip-7", name: "Flip 7" },
    ],
    mode: "ranked",
    since: NOW - 30_000,
  }

  it("reads a queue as it was kept", () => {
    expect(parseQueue(stored, NOW)).toEqual(stored)
    expect(parseQueue(JSON.parse(JSON.stringify(stored)), NOW)).toEqual(stored)
    expect(parseQueue({ ...stored, mode: "normal" }, NOW)?.mode).toBe("normal")
  })

  it("keeps nothing but the games' slug and name, the mode and the start", () => {
    const read = parseQueue({ ...stored, token: "secret", games: [{ slug: "courtisans", name: "Courtisans", rank: 4 }] }, NOW)
    expect(read).toEqual({ games: [{ slug: "courtisans", name: "Courtisans" }], mode: "ranked", since: stored.since })
  })

  it.each([
    ["nothing", null],
    ["a text", "courtisans"],
    ["a list", [stored]],
    ["the first version's queue, of one game with no mode", { slug: "courtisans", name: "Courtisans", since: NOW - 30_000 }],
    ["no games", { ...stored, games: undefined }],
    ["games that are no list", { ...stored, games: "courtisans" }],
    ["an empty list of games", { ...stored, games: [] }],
    ["a game that is no record", { ...stored, games: ["courtisans"] }],
    ["a game with no slug", { ...stored, games: [{ name: "Courtisans" }] }],
    ["an empty slug", { ...stored, games: [{ slug: "  ", name: "Courtisans" }] }],
    ["a slug that is not a text", { ...stored, games: [{ slug: 4, name: "Courtisans" }] }],
    ["a slug with a control character", { ...stored, games: [{ slug: "court\u001bisans", name: "Courtisans" }] }],
    ["a name that is too long", { ...stored, games: [{ slug: "courtisans", name: "x".repeat(81) }] }],
    ["no name", { ...stored, games: [{ slug: "courtisans", name: "" }] }],
    ["a game that is listed twice", { ...stored, games: [stored.games[0], stored.games[0]] }],
    ["more games than there can be", { ...stored, games: Array.from({ length: QUEUE_MAX_GAMES + 1 }, (_, index) => ({ slug: `game-${index}`, name: `Game ${index}` })) }],
    ["no mode", { ...stored, mode: undefined }],
    ["a mode that is not one", { ...stored, mode: "casual" }],
    ["a start that is not a number", { ...stored, since: "yesterday" }],
    ["a start that is not finite", { ...stored, since: Number.POSITIVE_INFINITY }],
    ["a start that has not happened", { ...stored, since: NOW + 3_600_000 }],
    ["a start older than the queue is believed", { ...stored, since: NOW - QUEUE_MAX_AGE_MS - 1 }],
  ])("is no queue: %s", (_label, raw) => {
    expect(parseQueue(raw, NOW)).toBeNull()
  })

  it("takes the most games there can be, a start a moment ahead of the clock (two clocks never agree) and one just inside the age", () => {
    expect(parseQueue({ ...stored, games: Array.from({ length: QUEUE_MAX_GAMES }, (_, index) => ({ slug: `game-${index}`, name: `Game ${index}` })) }, NOW)).not.toBeNull()
    expect(parseQueue({ ...stored, since: NOW + 30_000 }, NOW)).not.toBeNull()
    expect(parseQueue({ ...stored, since: NOW - QUEUE_MAX_AGE_MS }, NOW)).not.toBeNull()
  })
})
