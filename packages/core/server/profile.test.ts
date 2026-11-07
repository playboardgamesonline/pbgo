import { afterEach, describe, expect, it, vi } from "vitest"
import { ApiError } from "./api"
import { profileOf, resolveSeat, validateProfile } from "./profile"

const mocks = vi.hoisted(() => ({ account: null as { id: string; nickname: string; avatarUrl: string | null } | null }))

vi.mock("server-only", () => ({}))
vi.mock("@pbgo/accounts/server", () => ({ getAccount: async () => mocks.account }))

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

  it("keeps the picture of an account only when it is an https address of a sensible length", () => {
    const of = (avatarUrl: string | null) => profileOf({ nickname: "Bob", avatarUrl }, {})
    expect(of("https://cdn.discordapp.com/avatars/1/a.png")).toEqual({ nickname: "Bob", avatarUrl: "https://cdn.discordapp.com/avatars/1/a.png" })
    for (const url of ["http://cdn.example/a.png", "javascript:alert(1)", "data:image/png;base64,AAAA", "//cdn.example/a.png", `https://cdn.example/${"a".repeat(2100)}`]) {
      expect(of(url), url.slice(0, 40)).toStrictEqual({ nickname: "Bob" })
    }
  })

  it("cuts a long name by characters, never through an emoji, and never leaves it empty", () => {
    expect(profileOf({ nickname: "🎲".repeat(25), avatarUrl: null }, {}).nickname).toBe("🎲".repeat(20))
    expect(profileOf({ nickname: "   ", avatarUrl: null }, {}).nickname).toBe("Player")
  })
})

describe("resolveSeat", () => {
  afterEach(() => {
    mocks.account = null
  })

  it("sits a guest down under the nickname they typed, with no account", async () => {
    expect(await resolveSeat({ nickname: " Ann " })).toEqual({ profile: { nickname: "Ann" }, memberId: null })
  })

  it("sits a member down as their account and says which account it is", async () => {
    mocks.account = { id: "0b9f6a52-8c0e-4d6e-9d53-4a1d2f6a7c11", nickname: "Anne Martin", avatarUrl: "https://cdn.example/anne.png" }
    expect(await resolveSeat({ nickname: "Someone else" })).toEqual({
      profile: { nickname: "Anne Martin", avatarUrl: "https://cdn.example/anne.png" },
      memberId: "0b9f6a52-8c0e-4d6e-9d53-4a1d2f6a7c11",
    })
  })

  it("gives the demo account of development no member id: it is in no database", async () => {
    mocks.account = { id: "demo", nickname: "Oré", avatarUrl: null }
    expect(await resolveSeat({})).toEqual({ profile: { nickname: "Oré" }, memberId: null })
  })
})
