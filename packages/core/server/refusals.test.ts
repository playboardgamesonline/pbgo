import { assertNoPersonalData } from "@pbgo/analytics/privacy"
import { EngineError } from "@pbgo/engine-kit"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  scheduled: [] as Array<() => unknown>,
  track: vi.fn<(event: string, distinctId: string, properties: object) => Promise<void>>(async () => {}),
}))
vi.mock("server-only", () => ({}))
vi.mock("next/server", () => ({ after: (callback: () => unknown) => void mocks.scheduled.push(callback) }))
vi.mock("@pbgo/analytics/server", () => ({ track: mocks.track }))
vi.mock("@pbgo/analytics", async (importOriginal) => ({ ...(await importOriginal<typeof import("@pbgo/analytics")>()), ANALYTICS_ENABLED: true }))

import { gameRouteOf, REFUSALS_PER_MINUTE, reportRefusal, trackAnonymously } from "./analytics"
import { ApiError, handle } from "./api"

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

/** What was sent to PostHog once the responses have left. */
function sent() {
  mocks.scheduled.splice(0).forEach((callback) => callback())
  const calls = mocks.track.mock.calls.map(([event, distinctId, properties]) => ({ event, distinctId, properties }))
  mocks.track.mockClear()
  return calls
}

const url = (path: string) => `http://localhost/api/${path}`
const request = (path: string) => new Request(url(path), { method: "POST" })
const context = { game: { slug: "flip-7" }, params: {} }

/** A route that fails the way `handle` is told to. */
const failing = (error: unknown) => handle(async (_request: Request, _context: unknown) => Promise.reject(error))

/** The cap counts a minute of the server's life: each test starts in a minute of its own */
let minute = 0

beforeEach(() => {
  mocks.scheduled.length = 0
  mocks.track.mockReset()
  vi.useFakeTimers()
  minute += 5
  vi.setSystemTime(new Date(Date.UTC(2030, 0, 1, 0, 0) + minute * 60_000))
})

afterEach(() => {
  vi.useRealTimers()
})

describe("trackAnonymously", () => {
  it("sends with an identifier that is made for the event, and a new one for the next", () => {
    trackAnonymously("table_deleted", { game: "flip-7", reason: "lobby_left" })
    trackAnonymously("table_deleted", { game: "flip-7", reason: "lobby_left" })
    const [first, second] = sent()
    expect(first?.distinctId).toMatch(ID)
    expect(second?.distinctId).toMatch(ID)
    expect(first?.distinctId).not.toBe(second?.distinctId)
  })

  it("sends once the response has left, not while the request is served", () => {
    trackAnonymously("signed_out", {})
    expect(mocks.track).not.toHaveBeenCalled()
    expect(sent()).toEqual([{ event: "signed_out", distinctId: expect.stringMatching(ID), properties: {} }])
  })
})

describe("gameRouteOf", () => {
  it.each([
    ["flip-7/games", "create"],
    ["flip-7/games/ABC234", "read"],
    ["flip-7/games/ABC234/join", "join"],
    ["flip-7/games/ABC234/leave", "leave"],
    ["flip-7/games/ABC234/action", "action"],
    ["flip-7/games/ABC234/chat", "chat"],
    ["flip-7/games/ABC234/options", "options"],
    ["flip-7/games/ABC234/ready", "ready"],
    ["flip-7/games/ABC234/replay", "replay"],
    ["flip-7/games/ABC234/settings", "settings"],
    ["flip-7/games/ABC234/start", "start"],
    ["flip-7/games/ABC234/takeover", "takeover"],
    ["flip-7/feedback", "feedback"],
    ["flip-7/games/ABC234/roll-the-dice", "other"],
  ])("tells /api/%s apart as %s", (path, route) => {
    expect(gameRouteOf(url(path))).toBe(route)
  })

  it.each([
    ["an address that is not one", "not a url"],
    ["a route that is not a game's", url("hub/account/deletion")],
    ["the media proxy", url("media")],
    ["the gamemaster's routes", "http://localhost/gamemaster/api/flip-7/settings"],
    ["a longer address", url("flip-7/games/ABC234/join/again")],
    ["the feedback with more after it", url("flip-7/feedback/more")],
  ])("is null for %s", (_what, address) => {
    expect(gameRouteOf(address)).toBeNull()
  })

  it("never lets the code of a table through, for any route", () => {
    for (const route of ["join", "leave", "anything-else"]) expect(gameRouteOf(url(`flip-7/games/ABC234/${route}`))).not.toContain("ABC234")
  })
})

