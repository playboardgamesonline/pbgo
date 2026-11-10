import { afterEach, describe, expect, it, vi } from "vitest"
import { ApiError } from "./api"
import { profileOf, resolveActor, resolveSeat, validateProfile } from "./profile"

const mocks = vi.hoisted(() => ({ account: null as { id: string; nickname: string; avatarUrl: string | null } | null, ensure: vi.fn() }))

vi.mock("server-only", () => ({}))
vi.mock("@pbgo/accounts/server", () => ({ getAccount: async () => mocks.account }))
// The profile a member has is the database's: here it is whatever the test says, or none
vi.mock("./profiles", async (importOriginal) => ({ ...(await importOriginal<typeof import("./profiles")>()), ensureProfile: mocks.ensure }))

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

  it("takes the # out of a guest's nickname: only a member has a tag, and a guest cannot write one to be taken for them", () => {
    expect(validateProfile({ nickname: "Alex#0042" })).toEqual({ nickname: "Alex0042" })
    expect(validateProfile({ nickname: "#A#l#e#x#" })).toEqual({ nickname: "Alex" })
    expect(codeOf(() => validateProfile({ nickname: " # " }))).toBe("INVALID_NICKNAME")
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

  it("is the profile of a member when they have one: their nickname and tag, and the picture of their profile, not the account's", () => {
    const member = { nickname: "Alex", tag: 42, avatarUrl: "https://cdn.example/profile.png" }
    expect(profileOf({ nickname: "Anne Martin", avatarUrl: "https://cdn.example/anne.png" }, { nickname: "Someone else" }, member)).toEqual({ nickname: "Alex", tag: 42, avatarUrl: "https://cdn.example/profile.png" })
    expect(profileOf({ nickname: "Anne Martin", avatarUrl: "https://cdn.example/anne.png" }, {}, { ...member, avatarUrl: null })).toStrictEqual({ nickname: "Alex", tag: 42 })
    expect(profileOf({ nickname: "Anne Martin", avatarUrl: null }, {}, { ...member, avatarUrl: "http://cdn.example/profile.png" })).toStrictEqual({ nickname: "Alex", tag: 42 })
  })

  it("gives a guest no tag, whatever profile is passed: a guest has none", () => {
    expect(profileOf(null, { nickname: "Ann" }, { nickname: "Alex", tag: 42, avatarUrl: null })).toStrictEqual({ nickname: "Ann" })
  })
})

describe("resolveSeat", () => {
  afterEach(() => {
    mocks.account = null
    mocks.ensure.mockReset()
  })

  it("sits a guest down under the nickname they typed, with no account", async () => {
    expect(await resolveSeat({ nickname: " Ann " })).toEqual({ profile: { nickname: "Ann" }, memberId: null, signedIn: false })
  })

  it("sits a member down as their account and says which account it is", async () => {
    mocks.account = { id: "0b9f6a52-8c0e-4d6e-9d53-4a1d2f6a7c11", nickname: "Anne Martin", avatarUrl: "https://cdn.example/anne.png" }
    expect(await resolveSeat({ nickname: "Someone else" })).toEqual({
      profile: { nickname: "Anne Martin", avatarUrl: "https://cdn.example/anne.png" },
      memberId: "0b9f6a52-8c0e-4d6e-9d53-4a1d2f6a7c11",
      signedIn: true,
    })
  })

  it("sits a member down as their profile, with its tag, when the database has one", async () => {
    mocks.account = { id: "0b9f6a52-8c0e-4d6e-9d53-4a1d2f6a7c11", nickname: "Anne Martin", avatarUrl: "https://cdn.example/anne.png" }
    mocks.ensure.mockResolvedValue({ userId: mocks.account.id, nickname: "Annie", tag: 7, avatarUrl: "https://cdn.example/annie.png", hideHistory: false, createdAt: "2026-10-01T09:00:00.000Z" })
    expect(await resolveSeat({ nickname: "Someone else" })).toEqual({ profile: { nickname: "Annie", tag: 7, avatarUrl: "https://cdn.example/annie.png" }, memberId: mocks.account.id, signedIn: true })
    // Asked for the account, which the profile is made from when the database has none
    expect(mocks.ensure).toHaveBeenCalledWith(mocks.account)
  })

  it("does not keep a member from sitting down when their profile cannot be read: the seat is the account's, with no tag", async () => {
    mocks.account = { id: "0b9f6a52-8c0e-4d6e-9d53-4a1d2f6a7c11", nickname: "Anne Martin", avatarUrl: null }
    mocks.ensure.mockRejectedValue(new Error("connection refused"))
    const log = vi.spyOn(console, "error").mockImplementation(() => {})
    expect(await resolveSeat({})).toEqual({ profile: { nickname: "Anne Martin" }, memberId: mocks.account.id, signedIn: true })
    expect(log).toHaveBeenCalledTimes(1)
    log.mockRestore()
  })

  it("asks no profile for a guest", async () => {
    await resolveSeat({ nickname: "Ann" })
    expect(mocks.ensure).not.toHaveBeenCalled()
  })

  it("gives the demo account of development no member id, since it is in no database, but says it is signed in", async () => {
    mocks.account = { id: "demo", nickname: "Oré", avatarUrl: null }
    expect(await resolveSeat({})).toEqual({ profile: { nickname: "Oré" }, memberId: null, signedIn: true })
  })
})

describe("resolveActor", () => {
  afterEach(() => {
    mocks.account = null
  })

  it("is a guest for a visitor with no session, and asks no nickname of them", async () => {
    expect(await resolveActor()).toEqual({ memberId: null, signedIn: false })
  })

  it("is the member for a signed-in visitor", async () => {
    mocks.account = { id: "0b9f6a52-8c0e-4d6e-9d53-4a1d2f6a7c11", nickname: "Anne Martin", avatarUrl: null }
    expect(await resolveActor()).toEqual({ memberId: "0b9f6a52-8c0e-4d6e-9d53-4a1d2f6a7c11", signedIn: true })
  })

  it("is signed in with no member id for the demo account of development", async () => {
    mocks.account = { id: "demo", nickname: "Oré", avatarUrl: null }
    expect(await resolveActor()).toEqual({ memberId: null, signedIn: true })
  })
})
