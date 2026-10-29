import { describe, expect, it } from "vitest"
import { PROVIDERS, accountOf, initialsOf, type AuthUser } from "./account"

const google: AuthUser = {
  id: "u-1",
  email: "ore@example.com",
  created_at: "2026-10-01T09:00:00.000Z",
  app_metadata: { provider: "google", providers: ["google"] },
  user_metadata: { full_name: "Oré Louvel", name: "Oré Louvel", avatar_url: "https://lh3.googleusercontent.com/a/ore", picture: "https://lh3.googleusercontent.com/a/ore" },
}

const discord: AuthUser = {
  id: "u-2",
  email: "ore@example.com",
  app_metadata: { provider: "discord" },
  user_metadata: {
    custom_claims: { global_name: "Oré" },
    full_name: "ore_louvel",
    user_name: "ore_louvel",
    avatar_url: "https://cdn.discordapp.com/avatars/1/abc.png",
  },
}

describe("the providers", () => {
  it("are Google and Discord", () => {
    expect([...PROVIDERS]).toEqual(["google", "discord"])
  })
})

describe("accountOf", () => {
  it("makes an account of a Google user: the name and the picture the provider gives", () => {
    expect(accountOf(google)).toEqual({
      id: "u-1",
      nickname: "Oré Louvel",
      email: "ore@example.com",
      avatarUrl: "https://lh3.googleusercontent.com/a/ore",
      provider: "google",
      createdAt: "2026-10-01T09:00:00.000Z",
    })
  })

  it("prefers the name a Discord user chose to their login", () => {
    const account = accountOf(discord)
    expect(account.nickname).toBe("Oré")
    expect(account.avatarUrl).toBe("https://cdn.discordapp.com/avatars/1/abc.png")
    expect(account.provider).toBe("discord")
  })

  it("falls back to the login of a Discord user who set no name", () => {
    expect(accountOf({ ...discord, user_metadata: { user_name: "ore_louvel" } }).nickname).toBe("ore_louvel")
  })

  it("falls back to the start of the e-mail, then to Player", () => {
    expect(accountOf({ id: "u-3", email: "marly@example.com" }).nickname).toBe("marly")
    expect(accountOf({ id: "u-4" }).nickname).toBe("Player")
    expect(accountOf({ id: "u-4", email: null }).nickname).toBe("Player")
  })

  it("takes the picture from `picture` when there is no `avatar_url`", () => {
    expect(accountOf({ id: "u-5", user_metadata: { picture: "https://example.com/p.png" } }).avatarUrl).toBe("https://example.com/p.png")
  })

  it("has no picture when the provider gives none", () => {
    expect(accountOf({ id: "u-6" }).avatarUrl).toBeNull()
  })

  it("reads a blank or a non-text claim as missing", () => {
    const account = accountOf({ id: "u-7", email: "  ", user_metadata: { full_name: "   ", name: 42, avatar_url: "" } })
    expect(account).toEqual({ id: "u-7", nickname: "Player", email: null, avatarUrl: null, provider: null, createdAt: null })
  })

  it("knows no provider that is not one of ours", () => {
    expect(accountOf({ id: "u-8", app_metadata: { provider: "email" } }).provider).toBeNull()
  })

  it("trims the text it takes", () => {
    expect(accountOf({ id: "u-9", user_metadata: { full_name: "  Oré  " } }).nickname).toBe("Oré")
  })
})

describe("initialsOf", () => {
  it("takes the first letter of up to two words, in upper case", () => {
    expect(initialsOf("Oré Louvel")).toBe("OL")
    expect(initialsOf("oré")).toBe("O")
    expect(initialsOf("Émile Zola Junior")).toBe("ÉZ")
  })

  it("keeps a letter whole when it is made of two code units", () => {
    expect(initialsOf("🎲 Dice")).toBe("🎲D")
  })

  it("draws a question mark for a name that has no letter", () => {
    expect(initialsOf("   ")).toBe("?")
    expect(initialsOf("")).toBe("?")
  })
})
