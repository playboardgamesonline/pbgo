import { describe, expect, it } from "vitest"
import { EngineError, isEngineError, isSharedErrorCode, SHARED_ERROR_CODES } from "./errors"

describe("SHARED_ERROR_CODES", () => {
  it("lists each code once, in capitals with underscores", () => {
    expect(new Set(SHARED_ERROR_CODES).size).toBe(SHARED_ERROR_CODES.length)
    for (const code of SHARED_ERROR_CODES) expect(code).toMatch(/^[A-Z]+(_[A-Z]+)*$/)
  })

  it("holds the codes the kit throws itself", () => {
    expect(SHARED_ERROR_CODES).toContain("NOT_WAITING")
    expect(SHARED_ERROR_CODES).toContain("AUTOPLAY_UNSUPPORTED")
  })

  it("tells a shared code from the code of a game", () => {
    expect(isSharedErrorCode("INVALID_PLAYERS")).toBe(true)
    expect(isSharedErrorCode("CANNOT_STAY")).toBe(false)
    expect(isSharedErrorCode("invalid_players")).toBe(false)
  })
})

describe("EngineError", () => {
  it("carries a code, which is its message unless it is given one", () => {
    expect(new EngineError("NOT_YOUR_TURN").message).toBe("NOT_YOUR_TURN")
    expect(new EngineError("CANNOT_STAY", "hit instead").message).toBe("hit instead")
    expect(new EngineError("CANNOT_STAY").code).toBe("CANNOT_STAY")
  })

  it("is recognised by its name and its code, not only by its class", () => {
    class Own extends Error {
      code = "INVALID_BID"
      name = "EngineError"
    }
    expect(isEngineError(new EngineError("INVALID_ACTION"))).toBe(true)
    expect(isEngineError(new Own())).toBe(true)
    expect(isEngineError(new Error("INVALID_ACTION"))).toBe(false)
  })
})
