import { describe, expect, it } from "vitest"
import { DEFAULT_PREFERENCES, NICKNAME_KEY, PREFERENCE_KEYS, nicknameOf, preferencesOf } from "./preferences"

describe("the keys that are ours", () => {
  it("carry the namespace of the platform, which a provider never writes", () => {
    for (const key of [NICKNAME_KEY, ...Object.values(PREFERENCE_KEYS)]) expect(key).toMatch(/^pbgo_/)
  })

  it("are one key for each preference", () => {
    expect(Object.keys(PREFERENCE_KEYS).sort()).toEqual(Object.keys(DEFAULT_PREFERENCES).sort())
    expect(new Set(Object.values(PREFERENCE_KEYS)).size).toBe(Object.keys(PREFERENCE_KEYS).length)
  })
})

describe("preferencesOf", () => {
  it("is the default of each preference for an account that set none", () => {
    expect(preferencesOf({})).toEqual(DEFAULT_PREFERENCES)
    expect(preferencesOf({ user_metadata: {} })).toEqual(DEFAULT_PREFERENCES)
    expect(preferencesOf({ user_metadata: null })).toEqual(DEFAULT_PREFERENCES)
  })

  it("reads what the member set, preference by preference", () => {
    expect(preferencesOf({ user_metadata: { pbgo_notify_turn: false, pbgo_hide_history: true } })).toEqual({ notifyTurn: false, notifyInvites: true, hideHistory: true })
  })

  it("reads anything that is not a boolean as no choice: the member can write their own metadata", () => {
    expect(preferencesOf({ user_metadata: { pbgo_notify_turn: "no", pbgo_notify_invites: 0, pbgo_hide_history: null } })).toEqual(DEFAULT_PREFERENCES)
  })

  it("does not read the keys of a provider for a preference", () => {
    expect(preferencesOf({ user_metadata: { notifyTurn: false, hideHistory: true, full_name: "Oré" } })).toEqual(DEFAULT_PREFERENCES)
  })
})

describe("nicknameOf", () => {
  it("is the nickname the member chose, cleaned like a display name", () => {
    expect(nicknameOf({ user_metadata: { pbgo_nickname: "  Marly   74 " } })).toBe("Marly 74")
    expect(nicknameOf({ user_metadata: { pbgo_nickname: "Mar\u0000ly" } })).toBe("Marly")
  })

  it("is null when they chose none, or when the key holds no sensible name", () => {
    expect(nicknameOf({})).toBeNull()
    expect(nicknameOf({ user_metadata: { full_name: "Oré" } })).toBeNull()
    expect(nicknameOf({ user_metadata: { pbgo_nickname: "   " } })).toBeNull()
    expect(nicknameOf({ user_metadata: { pbgo_nickname: 42 } })).toBeNull()
    expect(nicknameOf({ user_metadata: { pbgo_nickname: "x".repeat(41) } })).toBeNull()
  })

  it("counts a name as a person does: an emoji is one character", () => {
    expect(nicknameOf({ user_metadata: { pbgo_nickname: "🎲".repeat(40) } })).toBe("🎲".repeat(40))
  })
})
