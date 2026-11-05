import { describe, expect, it, vi } from "vitest"
import { ApiError } from "./api"
import { profileOf, validateProfile } from "./profile"

vi.mock("server-only", () => ({}))
vi.mock("@pbgo/accounts/server", () => ({ getAccount: async () => null }))

const codeOf = (fn: () => unknown) => {
  try {
    fn()
  } catch (error) {
    return error instanceof ApiError ? error.code : "other"
  }
  return null
}

describe("validateProfile", () => {
  it("trims the nickname and keeps its first 20 characters", () => {
    expect(validateProfile({ nickname: "  Ann  " })).toEqual({ nickname: "Ann" })
    expect(validateProfile({ nickname: "x".repeat(30) })).toEqual({ nickname: "x".repeat(20) })
  })

  it("refuses a nickname that is missing, not a text or empty", () => {
    expect(codeOf(() => validateProfile({}))).toBe("INVALID_NICKNAME")
    expect(codeOf(() => validateProfile({ nickname: 7 }))).toBe("INVALID_NICKNAME")
    expect(codeOf(() => validateProfile({ nickname: "   " }))).toBe("INVALID_NICKNAME")
  })
})

describe("profileOf", () => {
  it("is the typed nickname for a guest, and nothing else of the request", () => {
    expect(profileOf(null, { nickname: " Ann ", avatarUrl: "https://evil.example/x.png" } as never)).toEqual({ nickname: "Ann" })
    expect(codeOf(() => profileOf(null, {}))).toBe("INVALID_NICKNAME")
  })

  it("is the name and the picture of an account, whatever the request says", () => {
    expect(profileOf({ nickname: "Anne Martin", avatarUrl: "https://cdn.example/anne.png" }, { nickname: "Someone else" })).toEqual({ nickname: "Anne Martin", avatarUrl: "https://cdn.example/anne.png" })
  })

  it("leaves the picture out for an account that has none", () => {
    expect(profileOf({ nickname: "Bob", avatarUrl: null }, {})).toStrictEqual({ nickname: "Bob" })
  })

  it("cuts a long name by characters, never through an emoji, and never leaves it empty", () => {
    expect(profileOf({ nickname: "🎲".repeat(25), avatarUrl: null }, {}).nickname).toBe("🎲".repeat(20))
    expect(profileOf({ nickname: "   ", avatarUrl: null }, {}).nickname).toBe("Player")
  })
})
