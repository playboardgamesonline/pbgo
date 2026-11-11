import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ select: vi.fn(), inFilter: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn(), from: vi.fn(), rpc: vi.fn() }))

vi.mock("server-only", () => ({}))
vi.mock("./supabase", () => ({ supabaseAdmin: () => ({ from: mocks.from, rpc: mocks.rpc }) }))

import { ensureProfile, handleOf, pictureUrl, profilesNotApplied, readProfile, readProfileByHandle, readProfileDetails, readProfiles, saveProfile } from "./profiles"

const ANN = "0b9f6a52-8c0e-4d6e-9d53-4a1d2f6a7c11"
const BOB = "5c3e1d8a-1f2b-4c47-8a9e-6d0b7e2f4a90"

const row = (over: Record<string, unknown> = {}) => ({ user_id: ANN, nickname: "Ann", tag: 42, avatar_url: "https://cdn.example/ann.png", hide_history: false, created_at: "2026-10-01T09:00:00+00:00", ...over })

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset()
  mocks.from.mockReturnValue({ select: mocks.select })
  mocks.select.mockReturnValue({ in: mocks.inFilter, eq: mocks.eq })
  mocks.eq.mockReturnValue({ maybeSingle: mocks.maybeSingle })
})

describe("readProfileByHandle", () => {
  it("asks the database for the nickname and the tag, which compares them whatever the case", async () => {
    mocks.rpc.mockResolvedValue({ data: [row()], error: null })
    expect(await readProfileByHandle({ nickname: "ann", tag: 42 })).toEqual({
      userId: ANN,
      nickname: "Ann",
      tag: 42,
      avatarUrl: "https://cdn.example/ann.png",
      hideHistory: false,
      createdAt: "2026-10-01T09:00:00+00:00",
      details: { pronouns: null, country: null, favoriteGames: [], bio: null },
    })
    expect(mocks.rpc).toHaveBeenCalledWith("profile_by_handle", { p_nickname: "ann", p_tag: 42 })
  })

  it("says what the member says of themselves, as the lookup gives it", async () => {
    mocks.rpc.mockResolvedValue({ data: [row({ pronouns: "she/her", country: "FR", favorite_games: ["courtisans", "flip-7"], bio: "I play late.\nCome and join!" })], error: null })
    expect((await readProfileByHandle({ nickname: "Ann", tag: 42 }))?.details).toEqual({ pronouns: "she/her", country: "FR", favoriteGames: ["courtisans", "flip-7"], bio: "I play late.\nCome and join!" })
  })

  it("draws nothing it does not hold: a pronoun off the list, a country that is no country, a bio that is too long", async () => {
    mocks.rpc.mockResolvedValue({ data: [row({ pronouns: "xe/xem", country: "ZZ", favorite_games: ["Not A Slug"], bio: "b".repeat(201) })], error: null })
    expect((await readProfileByHandle({ nickname: "Ann", tag: 42 }))?.details).toEqual({ pronouns: null, country: null, favoriteGames: [], bio: null })
  })

  it("answers with no details from a database that has the lookup of 0015 and not the fields of 0018 yet", async () => {
    mocks.rpc.mockResolvedValue({ data: [row()], error: null })
    expect((await readProfileByHandle({ nickname: "Ann", tag: 42 }))?.details).toEqual({ pronouns: null, country: null, favoriteGames: [], bio: null })
  })

  it("is null when nobody goes by it", async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null })
    expect(await readProfileByHandle({ nickname: "Nobody", tag: 1 })).toBeNull()
    mocks.rpc.mockResolvedValue({ data: null, error: null })
    expect(await readProfileByHandle({ nickname: "Nobody", tag: 1 })).toBeNull()
  })

  it("has nobody where the profiles are not there yet, and throws the rest", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "PGRST202", message: "Could not find the function" } })
    expect(await readProfileByHandle({ nickname: "Ann", tag: 42 })).toBeNull()
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "42883", message: "function does not exist" } })
    expect(await readProfileByHandle({ nickname: "Ann", tag: 42 })).toBeNull()
    const error = { code: "57014", message: "canceling statement due to statement timeout" }
    mocks.rpc.mockResolvedValue({ data: null, error })
    await expect(readProfileByHandle({ nickname: "Ann", tag: 42 })).rejects.toBe(error)
  })

  it("does not draw what the database does not hold: a tag out of range, no nickname", async () => {
    for (const bad of [row({ tag: 0 }), row({ tag: 10000 }), row({ tag: "x" }), row({ nickname: "" }), row({ nickname: null })]) {
      mocks.rpc.mockResolvedValue({ data: [bad], error: null })
      expect(await readProfileByHandle({ nickname: "Ann", tag: 42 })).toBeNull()
    }
  })
})

