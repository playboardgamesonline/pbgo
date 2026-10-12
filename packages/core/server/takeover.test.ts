import { describe, expect, it } from "vitest"
import {
  PRESENCE_WINDOW_MS,
  SEEN_WRITE_EVERY_MS,
  TakeoverError,
  castVotes,
  parseVotes,
  presentPlayers,
  publicTakeover,
  seenNeedsWrite,
  takeoverStatus,
  voteEntry,
} from "./takeover"

const NOW = Date.parse("2026-10-12T10:00:00.000Z")
const ago = (ms: number) => new Date(NOW - ms).toISOString()
const seats = (...ids: string[]) => ids.map((id) => ({ id }))

const players = seats("a", "b", "c")
const FP = "fp1"

describe("presentPlayers", () => {
  it("lists the members seen in the window, in seat order", () => {
    const seen = { c: ago(1_000), a: ago(PRESENCE_WINDOW_MS - 1), b: ago(PRESENCE_WINDOW_MS + 1) }
    expect(presentPlayers(players, seen, NOW)).toEqual(["a", "c"])
  })

  it("keeps a player seen exactly one window ago and drops them one millisecond later", () => {
    expect(presentPlayers(players, { a: ago(PRESENCE_WINDOW_MS) }, NOW)).toEqual(["a"])
    expect(presentPlayers(players, { a: ago(PRESENCE_WINDOW_MS + 1) }, NOW)).toEqual([])
  })

  it("counts a time slightly ahead of the clock (clock skew between the database and the server) as present", () => {
    expect(presentPlayers(players, { a: ago(-2_000) }, NOW)).toEqual(["a"])
  })

  it("ignores players who were never seen, bad dates and people who are not at the table", () => {
    expect(presentPlayers(players, { a: "not a date", z: ago(0) }, NOW)).toEqual([])
    expect(presentPlayers(players, {}, NOW)).toEqual([])
  })

  it("has nobody present without seen times", () => {
    expect(presentPlayers(players, undefined, NOW)).toEqual([])
    expect(presentPlayers(players, null, NOW)).toEqual([])
  })

  it("reads the times Postgres writes (microseconds, numeric offset)", () => {
    expect(presentPlayers(players, { a: "2026-10-12T09:59:30.123456+00:00" }, NOW)).toEqual(["a"])
  })
})

describe("seenNeedsWrite", () => {
  it("writes when the player was never seen or the stored time is unreadable", () => {
    expect(seenNeedsWrite(undefined, NOW)).toBe(true)
    expect(seenNeedsWrite("", NOW)).toBe(true)
    expect(seenNeedsWrite("not a date", NOW)).toBe(true)
  })

  it("skips the write while the stored time is younger than the write interval", () => {
    expect(seenNeedsWrite(ago(0), NOW)).toBe(false)
    expect(seenNeedsWrite(ago(SEEN_WRITE_EVERY_MS - 1), NOW)).toBe(false)
  })

  it("writes again once the interval has passed", () => {
    expect(seenNeedsWrite(ago(SEEN_WRITE_EVERY_MS), NOW)).toBe(true)
    expect(seenNeedsWrite(ago(PRESENCE_WINDOW_MS), NOW)).toBe(true)
  })

  it("keeps a player who is seen more often than the window present", () => {
    expect(SEEN_WRITE_EVERY_MS).toBeLessThan(PRESENCE_WINDOW_MS)
  })

  it("skips the write for a time ahead of the clock", () => {
    expect(seenNeedsWrite(ago(-5_000), NOW)).toBe(false)
  })
})

describe("parseVotes", () => {
  it("keeps the votes of the current state", () => {
    expect(parseVotes([`${FP}:a:c`, `${FP}:b:c`], FP)).toEqual([
      { voter: "a", target: "c" },
      { voter: "b", target: "c" },
    ])
  })

  it("ignores the votes of another state", () => {
    expect(parseVotes([`old:a:c`, `${FP}:b:c`, `${FP}x:a:b`], FP)).toEqual([{ voter: "b", target: "c" }])
  })

  it("ignores the old format `<fingerprint>:<voter>`, which had no target", () => {
    expect(parseVotes([`${FP}:a`, `${FP}:b:c`], FP)).toEqual([{ voter: "b", target: "c" }])
  })

  it("ignores malformed entries and duplicates", () => {
    expect(parseVotes([`${FP}`, `${FP}::c`, `${FP}:a:`, `${FP}:a:b:c`, `${FP}:a:c`, `${FP}:a:c`], FP)).toEqual([{ voter: "a", target: "c" }])
  })

  it("accepts a missing column", () => {
    expect(parseVotes(null, FP)).toEqual([])
    expect(parseVotes(undefined, FP)).toEqual([])
  })

  it("reads what voteEntry writes", () => {
    const vote = { voter: "a", target: "b" }
    expect(parseVotes([voteEntry(FP, vote)], FP)).toEqual([vote])
    expect(parseVotes([voteEntry(FP, vote)], "other")).toEqual([])
  })
})

