import { describe, expect, it } from "vitest"
import { EXTERNAL_EMAIL_DOMAIN, accountOf, externalOriginOf, isExternalEmail } from "./account"
import { externalEmail, externalLink, externalSignIn, externalUnlink, type AdminUser, type ExternalAdmin, type ExternalIdentity, type ExternalStore } from "./external"

const steam = (overrides: Partial<ExternalIdentity> = {}): ExternalIdentity => ({
  provider: "steam",
  subject: "76561198000000000",
  profile: { name: "Marly", avatarUrl: "https://avatars.steamstatic.com/abc_full.jpg" },
  ...overrides,
})

/** What Supabase Auth leaves in `app_metadata` of a member the hub made, once their first sign-in has spent a one-time token: it reads the member's identities (the stand-in address only) and rewrites `provider` and `providers` as `email`. */
const GOTRUE = { provider: "email", providers: ["email"] }

type StoredUser = AdminUser & { user_metadata: Record<string, unknown> }

/** Supabase Auth and the table of identities, in memory, with the failures a test asks for. */
function world(options: { failing?: Partial<Record<"createUser" | "getUserById" | "updateUserById" | "deleteUser" | "generateLink" | "userOf" | "add" | "remove", true>>; raceWinner?: string } = {}) {
  const users = new Map<string, StoredUser>()
  const rows = new Map<string, string>()
  const calls: string[] = []
  let made = 0
  const fails = (name: keyof NonNullable<typeof options.failing>) => options.failing?.[name] === true

  const admin: ExternalAdmin = {
    async createUser(attributes) {
      calls.push("createUser")
      if (fails("createUser")) return { data: { user: null }, error: { message: "refused" } }
      // The sign-in that follows rewrites `provider` and `providers` (`GOTRUE`): the member is stored as they will be read
      const user: StoredUser = { id: `user-${++made}`, email: attributes.email, app_metadata: { ...attributes.app_metadata, ...GOTRUE }, user_metadata: attributes.user_metadata }
      users.set(user.id, user)
      return { data: { user }, error: null }
    },
    async getUserById(id) {
      calls.push("getUserById")
      if (fails("getUserById")) return { data: { user: null }, error: { message: "down" } }
      return { data: { user: users.get(id) ?? null }, error: null }
    },
    async updateUserById(id, attributes) {
      calls.push("updateUserById")
      if (fails("updateUserById")) return { data: null, error: { message: "down" } }
      const user = users.get(id)!
      // Supabase merges the keys of what it is given into the metadata, replaces what is under a key, and deletes a key that is given as null
      const merged = (kept: Record<string, unknown> | undefined, given: Record<string, unknown>) =>
        Object.fromEntries(Object.entries({ ...kept, ...given }).filter(([, value]) => value !== null))
      if (attributes.user_metadata) user.user_metadata = merged(user.user_metadata, attributes.user_metadata)
      if (attributes.app_metadata) user.app_metadata = merged(user.app_metadata, attributes.app_metadata)
      return { data: null, error: null }
    },
    async deleteUser(id) {
      calls.push("deleteUser")
      if (fails("deleteUser")) return { data: null, error: { message: "down" } }
      users.delete(id)
      return { data: null, error: null }
    },
    async generateLink(email) {
      calls.push("generateLink")
      if (fails("generateLink")) return { data: { hashedToken: null }, error: { message: "down" } }
      return { data: { hashedToken: [...users.values()].some((user) => user.email === email) ? `hash-of-${email}` : null }, error: null }
    },
  }

  const store: ExternalStore = {
    async userOf(provider, subject) {
      calls.push("userOf")
      if (fails("userOf")) throw new Error("database down")
      return rows.get(`${provider}:${subject}`) ?? null
    },
    async add(provider, subject, userId) {
      calls.push("add")
      if (fails("add")) throw new Error("database down")
      const key = `${provider}:${subject}`
      if (options.raceWinner && !rows.has(key)) {
        // someone else's sign-in for the same account lands first
        users.set(options.raceWinner, { id: options.raceWinner, email: `steam-winner@${EXTERNAL_EMAIL_DOMAIN}`, app_metadata: { ...GOTRUE, pbgo_origin: provider, external: {} }, user_metadata: {} })
        rows.set(key, options.raceWinner)
      }
      if (rows.has(key)) return "taken"
      // The table has one account of a provider at most for each member
      if ([...rows].some(([held, holder]) => held.startsWith(`${provider}:`) && holder === userId)) return "taken"
      rows.set(key, userId)
      return "added"
    },
    async remove(provider, userId) {
      calls.push("remove")
      if (fails("remove")) throw new Error("database down")
      for (const [key, holder] of [...rows]) if (key.startsWith(`${provider}:`) && holder === userId) rows.delete(key)
    },
  }

  return { admin, store, users, rows, calls, deps: { admin, store, randomId: () => "0f8fad5b-d9cb-469f-a165-70867728950e" } }
}

