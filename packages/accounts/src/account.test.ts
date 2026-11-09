import { describe, expect, it } from "vitest"
import { EXTERNAL_PROVIDERS, PROVIDERS, SIGN_IN_PROVIDERS, accountOf, emailOf, initialsOf, type AuthUser } from "./account"

const google: AuthUser = {
  id: "u-1",
  email: "ore@example.com",
  created_at: "2026-10-01T09:00:00.000Z",
  app_metadata: { provider: "google", providers: ["google"] },
  user_metadata: { full_name: "Oré Louvel", name: "Oré Louvel", avatar_url: "https://lh3.googleusercontent.com/a/ore", picture: "https://lh3.googleusercontent.com/a/ore" },
}

// What Twitch's sign-in gives (`internal/api/provider/twitch.go` of supabase/auth): the login is `full_name` and `name`, the name shown on the channel is `nickname`, the picture is `avatar_url`
const twitch: AuthUser = {
  id: "u-11",
  email: "marly@example.com",
  app_metadata: { provider: "twitch" },
  user_metadata: {
    full_name: "marly_74",
    name: "marly_74",
    nickname: "Marly_74",
    avatar_url: "https://static-cdn.jtvnw.net/jtv_user_pictures/0a1b2c3d-profile_image-300x300.png",
    picture: "https://static-cdn.jtvnw.net/jtv_user_pictures/0a1b2c3d-profile_image-300x300.png",
  },
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
  it("are Google, Discord and Twitch, the ones of Supabase Auth that an account can have", () => {
    expect([...PROVIDERS]).toEqual(["google", "discord", "twitch"])
  })

  it("sign in with Google, Discord and Steam, in the order of the buttons: Twitch is only linked", () => {
    expect([...SIGN_IN_PROVIDERS]).toEqual(["google", "discord", "steam"])
    expect([...EXTERNAL_PROVIDERS]).toEqual(["steam"])
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
      language: null,
      preferences: { notifyTurn: true, notifyInvites: true, hideHistory: false, timeFormat: "auto", reduceMotion: "auto" },
      country: null,
      linked: [],
    })
  })

  it("makes an account of a Twitch user: the login for the name, the picture the provider gives", () => {
    const account = accountOf(twitch)
    expect(account.nickname).toBe("marly_74")
    expect(account.avatarUrl).toBe("https://static-cdn.jtvnw.net/jtv_user_pictures/0a1b2c3d-profile_image-300x300.png")
    expect(account.provider).toBe("twitch")
  })

  it("takes the start of the e-mail address for a name when the provider gives none", () => {
    const account = accountOf({ id: "u-12", email: "marly@example.com", app_metadata: { provider: "google" }, user_metadata: {} })
    expect(account.nickname).toBe("marly")
    expect(account.avatarUrl).toBeNull()
  })

  it("is called Player when nothing says otherwise", () => {
    expect(accountOf({ id: "u-13", app_metadata: {}, user_metadata: {} }).nickname).toBe("Player")
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
    expect(account).toEqual({
      id: "u-7",
      nickname: "Player",
      email: null,
      avatarUrl: null,
      provider: null,
      createdAt: null,
      language: null,
      preferences: { notifyTurn: true, notifyInvites: true, hideHistory: false, timeFormat: "auto", reduceMotion: "auto" },
      country: null,
      linked: [],
    })
  })

  it("knows no provider that is not one of ours", () => {
    expect(accountOf({ id: "u-8", app_metadata: { provider: "email" } }).provider).toBeNull()
  })

  it("trims the text it takes", () => {
    expect(accountOf({ id: "u-9", user_metadata: { full_name: "  Oré  " } }).nickname).toBe("Oré")
  })

  it("keeps the language the account keeps, next to what the provider says", () => {
    const account = accountOf({ ...google, user_metadata: { ...google.user_metadata, pbgo_locale: "ja" } })
    expect(account.language).toBe("ja")
    expect(account.nickname).toBe("Oré Louvel")
    expect(account.avatarUrl).toBe("https://lh3.googleusercontent.com/a/ore")
  })

  it("has no language for an account that chose none, and does not take the `locale` of a provider for one", () => {
    expect(accountOf(google).language).toBeNull()
    expect(accountOf({ ...google, user_metadata: { ...google.user_metadata, locale: "fr" } }).language).toBeNull()
    expect(accountOf({ ...google, user_metadata: { ...google.user_metadata, pbgo_locale: "klingon" } }).language).toBeNull()
  })
})

describe("the nickname a member chose (PLT-111)", () => {
  it("wins over the name of every provider, which a sign-in writes again each time", () => {
    for (const user of [google, twitch, discord]) expect(accountOf({ ...user, user_metadata: { ...user.user_metadata, pbgo_nickname: "Marly" } }).nickname).toBe("Marly")
  })

  it("wins over the start of the address too, and leaves the picture to the provider", () => {
    const account = accountOf({ ...google, user_metadata: { avatar_url: "https://example.com/a.png", pbgo_nickname: "Marly" } })
    expect(account.nickname).toBe("Marly")
    expect(account.avatarUrl).toBe("https://example.com/a.png")
  })

  it("is not read from the key a provider fills: `full_name` is the provider's", () => {
    expect(accountOf({ ...google, user_metadata: { full_name: "Marly" } }).nickname).toBe("Marly")
    expect(accountOf({ ...google, user_metadata: { full_name: "Provider", pbgo_nickname: "   " } }).nickname).toBe("Provider")
  })
})