describe("reportRefusal", () => {
  it("sends the route, the code and the status of a refusal, for nobody", () => {
    reportRefusal([request("flip-7/games/ABC234/join"), context], "GAME_FULL", 409)
    expect(sent()).toEqual([{ event: "game_route_error", distinctId: expect.stringMatching(ID), properties: { game: "flip-7", route: "join", code: "GAME_FULL", status: 409 } }])
  })

  it("holds nothing personal, and nothing of the table's code or the request", () => {
    reportRefusal([request("flip-7/games/ABC234/join"), context], "RANK_TOO_LOW", 403)
    for (const entry of sent()) {
      assertNoPersonalData(entry.properties)
      expect(JSON.stringify(entry)).not.toContain("ABC234")
    }
  })

  it("says UNKNOWN for a code that is not one of ours", () => {
    reportRefusal([request("flip-7/games/ABC234/join"), context], "The table is full, sorry Marly", 409)
    expect(sent()[0]?.properties).toMatchObject({ code: "UNKNOWN" })
  })

  it.each(["TOO_MANY_REQUESTS", "GAME_NOT_FOUND", "UNKNOWN_PLAYER", "INVALID_REQUEST", "FORBIDDEN", "CROSS_ORIGIN"])("keeps quiet about %s: bots and stale tabs", (code) => {
    reportRefusal([request("flip-7/games/ABC234/join"), context], code, 400)
    expect(sent()).toEqual([])
  })

  it("keeps quiet when the analytics are off", () => {
    reportRefusal([request("flip-7/games/ABC234/join"), context], "GAME_FULL", 409, { enabled: false })
    expect(sent()).toEqual([])
  })

  it("says nothing for a route that is not a game's, or for a request that is not one", () => {
    reportRefusal([request("hub/account/deletion"), undefined], "NOT_SIGNED_IN", 401)
    reportRefusal([request("hub/account/deletion"), context], "NOT_SIGNED_IN", 401)
    reportRefusal(["not a request", context], "GAME_FULL", 409)
    reportRefusal([], "GAME_FULL", 409)
    expect(sent()).toEqual([])
  })

  it(`lets ${REFUSALS_PER_MINUTE} through a minute and no more, and starts again with the next minute`, () => {
    for (let count = 0; count < REFUSALS_PER_MINUTE + 4; count++) reportRefusal([request("flip-7/games/ABC234/join"), context], "GAME_FULL", 409)
    expect(sent()).toHaveLength(REFUSALS_PER_MINUTE)
    vi.setSystemTime(new Date(Date.now() + 61_000))
    reportRefusal([request("flip-7/games/ABC234/join"), context], "GAME_FULL", 409)
    expect(sent()).toHaveLength(1)
  })

  it("never throws", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    const hostile = {
      get game(): never {
        throw new Error("boom")
      },
    }
    expect(() => reportRefusal([request("flip-7/games/ABC234/join"), hostile], "GAME_FULL", 409)).not.toThrow()
    spy.mockRestore()
  })
})

describe("handle", () => {
  it("reports what a route refused with, and still answers as it did", async () => {
    const response = await failing(new ApiError("GAME_FULL", 409))(request("flip-7/games/ABC234/join"), context)
    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ error: "GAME_FULL" })
    expect(sent().map((entry) => entry.properties)).toEqual([{ game: "flip-7", route: "join", code: "GAME_FULL", status: 409 }])
  })

  it("reports the refusal of a game's engine as a 400", async () => {
    const response = await failing(new EngineError("NOT_YOUR_TURN"))(request("flip-7/games/ABC234/action"), context)
    expect(response.status).toBe(400)
    expect(sent().map((entry) => entry.properties)).toEqual([{ game: "flip-7", route: "action", code: "NOT_YOUR_TURN", status: 400 }])
  })

  it("reports a failure as SERVER_ERROR, and logs the failure itself", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {})
    const response = await failing(new Error("the database said something about Marly"))(request("flip-7/games/ABC234/start"), context)
    expect(response.status).toBe(500)
    expect(sent().map((entry) => entry.properties)).toEqual([{ game: "flip-7", route: "start", code: "SERVER_ERROR", status: 500 }])
    expect(log).toHaveBeenCalledOnce()
    log.mockRestore()
  })

  it("reports nothing for the rate limit, and nothing for a route that is not a game's", async () => {
    await failing(new ApiError("TOO_MANY_REQUESTS", 429))(request("flip-7/games/ABC234/join"), context)
    await failing(new ApiError("NOT_SIGNED_IN", 401))(request("hub/account/deletion"), undefined)
    expect(sent()).toEqual([])
  })

  it("reports nothing when a route succeeds", async () => {
    const response = await handle(async (_request: Request, _context: unknown) => ({ ok: true }))(request("flip-7/games/ABC234/join"), context)
    expect(response.status).toBe(200)
    expect(sent()).toEqual([])
  })
})