describe("externalEmail", () => {
  it("is the provider, an identifier, and a domain that can never receive mail", () => {
    expect(externalEmail("steam", "abc")).toBe("steam-abc@external.pbgo.invalid")
    expect(isExternalEmail(externalEmail("steam", "abc"))).toBe(true)
    expect(EXTERNAL_EMAIL_DOMAIN.endsWith(".invalid")).toBe(true)
  })

  it("is not mistaken for another address", () => {
    for (const email of ["marly@example.com", "marly@external.pbgo.invalid.example.com", "external.pbgo.invalid", "", null, undefined]) expect(isExternalEmail(email), String(email)).toBe(false)
    expect(isExternalEmail(" STEAM-ABC@EXTERNAL.PBGO.INVALID ")).toBe(true)
  })
})

describe("a new identity", () => {
  it("makes a member with an address of no one's, the name and the picture, and the provider as the way they came", async () => {
    const w = world()
    const result = await externalSignIn(steam(), w.deps)

    expect(result).toEqual({ ok: true, userId: "user-1", tokenHash: `hash-of-steam-0f8fad5b-d9cb-469f-a165-70867728950e@${EXTERNAL_EMAIL_DOMAIN}`, created: true })
    expect(w.users.get("user-1")).toEqual({
      id: "user-1",
      email: `steam-0f8fad5b-d9cb-469f-a165-70867728950e@${EXTERNAL_EMAIL_DOMAIN}`,
      app_metadata: { ...GOTRUE, pbgo_origin: "steam", external: { steam: { subject: "76561198000000000", name: "Marly" } } },
      user_metadata: { full_name: "Marly", avatar_url: "https://avatars.steamstatic.com/abc_full.jpg" },
    })
    expect(w.rows.get("steam:76561198000000000")).toBe("user-1")
    expect(w.calls).toEqual(["userOf", "createUser", "add", "generateLink"])
  })

  it("is the account of the visitor as the hub shows it: a name and a picture, no address, Steam as the way in and as the only way, whatever Supabase Auth made of `provider`", async () => {
    const w = world()
    await externalSignIn(steam(), w.deps)
    const member = w.users.get("user-1")!
    expect(member.app_metadata?.provider).toBe("email")

    const account = accountOf({ ...member, identities: [{ provider: "email", identity_data: { email: member.email } }] })

    expect(account).toMatchObject({ nickname: "Marly", email: null, avatarUrl: "https://avatars.steamstatic.com/abc_full.jpg", provider: "steam" })
    expect(account.linked).toEqual([{ provider: "steam", detail: "Marly" }])
  })

  it("has no picture key when the profile has none: there is nothing to delete later", async () => {
    const w = world()
    await externalSignIn(steam({ profile: { name: "Marly", avatarUrl: null } }), w.deps)
    expect(w.users.get("user-1")?.user_metadata).toEqual({ full_name: "Marly" })
  })

  it("gets the provider's fallback name when the profile could not be read, with no picture", async () => {
    const w = world()
    await externalSignIn(steam({ profile: null }), w.deps)
    expect(w.users.get("user-1")?.user_metadata).toEqual({ full_name: "Steam player" })
    expect(w.users.get("user-1")?.app_metadata?.external).toEqual({ steam: { subject: "76561198000000000", name: "Steam player" } })
  })

  it("ends with one member when two sign-ins for the same account happen at once: the quicker one's, and the other's is deleted", async () => {
    const w = world({ raceWinner: "user-winner" })
    const result = await externalSignIn(steam(), w.deps)

    expect(result).toEqual({ ok: true, userId: "user-winner", tokenHash: `hash-of-steam-winner@${EXTERNAL_EMAIL_DOMAIN}`, created: false })
    expect(w.users.has("user-1")).toBe(false)
    expect(w.rows.get("steam:76561198000000000")).toBe("user-winner")
    expect(w.calls).toEqual(["userOf", "createUser", "add", "deleteUser", "userOf", "getUserById", "updateUserById", "generateLink"])
  })
})

