import { SHARED_ERROR_CODES } from "@pbgo/engine-kit"
import { afterEach, describe, expect, it } from "vitest"
import { ApiClientError, CORE_ERROR_MESSAGES, setErrorOverrides } from "./api"

afterEach(() => setErrorOverrides({}))

describe("ApiClientError", () => {
  it("writes the platform's message for one of its own codes", () => {
    expect(new ApiClientError("GAME_FULL").message).toBe(CORE_ERROR_MESSAGES.GAME_FULL)
  })

  it("lets the message of the skin win over the platform's", () => {
    setErrorOverrides({ GAME_FULL: "Table is full" })
    expect(new ApiClientError("GAME_FULL").message).toBe("Table is full")
  })

  it("reads the message of a code of the game from the skin", () => {
    setErrorOverrides({ NOT_ENOUGH_MISSIONS: "Not enough missions" })
    expect(new ApiClientError("NOT_ENOUGH_MISSIONS").message).toBe("Not enough missions")
  })

  // A code of the game has no message in the code: Sanity holds it, and the page says so while it does not
  it("says which message is missing for a code of the game that Sanity has none for", () => {
    expect(new ApiClientError("NOT_ENOUGH_MISSIONS").message).toBe("[missing: errorMessages.NOT_ENOUGH_MISSIONS]")
  })

  it("keeps the code it was built with", () => {
    expect(new ApiClientError("CONFLICT").code).toBe("CONFLICT")
  })
})

describe("CORE_ERROR_MESSAGES", () => {
  it("words every code the engines share, so no game has to", () => {
    for (const code of SHARED_ERROR_CODES) expect(CORE_ERROR_MESSAGES[code], code).toBeTruthy()
  })

  it("shows a player the platform's message for a code an engine threw", () => {
    expect(new ApiClientError("INVALID_PHASE").message).toBe(CORE_ERROR_MESSAGES.INVALID_PHASE)
    expect(new ApiClientError("GAME_OVER").message).toBe("The game is over.")
  })
})