describe("readProfiles", () => {
  it("reads these accounts in one request, by account", async () => {
    mocks.inFilter.mockResolvedValue({ data: [row(), row({ user_id: BOB, nickname: "Bob", tag: 7, avatar_url: null, hide_history: true })], error: null })
    const found = await readProfiles([ANN, BOB])
    expect(mocks.from).toHaveBeenCalledWith("profiles")
    expect(mocks.select).toHaveBeenCalledWith("user_id, nickname, tag, avatar_url, hide_history, created_at")
    expect(mocks.inFilter).toHaveBeenCalledWith("user_id", [ANN, BOB])
    expect(found.get(ANN)).toMatchObject({ nickname: "Ann", tag: 42, hideHistory: false })
    expect(found.get(BOB)).toMatchObject({ nickname: "Bob", tag: 7, avatarUrl: null, hideHistory: true })
  })

  it("asks once for an account that is listed twice, and not at all for what is not an account (the demo account) or for nobody", async () => {
    mocks.inFilter.mockResolvedValue({ data: [], error: null })
    await readProfiles([ANN, ANN, "demo", BOB, ANN])
    expect(mocks.inFilter).toHaveBeenCalledWith("user_id", [ANN, BOB])
    mocks.from.mockClear()
    expect((await readProfiles(["demo"])).size).toBe(0)
    expect((await readProfiles([])).size).toBe(0)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it("leaves out an account that has no profile", async () => {
    mocks.inFilter.mockResolvedValue({ data: [row()], error: null })
    expect((await readProfiles([ANN, BOB])).has(BOB)).toBe(false)
  })

  it("keeps only a picture that is an https address", async () => {
    mocks.inFilter.mockResolvedValue({ data: [row({ avatar_url: "http://cdn.example/a.png" })], error: null })
    expect((await readProfiles([ANN])).get(ANN)?.avatarUrl).toBeNull()
  })

  it("finds nobody where the profiles are not there yet, and throws the rest", async () => {
    mocks.inFilter.mockResolvedValue({ data: null, error: { code: "PGRST205", message: "Could not find the table 'public.profiles' in the schema cache" } })
    expect((await readProfiles([ANN])).size).toBe(0)
    mocks.inFilter.mockResolvedValue({ data: null, error: { code: "42P01", message: 'relation "public.profiles" does not exist' } })
    expect((await readProfiles([ANN])).size).toBe(0)
    const error = { code: "XX000", message: "boom" }
    mocks.inFilter.mockResolvedValue({ data: null, error })
    await expect(readProfiles([ANN])).rejects.toBe(error)
  })
})

describe("readProfile", () => {
  it("is the profile of one account, or null", async () => {
    mocks.inFilter.mockResolvedValue({ data: [row()], error: null })
    expect((await readProfile(ANN))?.nickname).toBe("Ann")
    mocks.inFilter.mockResolvedValue({ data: [], error: null })
    expect(await readProfile(ANN)).toBeNull()
  })
})

describe("readProfileDetails", () => {
  it("reads the four fields of one account, and only those", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: { pronouns: "any", country: "BE", favorite_games: ["hanabi"], bio: "Hi" }, error: null })
    expect(await readProfileDetails(ANN)).toEqual({ pronouns: "any", country: "BE", favoriteGames: ["hanabi"], bio: "Hi" })
    expect(mocks.from).toHaveBeenCalledWith("profiles")
    expect(mocks.select).toHaveBeenCalledWith("pronouns, country, favorite_games, bio")
    expect(mocks.eq).toHaveBeenCalledWith("user_id", ANN)
  })

  it("says nothing of an account that has no profile", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null })
    expect(await readProfileDetails(ANN)).toEqual({ pronouns: null, country: null, favoriteGames: [], bio: null })
  })

  it("asks nothing for what is not an account (the demo account)", async () => {
    expect(await readProfileDetails("demo")).toEqual({ pronouns: null, country: null, favoriteGames: [], bio: null })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it("says nothing where the migration is not applied yet, a missing column included, and throws the rest", async () => {
    for (const code of ["42703", "PGRST204", "42P01", "PGRST205"]) {
      mocks.maybeSingle.mockResolvedValue({ data: null, error: { code, message: "not there" } })
      expect(await readProfileDetails(ANN), code).toEqual({ pronouns: null, country: null, favoriteGames: [], bio: null })
    }
    const error = { code: "57014", message: "canceling statement due to statement timeout" }
    mocks.maybeSingle.mockResolvedValue({ data: null, error })
    await expect(readProfileDetails(ANN)).rejects.toBe(error)
  })
})