describe("an identity that holds a member already", () => {
  /** A member as Supabase Auth keeps them after their first sign-in: `app` is what the hub wrote (`pbgo_origin`, `external`), or what another provider made, on top of what Supabase Auth rewrites. */
  async function returning(app: Record<string, unknown>, user: Record<string, unknown> = {}) {
    const w = world()
    const own = app.pbgo_origin === "steam"
    w.users.set("user-9", { id: "user-9", email: own ? `steam-old@${EXTERNAL_EMAIL_DOMAIN}` : "marly@example.com", app_metadata: app, user_metadata: user })
    w.rows.set("steam:76561198000000000", "user-9")
    return w
  }
  const madeWithSteam = (name = "Old name") => ({ ...GOTRUE, pbgo_origin: "steam", external: { steam: { subject: "76561198000000000", name } } })

  it("signs the same member in, and makes no one", async () => {
    const w = await returning(madeWithSteam())
    const result = await externalSignIn(steam(), w.deps)

    expect(result).toEqual({ ok: true, userId: "user-9", tokenHash: `hash-of-steam-old@${EXTERNAL_EMAIL_DOMAIN}`, created: false })
    expect(w.calls).toEqual(["userOf", "getUserById", "updateUserById", "generateLink"])
    expect(w.users.size).toBe(1)
  })

  it("refreshes the name and the picture of an account that was made with Steam, even though Supabase Auth reads it as an e-mail one, and keeps the member's own keys", async () => {
    const w = await returning(madeWithSteam(), { full_name: "Old name", avatar_url: null, pbgo_nickname: "Marly the Brave", pbgo_language: "fr" })
    await externalSignIn(steam(), w.deps)

    expect(w.users.get("user-9")?.user_metadata).toEqual({ full_name: "Marly", avatar_url: "https://avatars.steamstatic.com/abc_full.jpg", pbgo_nickname: "Marly the Brave", pbgo_language: "fr" })
    expect(w.users.get("user-9")?.app_metadata).toEqual(madeWithSteam("Marly"))
  })

  it("leaves the name and the picture of an account made with another provider alone, and only says what Steam calls them", async () => {
    const w = await returning({ provider: "google", external: { steam: { subject: "76561198000000000", name: "Old name" } } }, { full_name: "Marly Louvel", avatar_url: "https://lh3.googleusercontent.com/a" })
    const result = await externalSignIn(steam(), w.deps)

    expect(result).toEqual({ ok: true, userId: "user-9", tokenHash: "hash-of-marly@example.com", created: false })
    expect(w.users.get("user-9")?.user_metadata).toEqual({ full_name: "Marly Louvel", avatar_url: "https://lh3.googleusercontent.com/a" })
    expect(w.users.get("user-9")?.app_metadata).toEqual({ provider: "google", external: { steam: { subject: "76561198000000000", name: "Marly" } } })
  })

  it("keeps the accounts of the other external providers the member has", async () => {
    const w = await returning({ ...GOTRUE, pbgo_origin: "steam", external: { steam: { subject: "76561198000000000", name: "Old name" }, epic: { subject: "abc", name: "EpicMarly" } } })
    await externalSignIn(steam(), w.deps)
    expect(w.users.get("user-9")?.app_metadata?.external).toEqual({ steam: { subject: "76561198000000000", name: "Marly" }, epic: { subject: "abc", name: "EpicMarly" } })
  })

  it("writes nothing over the member when the profile could not be read: a failed call is not a profile", async () => {
    const w = await returning(madeWithSteam("Marly"), { full_name: "Marly", avatar_url: "https://avatars.steamstatic.com/abc_full.jpg" })
    const result = await externalSignIn(steam({ profile: null }), w.deps)

    expect(result).toMatchObject({ ok: true, userId: "user-9", created: false })
    expect(w.calls).toEqual(["userOf", "getUserById", "generateLink"])
    expect(w.users.get("user-9")?.user_metadata).toEqual({ full_name: "Marly", avatar_url: "https://avatars.steamstatic.com/abc_full.jpg" })
    expect(w.users.get("user-9")?.app_metadata).toEqual(madeWithSteam("Marly"))
  })

  it("never takes a picture away: a profile with none leaves the one the member has, since Supabase Auth deletes a key set to null", async () => {
    const w = await returning(madeWithSteam(), { full_name: "Old name", avatar_url: "https://avatars.steamstatic.com/old_full.jpg" })
    await externalSignIn(steam({ profile: { name: "Marly", avatarUrl: null } }), w.deps)

    expect(w.users.get("user-9")?.user_metadata).toEqual({ full_name: "Marly", avatar_url: "https://avatars.steamstatic.com/old_full.jpg" })
  })
})