describe("takeoverStatus", () => {
  it("asks the present players other than the target, in seat order", () => {
    const status = takeoverStatus({ players, waiting: ["a"], present: ["c", "a", "b"], votes: [] })
    expect(status).toEqual([{ playerId: "a", voters: ["b", "c"], votes: [] }])
  })

  it("does not ask the absent players", () => {
    const status = takeoverStatus({ players, waiting: ["a"], present: ["c"], votes: [] })
    expect(status[0]!.voters).toEqual(["c"])
  })

  it("lists every waiting player, in the order the game gives them", () => {
    const status = takeoverStatus({ players, waiting: ["c", "a"], present: ["b"], votes: [] })
    expect(status.map((s) => s.playerId)).toEqual(["c", "a"])
    expect(status.every((s) => s.voters.join() === "b")).toBe(true)
  })

  it("shows who voted for this target, not for another", () => {
    const votes = [
      { voter: "b", target: "a" },
      { voter: "c", target: "b" },
    ]
    const status = takeoverStatus({ players, waiting: ["a", "b"], present: ["a", "b", "c"], votes })
    expect(status).toEqual([
      { playerId: "a", voters: ["b", "c"], votes: ["b"] },
      { playerId: "b", voters: ["a", "c"], votes: ["c"] },
    ])
  })

  it("does not count the vote of a player who is not present any more", () => {
    const status = takeoverStatus({ players, waiting: ["a"], present: ["c"], votes: [{ voter: "b", target: "a" }] })
    expect(status[0]).toEqual({ playerId: "a", voters: ["c"], votes: [] })
  })

  it("has nobody to ask when the only present player is the target", () => {
    expect(takeoverStatus({ players, waiting: ["a"], present: ["a"], votes: [] })).toEqual([{ playerId: "a", voters: [], votes: [] }])
  })
})

describe("castVotes", () => {
  const cast = (patch: Partial<Parameters<typeof castVotes>[0]> = {}) =>
    castVotes({ players, waiting: ["a"], present: ["b", "c"], entries: [], fingerprint: FP, voter: "b", targets: ["a"], ...patch })

  it("plays for the target once every present voter voted", () => {
    const first = cast({ voter: "b" })
    expect(first.play).toEqual([])
    expect(first.entries).toEqual([`${FP}:b:a`])
    const second = cast({ voter: "c", entries: first.entries })
    expect(second.play).toEqual(["a"])
    expect(second.entries).toEqual([`${FP}:b:a`, `${FP}:c:a`])
  })

  it("does not wait for an absent player", () => {
    expect(cast({ present: ["b"], voter: "b" }).play).toEqual(["a"])
  })

  it("lets a lone present player play for the two others", () => {
    const result = castVotes({ players, waiting: ["a", "b"], present: ["c"], entries: [], fingerprint: FP, voter: "c", targets: ["a", "b"] })
    expect(result.play).toEqual(["a", "b"])
    expect(result.entries).toEqual([`${FP}:c:a`, `${FP}:c:b`])
  })

  it("counts the voter as present even when the presence list does not say so", () => {
    expect(cast({ present: [], voter: "b" }).play).toEqual(["a"])
  })

  it("does not play for a target whose other voter is present and has not voted", () => {
    const result = castVotes({ players, waiting: ["a", "b"], present: ["a", "b", "c"], entries: [], fingerprint: FP, voter: "c", targets: ["a", "b"] })
    expect(result.play).toEqual([])
  })

  it("plays for the targets that are ready and keeps the others waiting", () => {
    // a and c are present, b is absent: a can be played for by c alone, b needs a too
    const result = castVotes({ players, waiting: ["a", "b"], present: ["a", "c"], entries: [], fingerprint: FP, voter: "c", targets: ["a", "b"] })
    expect(result.play).toEqual(["a"])
    expect(result.entries).toEqual([`${FP}:c:a`, `${FP}:c:b`])
  })

  it("plays in the order of the waiting players, not in the order of the request", () => {
    const result = castVotes({ players, waiting: ["a", "b"], present: ["c"], entries: [], fingerprint: FP, voter: "c", targets: ["b", "a"] })
    expect(result.play).toEqual(["a", "b"])
  })

  it("completes a vote left unfinished by a voter who left", () => {
    const waitingOnC = cast({ voter: "b" })
    expect(waitingOnC.play).toEqual([])
    // c left in the meantime: b casting again is enough
    const again = cast({ voter: "b", present: ["b"], entries: waitingOnC.entries })
    expect(again.play).toEqual(["a"])
    expect(again.entries).toEqual(waitingOnC.entries)
  })

  it("keeps the earlier votes when a player comes back", () => {
    const first = cast({ voter: "b", present: ["b"] })
    expect(first.play).toEqual(["a"])
    // the same state, but c is back: b's vote is still there, c's is needed
    const second = cast({ voter: "c", present: ["b", "c"], entries: first.entries })
    expect(second.play).toEqual(["a"])
    const stillWaiting = cast({ voter: "b", present: ["b", "c"], entries: [] })
    expect(stillWaiting.play).toEqual([])
  })

  it("is safe to repeat: the same vote twice changes nothing", () => {
    const once = cast({ voter: "b" })
    const twice = cast({ voter: "b", entries: once.entries })
    expect(twice).toEqual(once)
  })

  it("drops the votes of another state and the old format when it records", () => {
    const entries = ["old:b:a", `${FP}:b`, `${FP}:c:a`]
    expect(cast({ voter: "b", entries }).entries).toEqual([`${FP}:c:a`, `${FP}:b:a`])
  })

  it("does not play for the voter", () => {
    expect(() => cast({ voter: "a" })).toThrow(expect.objectContaining({ code: "NOT_STALLED" }))
    const mixed = castVotes({ players, waiting: ["a", "b"], present: ["a", "c"], entries: [], fingerprint: FP, voter: "a", targets: ["a", "b"] })
    expect(mixed.entries).toEqual([`${FP}:a:b`])
    expect(mixed.play).toEqual([])
  })

  it("rejects a voter who is not at the table", () => {
    expect(() => cast({ voter: "z" })).toThrow(TakeoverError)
    expect(() => cast({ voter: "z" })).toThrow(expect.objectContaining({ code: "UNKNOWN_PLAYER" }))
  })

  it("rejects targets the game does not wait for", () => {
    expect(() => cast({ targets: ["c"] })).toThrow(expect.objectContaining({ code: "NOT_STALLED" }))
    expect(() => cast({ waiting: [] })).toThrow(expect.objectContaining({ code: "NOT_STALLED" }))
    expect(() => cast({ targets: [] })).toThrow(expect.objectContaining({ code: "NOT_STALLED" }))
  })

  it("ignores the targets the game does not wait for when others are valid", () => {
    const result = castVotes({ players, waiting: ["a"], present: ["b"], entries: [], fingerprint: FP, voter: "b", targets: ["a", "c", "unknown"] })
    expect(result.entries).toEqual([`${FP}:b:a`])
    expect(result.play).toEqual(["a"])
  })
})