describe("the preferences and the linked services of an account (PLT-111)", () => {
  it("keeps the preferences the member set", () => {
    const account = accountOf({ ...google, user_metadata: { ...google.user_metadata, pbgo_hide_history: true, pbgo_notify_turn: false } })
    expect(account.preferences).toEqual({ notifyTurn: false, notifyInvites: true, hideHistory: true, timeFormat: "auto", reduceMotion: "auto" })
  })

  it("keeps the choices of words as they set them: how the time is written and whether the motion is reduced", () => {
    const account = accountOf({ ...google, user_metadata: { ...google.user_metadata, pbgo_time_format: "12h", pbgo_reduce_motion: "always" } })
    expect(account.preferences).toMatchObject({ timeFormat: "12h", reduceMotion: "always" })
  })

  it("lists the ways into the account in the order Supabase Auth gives them, each with what it says of itself", () => {
    const account = accountOf({
      ...google,
      identities: [
        { provider: "email", identity_data: { email: "ore@example.com" } },
        { provider: "google", identity_data: { email: "ore@gmail.com", full_name: "Oré Louvel" } },
        { provider: "discord", identity_data: { full_name: "ore_louvel" } },
        { provider: "twitch", identity_data: null },
      ],
    })
    expect(account.linked).toEqual([
      { provider: "email", detail: "ore@example.com" },
      { provider: "google", detail: "ore@gmail.com" },
      { provider: "discord", detail: "ore_louvel" },
      { provider: "twitch", detail: null },
    ])
  })

  it("leaves out an identity of a provider that is not ours, and holds none for a user whose identities are not known", () => {
    expect(accountOf({ ...google, identities: [{ provider: "github", identity_data: { email: "ore@example.com" } }, { identity_data: {} }] }).linked).toEqual([])
    expect(accountOf(google).linked).toEqual([])
    expect(accountOf({ ...google, identities: null }).linked).toEqual([])
  })
})

describe("the country an account records (PLT-111)", () => {
  it("keeps what the member recorded, under its own key", () => {
    expect(accountOf({ ...google, user_metadata: { ...google.user_metadata, pbgo_country: "FR" } }).country).toBe("FR")
  })

  it("records none until the member does, and reads what is not a country as none", () => {
    expect(accountOf(google).country).toBeNull()
    expect(accountOf({ ...google, user_metadata: { pbgo_country: "ZZ" } }).country).toBeNull()
  })

  it("does not take the keys of a provider for it", () => {
    expect(accountOf({ ...google, user_metadata: { country: "FR", locale: "fr-FR" } }).country).toBeNull()
  })

  it("holds no date of birth, whatever the metadata says: the member can write their own metadata, and the date is kept where only the server reads it (PLT-125)", () => {
    const account = accountOf({ ...google, user_metadata: { ...google.user_metadata, pbgo_birthdate: "1990-01-01", birthdate: "1990-01-01" } })
    expect(account).not.toHaveProperty("birthdate")
    expect(JSON.stringify(account)).not.toContain("1990-01-01")
  })
})

describe("emailOf", () => {
  it("reads an address, with the blanks around it taken off", () => {
    expect(emailOf("ore@example.com")).toBe("ore@example.com")
    expect(emailOf("  ore@example.com ")).toBe("ore@example.com")
  })

  it("is null for a username, which Supabase Auth cannot look up", () => {
    expect(emailOf("ore")).toBeNull()
    expect(emailOf("Oré#4821")).toBeNull()
    expect(emailOf("")).toBeNull()
  })

  it("is null for half an address", () => {
    expect(emailOf("ore@")).toBeNull()
    expect(emailOf("@example.com")).toBeNull()
    expect(emailOf("ore@example")).toBeNull()
    expect(emailOf("o re@example.com")).toBeNull()
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

describe("accountOf, an account the hub made for an external provider", () => {
  const standIn = "steam-0f8fad5b-d9cb-469f-a165-70867728950e@external.pbgo.invalid"
  /** As Supabase Auth keeps it after the first sign-in: it has rewritten `provider` and `providers` from the identities of the user, the stand-in address only. */
  const steamMember: AuthUser = {
    id: "u-9",
    email: standIn,
    app_metadata: { provider: "email", providers: ["email"], pbgo_origin: "steam", external: { steam: { subject: "76561198000000000", name: "Marly" } } },
    user_metadata: { full_name: "Marly", avatar_url: "https://avatars.steamstatic.com/abc_full.jpg" },
    identities: [{ provider: "email", identity_data: { email: standIn } }],
  }

  it("is Steam's, with no address, though Supabase Auth says it is an e-mail account", () => {
    expect(accountOf(steamMember)).toMatchObject({ nickname: "Marly", email: null, provider: "steam", avatarUrl: "https://avatars.steamstatic.com/abc_full.jpg" })
    expect(accountOf(steamMember).linked).toEqual([{ provider: "steam", detail: "Marly" }])
  })

  it("takes the way in from a key of ours and from nothing else: Supabase Auth's `provider` never makes an account an external one", () => {
    expect(accountOf({ ...steamMember, app_metadata: { provider: "steam", providers: ["steam"] } }).provider).toBeNull()
    expect(accountOf({ ...steamMember, app_metadata: { ...steamMember.app_metadata, pbgo_origin: "myspace" } }).provider).toBeNull()
    expect(accountOf({ id: "u-2", email: "marly@example.com", app_metadata: { provider: "email", providers: ["email"] } }).provider).toBeNull()
  })
})
