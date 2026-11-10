import { describe, expect, it } from "vitest"
import { providerSignInOf, signInProviderOf } from "./sign-in-report"

describe("signInProviderOf", () => {
  it.each(["google", "discord", "steam"])("names %s", (provider) => {
    expect(signInProviderOf(provider)).toBe(provider)
  })

  it.each(["twitch", "email", "Google", "", "facebook"])("is null for %s: it signs nobody in", (provider) => {
    expect(signInProviderOf(provider)).toBeNull()
  })
})

describe("providerSignInOf", () => {
  it("says a sign-in made the account when it comes with it", () => {
    const user = { created_at: "2026-11-10T10:00:00.000Z", last_sign_in_at: "2026-11-10T10:00:01.500Z", identities: [{ provider: "google", last_sign_in_at: "2026-11-10T10:00:01.500Z" }] }
    expect(providerSignInOf(user)).toEqual({ method: "google", new_account: true })
  })

  it("says it did not for an account that was made long before", () => {
    const user = { created_at: "2026-10-01T10:00:00.000Z", last_sign_in_at: "2026-11-10T10:00:01.500Z", identities: [{ provider: "discord", last_sign_in_at: "2026-11-10T10:00:01.500Z" }] }
    expect(providerSignInOf(user)).toEqual({ method: "discord", new_account: false })
  })

  it("takes the identity that signed in last, not the first the account had", () => {
    const user = {
      created_at: "2026-10-01T10:00:00.000Z",
      last_sign_in_at: "2026-11-10T10:00:00.000Z",
      identities: [
        { provider: "google", last_sign_in_at: "2026-10-01T10:00:00.000Z" },
        { provider: "discord", last_sign_in_at: "2026-11-10T10:00:00.000Z" },
      ],
    }
    expect(providerSignInOf(user)?.method).toBe("discord")
  })

  it("is not a sign-in that counts when the service only links, or the identity is an address", () => {
    expect(providerSignInOf({ identities: [{ provider: "twitch", last_sign_in_at: "2026-11-10T10:00:00.000Z" }] })).toBeNull()
    expect(providerSignInOf({ identities: [{ provider: "email", last_sign_in_at: "2026-11-10T10:00:00.000Z" }] })).toBeNull()
  })

  it("says nothing for nobody or for a user without identities", () => {
    expect(providerSignInOf(null)).toBeNull()
    expect(providerSignInOf(undefined)).toBeNull()
    expect(providerSignInOf({ identities: [] })).toBeNull()
    expect(providerSignInOf({})).toBeNull()
  })

  it("does not claim a new account when the dates are missing", () => {
    expect(providerSignInOf({ identities: [{ provider: "google" }] })).toEqual({ method: "google", new_account: false })
  })

  it("carries nothing but the method and whether the account is new", () => {
    const user = { created_at: "2026-11-10T10:00:00.000Z", last_sign_in_at: "2026-11-10T10:00:00.000Z", identities: [{ provider: "google", last_sign_in_at: "2026-11-10T10:00:00.000Z" }] }
    expect(Object.keys(providerSignInOf(user) ?? {}).sort()).toEqual(["method", "new_account"])
  })
})