describe("when anything fails", () => {
  const cases: [string, Parameters<typeof world>[0], string][] = [
    ["the table cannot be read", { failing: { userOf: true } }, "lookup"],
    ["the member cannot be made", { failing: { createUser: true } }, "create"],
    ["the table cannot be written", { failing: { add: true } }, "record"],
    ["the token cannot be made", { failing: { generateLink: true } }, "token"],
  ]

  it.each(cases)("says the step it failed at when %s", async (_name, options, step) => {
    expect(await externalSignIn(steam(), world(options).deps)).toEqual({ ok: false, step })
  })

  it("says so when the member of the table cannot be read or updated, or is gone", async () => {
    for (const [failing, step] of [[{ getUserById: true }, "read"], [{ updateUserById: true }, "update"]] as const) {
      const w = world({ failing })
      w.users.set("user-9", { id: "user-9", email: `steam-old@${EXTERNAL_EMAIL_DOMAIN}`, app_metadata: { ...GOTRUE, pbgo_origin: "steam" }, user_metadata: {} })
      w.rows.set("steam:76561198000000000", "user-9")
      expect(await externalSignIn(steam(), w.deps), JSON.stringify(failing)).toEqual({ ok: false, step })
    }
    const gone = world()
    gone.rows.set("steam:76561198000000000", "user-gone")
    expect(await externalSignIn(steam(), gone.deps)).toEqual({ ok: false, step: "read" })
  })

  it("fails for a member with no address, which no token can be made for", async () => {
    const w = world()
    w.users.set("user-9", { id: "user-9", email: null, app_metadata: { ...GOTRUE, pbgo_origin: "steam" }, user_metadata: {} })
    w.rows.set("steam:76561198000000000", "user-9")
    expect(await externalSignIn(steam(), w.deps)).toEqual({ ok: false, step: "address" })
  })

  it("fails, and leaves no one behind, when the table is lost between the two sign-ins", async () => {
    const w = world()
    const store: ExternalStore = { userOf: async () => null, add: async () => "taken", remove: async () => {} }
    expect(await externalSignIn(steam(), { ...w.deps, store })).toEqual({ ok: false, step: "record" })
    expect(w.calls).toContain("deleteUser")
    expect(w.users.size).toBe(0)
  })

  it("deletes the member it has just made when the table cannot be written: nobody holds them, and the members are counted on the home", async () => {
    const w = world({ failing: { add: true } })
    expect(await externalSignIn(steam(), w.deps)).toEqual({ ok: false, step: "record" })
    expect(w.calls).toEqual(["userOf", "createUser", "add", "deleteUser"])
    expect(w.users.size).toBe(0)
  })

  it("does not let a delete that fails hide why the table could not be written", async () => {
    const w = world({ failing: { add: true } })
    w.admin.deleteUser = async () => {
      throw new Error("network")
    }
    expect(await externalSignIn(steam(), w.deps)).toEqual({ ok: false, step: "record" })
  })

  it("signs in as the winner of a race even when the loser cannot be deleted", async () => {
    const w = world({ raceWinner: "user-winner" })
    w.admin.deleteUser = async () => {
      throw new Error("network")
    }
    expect(await externalSignIn(steam(), w.deps)).toMatchObject({ ok: true, userId: "user-winner", created: false })
  })
})