describe("publicTakeover", () => {
  const base = { players, viewer: null, waiting: ["a"], entries: [], fingerprint: FP, now: NOW }

  it("lists who is present and where the takeover of each waiting player stands", () => {
    const result = publicTakeover({ ...base, seen: { b: ago(5_000), c: ago(10_000) }, entries: [`${FP}:b:a`] })
    expect(result.present).toEqual(["b", "c"])
    expect(result.takeovers).toEqual([{ playerId: "a", voters: ["b", "c"], votes: ["b"] }])
  })

  it("counts the viewer as present even when they were never seen", () => {
    const result = publicTakeover({ ...base, seen: {}, viewer: "b" })
    expect(result.present).toEqual(["b"])
    expect(result.takeovers).toEqual([{ playerId: "a", voters: ["b"], votes: [] }])
  })

  it("does not let a stale seen time of the viewer hide them", () => {
    expect(publicTakeover({ ...base, seen: { b: ago(10 * 60_000) }, viewer: "b" }).present).toEqual(["b"])
  })

  it("ignores a viewer who is not at the table", () => {
    expect(publicTakeover({ ...base, seen: { c: ago(1_000) }, viewer: "stranger" }).present).toEqual(["c"])
    expect(publicTakeover({ ...base, seen: { c: ago(1_000) }, viewer: null }).present).toEqual(["c"])
  })

  it("is the same for every viewer who is present anyway", () => {
    const seen = { a: ago(1_000), b: ago(2_000), c: ago(3_000) }
    const views = ["a", "b", "c", null].map((viewer) => publicTakeover({ ...base, seen, viewer }))
    expect(views[0]).toEqual(views[1])
    expect(views[1]).toEqual(views[2])
    expect(views[2]).toEqual(views[3])
  })

  it("has no takeover without a waiting player and ignores the votes of another state", () => {
    expect(publicTakeover({ ...base, seen: { b: ago(1_000) }, waiting: [] }).takeovers).toEqual([])
    const stale = publicTakeover({ ...base, seen: { b: ago(1_000) }, entries: ["old:b:a"] })
    expect(stale.takeovers[0]!.votes).toEqual([])
  })

  it("works without seen times", () => {
    expect(publicTakeover({ ...base, seen: undefined, viewer: "c" }).present).toEqual(["c"])
    expect(publicTakeover({ ...base, seen: null }).present).toEqual([])
  })
})