describe("ensureProfile", () => {
  const account = { id: ANN, nickname: "Ann", avatarUrl: "https://cdn.example/ann.png", createdAt: "2026-10-01T09:00:00.000Z", preferences: { hideHistory: true } } as never

  it("is the profile the member has, and makes nothing", async () => {
    mocks.inFilter.mockResolvedValue({ data: [row()], error: null })
    expect((await ensureProfile(account))?.tag).toBe(42)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it("makes it from the account when the database has none, and reads it back", async () => {
    mocks.inFilter.mockResolvedValueOnce({ data: [], error: null }).mockResolvedValueOnce({ data: [row({ tag: 4021 })], error: null })
    mocks.rpc.mockResolvedValue({ data: true, error: null })
    expect((await ensureProfile(account))?.tag).toBe(4021)
    expect(mocks.rpc).toHaveBeenCalledWith("make_profile", { p_user: ANN, p_nickname: "Ann", p_avatar_url: "https://cdn.example/ann.png", p_hide_history: true, p_created_at: "2026-10-01T09:00:00.000Z" })
  })

  it("passes no picture that is not an https address", async () => {
    mocks.inFilter.mockResolvedValue({ data: [], error: null })
    mocks.rpc.mockResolvedValue({ data: true, error: null })
    await ensureProfile({ ...(account as object), avatarUrl: "http://cdn.example/a.png" } as never)
    expect(mocks.rpc.mock.calls[0]?.[1]).toMatchObject({ p_avatar_url: null })
  })

  it("is null for the demo account, which is in no database, and asks nothing", async () => {
    expect(await ensureProfile({ ...(account as object), id: "demo" } as never)).toBeNull()
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it("is null where the profiles are not there yet, and throws what else the database says", async () => {
    // No table to read and no function to make it with
    mocks.inFilter.mockResolvedValue({ data: null, error: { code: "PGRST205", message: "no table" } })
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "PGRST202", message: "no function" } })
    expect(await ensureProfile(account)).toBeNull()
    mocks.inFilter.mockResolvedValue({ data: [], error: null })
    expect(await ensureProfile(account)).toBeNull()
    const error = { code: "XX000", message: "boom" }
    mocks.rpc.mockResolvedValue({ data: null, error })
    await expect(ensureProfile(account)).rejects.toBe(error)
  })
})

describe("saveProfile", () => {
  it("asks the database to give the member this nickname and tag, and says what it answered", async () => {
    for (const answer of ["ok", "taken", "invalid", "missing"] as const) {
      mocks.rpc.mockResolvedValue({ data: answer, error: null })
      expect(await saveProfile(ANN, { nickname: "Annie", tag: 7 })).toBe(answer)
    }
    expect(mocks.rpc).toHaveBeenCalledWith("set_profile", { p_user: ANN, p_changes: { nickname: "Annie", tag: 7 } })
  })

  it("sends every field of the edit under the name of its column, in one call", async () => {
    mocks.rpc.mockResolvedValue({ data: "ok", error: null })
    await saveProfile(ANN, { nickname: "Annie", tag: 7, pronouns: "they/them", country: "FR", favoriteGames: ["courtisans", "flip-7"], bio: "Hello" })
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("set_profile", {
      p_user: ANN,
      p_changes: { nickname: "Annie", tag: 7, pronouns: "they/them", country: "FR", favorite_games: ["courtisans", "flip-7"], bio: "Hello" },
    })
  })

  it("sends only the fields that are there, so that the others stay as they are", async () => {
    mocks.rpc.mockResolvedValue({ data: "ok", error: null })
    await saveProfile(ANN, { bio: "Only the bio" })
    expect(mocks.rpc).toHaveBeenCalledWith("set_profile", { p_user: ANN, p_changes: { bio: "Only the bio" } })
  })

  it("sends null and an empty list as they are: they take the field away", async () => {
    mocks.rpc.mockResolvedValue({ data: "ok", error: null })
    await saveProfile(ANN, { pronouns: null, country: null, favoriteGames: [], bio: null })
    expect(mocks.rpc).toHaveBeenCalledWith("set_profile", { p_user: ANN, p_changes: { pronouns: null, country: null, favorite_games: [], bio: null } })
  })

  it("asks nothing for an edit with no field: it is invalid", async () => {
    expect(await saveProfile(ANN, {})).toBe("invalid")
    expect(await saveProfile(ANN, { bio: undefined })).toBe("invalid")
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it("takes an answer it does not know for a missing profile", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null })
    expect(await saveProfile(ANN, { nickname: "Annie", tag: 7 })).toBe("missing")
  })

  it("throws what the database says, so that a change that cannot be made is told", async () => {
    const error = { code: "PGRST202", message: "no function" }
    mocks.rpc.mockResolvedValue({ data: null, error })
    await expect(saveProfile(ANN, { nickname: "Annie", tag: 7 })).rejects.toBe(error)
  })
})

describe("the small helpers", () => {
  it("name a profile by its handle", () => {
    expect(handleOf({ nickname: "Ann", tag: 42 })).toEqual({ nickname: "Ann", tag: 42 })
  })

  it("keep a picture that is an https address of a sensible length", () => {
    expect(pictureUrl("https://cdn.example/a.png")).toBe("https://cdn.example/a.png")
    for (const url of [null, undefined, "", "http://cdn.example/a.png", "javascript:alert(1)", "data:image/png;base64,AAAA", `https://cdn.example/${"a".repeat(2100)}`]) expect(pictureUrl(url)).toBeNull()
  })

  it("tell a database without the profiles from any other failure", () => {
    expect(profilesNotApplied({ code: "PGRST202" })).toBe(true)
    expect(profilesNotApplied({ code: "42883" })).toBe(true)
    expect(profilesNotApplied({ code: "PGRST205" })).toBe(true)
    expect(profilesNotApplied({ code: "42P01" })).toBe(true)
    expect(profilesNotApplied({ code: "23505" })).toBe(false)
    expect(profilesNotApplied(new Error("x"))).toBe(false)
    expect(profilesNotApplied(null)).toBe(false)
    expect(profilesNotApplied("PGRST202")).toBe(false)
  })
})