// Linking an account to a member who is signed in, and taking it off (the settings: docs/accounts.md)
const STEAM_ID = "76561198000000000"

/** A member who came with Google, as Supabase Auth holds them: their own name and picture, one identity, and nothing of Steam unless `app` says so. */
function googleMember(w: ReturnType<typeof world>, app: Record<string, unknown> = {}) {
  w.users.set("user-g", {
    id: "user-g",
    email: "marly@example.com",
    app_metadata: { provider: "google", ...app },
    user_metadata: { full_name: "Marly Louvel", avatar_url: "https://lh3.googleusercontent.com/a" },
    identities: [{ provider: "google", identity_data: { email: "marly@example.com", full_name: "Marly Louvel" } }],
  })
}

describe("externalLink", () => {
  it("links the account to the member and writes only what Steam calls them: the member keeps their own name and picture", async () => {
    const w = world()
    googleMember(w)
    const result = await externalLink(steam(), "user-g", w.deps)

    expect(result).toEqual({ ok: true, already: false })
    expect(w.rows.get(`steam:${STEAM_ID}`)).toBe("user-g")
    expect(w.users.get("user-g")?.app_metadata).toEqual({ provider: "google", external: { steam: { subject: STEAM_ID, name: "Marly" } } })
    expect(w.users.get("user-g")?.user_metadata).toEqual({ full_name: "Marly Louvel", avatar_url: "https://lh3.googleusercontent.com/a" })
    expect(w.calls).toEqual(["userOf", "getUserById", "add", "updateUserById"])
  })

  it("shows in the account as a linked service with Steam's name, and a sign-in with that account then opens the same member, not a new one", async () => {
    const w = world()
    googleMember(w)
    await externalLink(steam(), "user-g", w.deps)

    const member = w.users.get("user-g")!
    expect(accountOf(member).linked).toEqual([
      { provider: "google", detail: "marly@example.com" },
      { provider: "steam", detail: "Marly" },
    ])
    const signedIn = await externalSignIn(steam(), w.deps)
    expect(signedIn).toMatchObject({ ok: true, userId: "user-g", created: false })
    expect(w.users.size).toBe(1)
  })

  it("refuses an account that another member holds, and takes nothing from them", async () => {
    const w = world()
    googleMember(w)
    w.rows.set(`steam:${STEAM_ID}`, "user-other")
    const result = await externalLink(steam(), "user-g", w.deps)

    expect(result).toEqual({ ok: false, reason: "taken" })
    expect(w.rows.get(`steam:${STEAM_ID}`)).toBe("user-other")
    expect(w.users.get("user-g")?.app_metadata).toEqual({ provider: "google" })
    expect(w.calls).toEqual(["userOf"])
  })

  it("refuses a second Steam account for a member who has one, and leaves the first as it is", async () => {
    const w = world()
    googleMember(w, { external: { steam: { subject: "76561198000000001", name: "First" } } })
    w.rows.set("steam:76561198000000001", "user-g")
    const result = await externalLink(steam(), "user-g", w.deps)

    expect(result).toEqual({ ok: false, reason: "has-another" })
    expect(w.rows.get("steam:76561198000000001")).toBe("user-g")
    expect(w.rows.has(`steam:${STEAM_ID}`)).toBe(false)
  })

  it("is refused when the table holds another account for the member that the metadata does not say: the table has one at most, and it decides", async () => {
    const w = world()
    googleMember(w)
    w.rows.set("steam:76561198000000001", "user-g")
    expect(await externalLink(steam(), "user-g", w.deps)).toEqual({ ok: false, reason: "taken" })
    expect(w.users.get("user-g")?.app_metadata).toEqual({ provider: "google" })
  })

  it("is done again without harm when the member holds the account already, and refreshes the name Steam gives it", async () => {
    const w = world()
    googleMember(w, { external: { steam: { subject: STEAM_ID, name: "Old name" } } })
    w.rows.set(`steam:${STEAM_ID}`, "user-g")
    const result = await externalLink(steam(), "user-g", w.deps)

    expect(result).toEqual({ ok: true, already: true })
    expect(w.users.get("user-g")?.app_metadata?.external).toEqual({ steam: { subject: STEAM_ID, name: "Marly" } })
    expect(w.calls).toEqual(["userOf", "getUserById", "updateUserById"])
  })

  it("finishes a link that wrote the table and not the metadata: the same link made again writes the metadata", async () => {
    const broken = world({ failing: { updateUserById: true } })
    googleMember(broken)
    expect(await externalLink(steam(), "user-g", broken.deps)).toEqual({ ok: false, reason: "failed", step: "update" })
    expect(broken.rows.get(`steam:${STEAM_ID}`)).toBe("user-g")

    const again = world()
    googleMember(again)
    again.rows.set(`steam:${STEAM_ID}`, "user-g")
    expect(await externalLink(steam(), "user-g", again.deps)).toEqual({ ok: true, already: true })
    expect(again.users.get("user-g")?.app_metadata?.external).toEqual({ steam: { subject: STEAM_ID, name: "Marly" } })
  })

  it("keeps the name on record when the profile could not be read, and gives the fallback only to a member who has none", async () => {
    const known = world()
    googleMember(known, { external: { steam: { subject: STEAM_ID, name: "Marly" } } })
    known.rows.set(`steam:${STEAM_ID}`, "user-g")
    await externalLink(steam({ profile: null }), "user-g", known.deps)
    expect(known.users.get("user-g")?.app_metadata?.external).toEqual({ steam: { subject: STEAM_ID, name: "Marly" } })

    const fresh = world()
    googleMember(fresh)
    await externalLink(steam({ profile: null }), "user-g", fresh.deps)
    expect(fresh.users.get("user-g")?.app_metadata?.external).toEqual({ steam: { subject: STEAM_ID, name: "Steam player" } })
  })

  it("keeps the other external accounts the member has", async () => {
    const w = world()
    googleMember(w, { external: { epic: { subject: "abc", name: "EpicMarly" } } })
    await externalLink(steam(), "user-g", w.deps)
    expect(w.users.get("user-g")?.app_metadata?.external).toEqual({ epic: { subject: "abc", name: "EpicMarly" }, steam: { subject: STEAM_ID, name: "Marly" } })
  })

  it.each([
    ["userOf", "lookup"],
    ["getUserById", "read"],
    ["add", "record"],
    ["updateUserById", "update"],
  ] as const)("says the step it failed at when %s does, and never throws", async (failing, step) => {
    const w = world({ failing: { [failing]: true } })
    googleMember(w)
    expect(await externalLink(steam(), "user-g", w.deps)).toEqual({ ok: false, reason: "failed", step })
  })
})

