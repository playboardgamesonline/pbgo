import { EngineError } from "@pbgo/engine-kit"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ApiError, handle, notPlaying } from "./api"

vi.mock("server-only", () => ({}))

afterEach(() => vi.restoreAllMocks())

describe("notPlaying", () => {
  it("says the game is over for a table that has ended", () => {
    expect(notPlaying({ status: "over" })).toMatchObject({ code: "GAME_OVER", status: 409 })
  })

  it("says the game has not started for a table that waits for its players or is getting ready", () => {
    expect(notPlaying({ status: "lobby" })).toMatchObject({ code: "GAME_NOT_STARTED", status: 409 })
    expect(notPlaying({ status: "starting" })).toMatchObject({ code: "GAME_NOT_STARTED", status: 409 })
  })
})

describe("handle", () => {
  const answer = async (error: unknown) => {
    const response = await handle(async () => {
      throw error
    })()
    return { status: response.status, body: await response.json() }
  }

  it("answers an engine's refusal with its code", async () => {
    expect(await answer(new EngineError("NOT_YOUR_TURN"))).toEqual({ status: 400, body: { error: "NOT_YOUR_TURN" } })
  })

  it("answers the refusal of an engine that has a class of its own the same way", async () => {
    class Own extends Error {
      code = "INVALID_ASSASSINATION"
      name = "EngineError"
    }
    expect(await answer(new Own())).toEqual({ status: 400, body: { error: "INVALID_ASSASSINATION" } })
  })

  it("answers a refusal of the platform with its code and its status", async () => {
    expect(await answer(new ApiError("GAME_FULL", 409))).toEqual({ status: 409, body: { error: "GAME_FULL" } })
  })

  it("hides any other error behind SERVER_ERROR", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    expect(await answer(new RangeError("a pile too short"))).toEqual({ status: 500, body: { error: "SERVER_ERROR" } })
  })
})
