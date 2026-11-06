import { describe, expect, it } from "vitest"
import { READY_WINDOW_MS, expirePatch, readyExpired, readyIds, readyLeft, readyPatch, readyWindowMs, startingPatch, withdrawPatch } from "./ready"

const ann = { id: "p1", nickname: "Ann" }
const bob = { id: "p2", nickname: "Bob" }
const cy = { id: "p3", nickname: "Cy" }

const NOW = Date.parse("2026-01-01T10:00:00.000Z")
const iso = (ms: number) => new Date(ms).toISOString()

/** A table in its ready check: Ann hosts, `ready` says who has confirmed, the time is up `left` ms from NOW. */
const check = (ready: string[] = [], left = 30_000, players = [ann, bob, cy]) => ({
  status: "starting" as const,
  host_id: "p1",
  players,
  ready_at: Object.fromEntries(ready.map((id) => [id, iso(NOW - 1000)])),
  ready_deadline: iso(NOW + left),
})

describe("readyWindowMs", () => {
  it("is a minute unless the environment says otherwise", () => {
    expect(READY_WINDOW_MS).toBe(60_000)
    expect(readyWindowMs({})).toBe(60_000)
    expect(readyWindowMs({ READY_CHECK_SECONDS: "12" })).toBe(12_000)
  })

  it("ignores a value that is not a whole number of seconds from 5 to 600", () => {
    for (const value of ["", "abc", "1.5", "4", "601", "-10", "0"]) expect(readyWindowMs({ READY_CHECK_SECONDS: value })).toBe(60_000)
  })
})

describe("readyIds", () => {
  it("lists those who confirmed, in seat order, and ignores a mark of someone who is not seated", () => {
    expect(readyIds({ players: [ann, bob, cy], ready_at: { p3: iso(NOW), p1: iso(NOW), ghost: iso(NOW) } })).toEqual(["p1", "p3"])
    expect(readyIds({ players: [ann, bob], ready_at: undefined })).toEqual([])
  })
})

describe("readyExpired and readyLeft", () => {
  it("count down to the deadline", () => {
    expect(readyExpired(check(), NOW)).toBe(false)
    expect(readyLeft(check(), NOW)).toBe(30_000)
    expect(readyExpired(check([], 30_000), NOW + 29_999)).toBe(false)
    expect(readyExpired(check([], 30_000), NOW + 30_000)).toBe(true)
    expect(readyLeft(check([], 30_000), NOW + 45_000)).toBe(0)
  })

  it("know nothing of a table that is not in a ready check", () => {
    for (const status of ["lobby", "playing", "over"] as const) {
      const row = { status, ready_deadline: iso(NOW - 1000) }
      expect(readyExpired(row, NOW)).toBe(false)
      expect(readyLeft(row, NOW)).toBeNull()
    }
  })

  it("take a ready check with no usable deadline as over, never as unending", () => {
    expect(readyExpired({ status: "starting", ready_deadline: null }, NOW)).toBe(true)
    expect(readyLeft({ status: "starting", ready_deadline: undefined }, NOW)).toBe(0)
  })
})

describe("startingPatch", () => {
  it("keeps the game that was set up and opens the check for the window", () => {
    const started = { state: { turn: 0 }, replay: [], takeover_votes: [] }
    expect(startingPatch(started, NOW, 20_000)).toEqual({
      state: { turn: 0 },
      replay: [],
      takeover_votes: [],
      status: "starting",
      ready_at: {},
      ready_deadline: iso(NOW + 20_000),
    })
  })
})

describe("readyPatch", () => {
  it("marks the player with the time they said it", () => {
    expect(readyPatch(check(["p1"]), "p2", NOW)).toEqual({ ready_at: { p1: iso(NOW - 1000), p2: iso(NOW) } })
  })

  it("begins the game when the last player says it, and clears the marks", () => {
    expect(readyPatch(check(["p1", "p3"]), "p2", NOW)).toEqual({ status: "playing", ready_at: {}, ready_deadline: null })
  })

  it("begins a game of one seat as soon as the player is ready", () => {
    expect(readyPatch(check([], 30_000, [ann]), "p1", NOW)).toMatchObject({ status: "playing" })
  })

  it("changes nothing for a player who said it already, who is not at the table, or for a table that is not in a ready check", () => {
    expect(readyPatch(check(["p2"]), "p2", NOW)).toBeNull()
    expect(readyPatch(check(), "ghost", NOW)).toBeNull()
    for (const status of ["lobby", "playing", "over"] as const) expect(readyPatch({ ...check(), status }, "p1", NOW)).toBeNull()
  })
})

describe("expirePatch", () => {
  it("unseats whoever was not ready and sends the table back to the lobby with the others, the game set up for the first seating dropped", () => {
    expect(expirePatch(check(["p1", "p3"]))).toEqual({
      status: "lobby",
      players: [ann, cy],
      host_id: "p1",
      state: null,
      replay: [],
      takeover_votes: [],
      ready_at: {},
      ready_deadline: null,
    })
  })

  it("gives the table to the first of those who are left when the host was not ready", () => {
    expect(expirePatch(check(["p2", "p3"]))).toMatchObject({ players: [bob, cy], host_id: "p2" })
  })

  it("leaves an empty lobby when nobody was ready, its host left unchanged for the first to sit down again to replace", () => {
    expect(expirePatch(check())).toMatchObject({ status: "lobby", players: [], host_id: "p1" })
  })
})

describe("withdrawPatch", () => {
  it("unseats the player who leaves and sends the table back to the lobby with all the others, ready or not", () => {
    expect(withdrawPatch(check(["p1", "p2"]), "p3")).toMatchObject({ status: "lobby", players: [ann, bob], host_id: "p1", state: null, ready_at: {}, ready_deadline: null })
  })

  it("hands the table to the next seat when the host leaves", () => {
    expect(withdrawPatch(check(["p1"]), "p1")).toMatchObject({ players: [bob, cy], host_id: "p2" })
  })

  it("changes nothing for someone who is not at the table, or for a table that is not in a ready check", () => {
    expect(withdrawPatch(check(), "ghost")).toBeNull()
    expect(withdrawPatch({ ...check(), status: "lobby" }, "p1")).toBeNull()
  })
})