describe("externalUnlink", () => {
  const withSteam = { external: { steam: { subject: STEAM_ID, name: "Marly" } } }

  it("takes Steam off a member who keeps another way in, and nothing else", async () => {
    const w = world()
    googleMember(w, withSteam)
    w.rows.set(`steam:${STEAM_ID}`, "user-g")
    const result = await externalUnlink("steam", "user-g", w.deps)

    expect(result).toEqual({ ok: true })
    expect(w.rows.size).toBe(0)
    expect(w.users.get("user-g")?.app_metadata).toEqual({ provider: "google", external: {} })
    expect(w.users.get("user-g")?.user_metadata).toEqual({ full_name: "Marly Louvel", avatar_url: "https://lh3.googleusercontent.com/a" })
    expect(w.calls).toEqual(["getUserById", "remove", "updateUserById"])
  })

  it("refuses the last way in: a member who came with Steam and has nothing else keeps it", async () => {
    const w = world()
    await externalSignIn(steam(), w.deps)
    const member = w.users.get("user-1")!
    // Supabase Auth holds the identity of the stand-in address only, which is no way in
    member.identities = [{ provider: "email", identity_data: { email: member.email } }]
    const result = await externalUnlink("steam", "user-1", w.deps)

    expect(result).toEqual({ ok: false, reason: "last-way-in" })
    expect(w.rows.get(`steam:${STEAM_ID}`)).toBe("user-1")
    expect(w.calls).not.toContain("remove")
  })

  it("lets a member who came with Steam and linked Google unlink Steam, and forgets that they came with it", async () => {
    const w = world()
    await externalSignIn(steam(), w.deps)
    const member = w.users.get("user-1")!
    member.identities = [
      { provider: "email", identity_data: { email: member.email } },
      { provider: "google", identity_data: { email: "marly@example.com" } },
    ]
    expect(externalOriginOf(member.app_metadata)).toBe("steam")

    expect(await externalUnlink("steam", "user-1", w.deps)).toEqual({ ok: true })
    const after = w.users.get("user-1")!
    expect(externalOriginOf(after.app_metadata)).toBeNull()
    expect(after.app_metadata).not.toHaveProperty("pbgo_origin")
    expect(after.app_metadata?.external).toEqual({})
    expect(w.rows.size).toBe(0)
  })

  it("does not count a connection as a way in: with Twitch linked and nothing else, Steam is still the last way", async () => {
    const w = world()
    await externalSignIn(steam(), w.deps)
    const member = w.users.get("user-1")!
    member.identities = [
      { provider: "email", identity_data: { email: member.email } },
      { provider: "twitch", identity_data: { full_name: "marly_74" } },
    ]
    expect(await externalUnlink("steam", "user-1", w.deps)).toEqual({ ok: false, reason: "last-way-in" })
  })

  it("keeps the other external accounts of the member", async () => {
    const w = world()
    googleMember(w, { external: { steam: { subject: STEAM_ID, name: "Marly" }, epic: { subject: "abc", name: "EpicMarly" } } })
    w.rows.set(`steam:${STEAM_ID}`, "user-g")
    await externalUnlink("steam", "user-g", w.deps)
    expect(w.users.get("user-g")?.app_metadata?.external).toEqual({ epic: { subject: "abc", name: "EpicMarly" } })
  })

  it("changes nothing in the table and says done when the account is not linked", async () => {
    const w = world()
    googleMember(w)
    expect(await externalUnlink("steam", "user-g", w.deps)).toEqual({ ok: true })
    expect(w.rows.size).toBe(0)
  })

  it.each([
    ["getUserById", "read"],
    ["remove", "remove"],
    ["updateUserById", "update"],
  ] as const)("says the step it failed at when %s does, and never throws", async (failing, step) => {
    const w = world({ failing: { [failing]: true } })
    googleMember(w, withSteam)
    w.rows.set(`steam:${STEAM_ID}`, "user-g")
    expect(await externalUnlink("steam", "user-g", w.deps)).toEqual({ ok: false, reason: "failed", step })
  })
})
