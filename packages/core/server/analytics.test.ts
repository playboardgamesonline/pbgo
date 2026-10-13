import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  after: vi.fn<(callback: () => unknown) => void>(),
  track: vi.fn<(event: string, distinctId: string, properties: object) => Promise<void>>(async () => {}),
}))
vi.mock("server-only", () => ({}))
vi.mock("next/server", () => ({ after: mocks.after }))
vi.mock("@pbgo/analytics/server", () => ({ track: mocks.track }))

import { gameFinishedProperties, trackAfter, trackGameFinished } from "./analytics"

/** `after` of a request: the callbacks wait for the response, here for the test to run them */
const scheduled: Array<() => unknown> = []
const runScheduled = () => scheduled.splice(0).forEach((callback) => callback())

beforeEach(() => {
  scheduled.length = 0
  mocks.after.mockReset()
  mocks.after.mockImplementation((callback) => void scheduled.push(callback))
  mocks.track.mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("trackAfter", () => {
  it("sends the event once the response has left, not while the request is served", () => {
    trackAfter("player_joined", "player-1", { game: "courtisans", seat: 1, players: 2 })
    expect(mocks.track).not.toHaveBeenCalled()
    runScheduled()
    expect(mocks.track).toHaveBeenCalledTimes(1)
    expect(mocks.track).toHaveBeenCalledWith("player_joined", "player-1", { game: "courtisans", seat: 1, players: 2 })
  })

  it("sends nothing for a request without a player", () => {
    trackAfter("chat_message_sent", null, { game: "courtisans", kind: "text" })
    expect(mocks.after).not.toHaveBeenCalled()
    runScheduled()
    expect(mocks.track).not.toHaveBeenCalled()
  })

  it("never breaks the request when the callback cannot be scheduled", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    mocks.after.mockImplementation(() => {
      throw new Error("`after` was called outside a request scope")
    })
    expect(() => trackAfter("rematch_started", "player-1", { game: "courtisans" })).not.toThrow()
    expect(error).toHaveBeenCalledTimes(1)
    expect(String(error.mock.calls[0]?.[0])).toContain("rematch_started")
  })
})

describe("gameFinishedProperties", () => {
  const row = { players: [{ id: "a" }, { id: "b" }, { id: "c" }], version: 42, created_at: "2026-01-01T10:00:00.000Z", updated_at: "2026-01-01T10:25:30.400Z" }

  it("describes the table that has just ended, as an approximation it says so", () => {
    expect(gameFinishedProperties("courtisans", row as never)).toEqual({
      game: "courtisans",
      duration_s: 1530,
      players: 3,
      moves_count: 42,
      ended_by: "natural",
      approximate: true,
    })
  })

  it("rounds the duration to the second", () => {
    expect(gameFinishedProperties("courtisans", { ...row, updated_at: "2026-01-01T10:00:00.499Z" } as never).duration_s).toBe(0)
    expect(gameFinishedProperties("courtisans", { ...row, updated_at: "2026-01-01T10:00:00.500Z" } as never).duration_s).toBe(1)
  })

  it("leaves the duration out when the row has no usable dates", () => {
    for (const dates of [
      { created_at: undefined },
      { updated_at: undefined },
      { created_at: "not a date" },
      { updated_at: "2026-01-01T09:59:59.000Z" }, // before the creation: a clock that went back, not a negative game
    ]) {
      const properties = gameFinishedProperties("courtisans", { ...row, ...dates } as never)
      expect(properties).not.toHaveProperty("duration_s")
      expect(properties).toMatchObject({ players: 3, moves_count: 42, approximate: true })
    }
  })

  it("carries nothing a player typed: no name, no table code, no id", () => {
    const keys = Object.keys(gameFinishedProperties("courtisans", { ...row, code: "ABC123", host_id: "a" } as never)).sort()
    expect(keys).toEqual(["approximate", "duration_s", "ended_by", "game", "moves_count", "players"])
  })
})

describe("trackGameFinished", () => {
  const row = { players: [{ id: "a" }, { id: "b" }], version: 7, created_at: "2026-01-01T10:00:00.000Z", updated_at: "2026-01-01T10:10:00.000Z" }

  it("sends game_finished for the player whose request ended the game", () => {
    trackGameFinished("courtisans", row as never, "a")
    runScheduled()
    expect(mocks.track).toHaveBeenCalledWith("game_finished", "a", {
      game: "courtisans",
      duration_s: 600,
      players: 2,
      moves_count: 7,
      ended_by: "natural",
      approximate: true,
    })
  })

  it("sends nothing without a player", () => {
    trackGameFinished("courtisans", row as never, null)
    runScheduled()
    expect(mocks.track).not.toHaveBeenCalled()
  })
})
