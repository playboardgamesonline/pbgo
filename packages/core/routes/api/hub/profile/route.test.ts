import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  account: null as { id: string; nickname?: string } | null,
  saveProfile: vi.fn(async (_userId: string, _edit: Record<string, unknown>): Promise<"ok" | "taken" | "invalid" | "missing"> => "ok"),
  ensureProfile: vi.fn(async (_account: unknown): Promise<object | null> => ({})),
  catalog: vi.fn(async (_slugs: readonly string[]): Promise<{ unknown: readonly string[]; complete: boolean }> => ({ unknown: [], complete: true })),
}))

vi.mock("server-only", () => ({}))
vi.mock("@pbgo/accounts/server", () => ({ getAccount: async () => mocks.account }))
vi.mock("../../../../server/player", () => ({ getPlayerId: async () => null }))
vi.mock("../../../../server/profiles", async (importOriginal) => ({ ...(await importOriginal<typeof import("../../../../server/profiles")>()), saveProfile: mocks.saveProfile, ensureProfile: mocks.ensureProfile }))

import { CORE_ERROR_MESSAGES } from "../../../../lib/api"
import { setRateLimitStore } from "../../../../server/rate-limit"
import { MemoryRateLimitStore } from "../../../../server/rate-limiter"
import { GET, postProfile } from "./route"

const POST = postProfile(mocks.catalog)

const ANN = "0b9f6a52-8c0e-4d6e-9d53-4a1d2f6a7c11"

const request = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("http://localhost/api/hub/profile", { method: "POST", headers: { "x-forwarded-for": "1.1.1.1", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) })
const change = (nickname: unknown, tag: unknown, headers?: Record<string, string>) => POST(request({ nickname, tag }, headers))
const send = (body: unknown, headers?: Record<string, string>) => POST(request(body, headers))
const errorOf = async (response: Response) => ((await response.json()) as { error?: string }).error

beforeEach(() => {
  mocks.account = null
  mocks.saveProfile.mockReset()
  mocks.saveProfile.mockResolvedValue("ok")
  mocks.ensureProfile.mockReset()
  mocks.ensureProfile.mockResolvedValue({})
  mocks.catalog.mockReset()
  mocks.catalog.mockResolvedValue({ unknown: [], complete: true })
  setRateLimitStore(new MemoryRateLimitStore())
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("POST /api/hub/profile", () => {
  it("gives the signed-in member the nickname and the tag they ask for, and says what was kept", async () => {
    mocks.account = { id: ANN }
    const response = await change("Alex", 42)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ saved: true, nickname: "Alex", tag: 42 })
    expect(mocks.saveProfile).toHaveBeenCalledExactlyOnceWith(ANN, { nickname: "Alex", tag: 42 })
  })

  it("keeps the nickname as it is cleaned, and takes the tag as the member typed it", async () => {
    mocks.account = { id: ANN }
    const response = await change("  Marly   74 ", " #0042 ")
    expect(await response.json()).toEqual({ saved: true, nickname: "Marly 74", tag: 42 })
    expect(mocks.saveProfile).toHaveBeenCalledExactlyOnceWith(ANN, { nickname: "Marly 74", tag: 42 })
  })

  it("changes the profile of the account that is signed in, whatever the request says of who it is", async () => {
    mocks.account = { id: ANN }
    const response = await send({ nickname: "Alex", tag: 42, user_id: "someone-else", userId: "someone-else" })
    expect(response.status).toBe(200)
    expect(mocks.saveProfile).toHaveBeenCalledExactlyOnceWith(ANN, { nickname: "Alex", tag: 42 })
  })

  it("refuses a visitor who is not signed in, and keeps nothing: a guest has no profile", async () => {
    const response = await change("Alex", 42)
    expect(response.status).toBe(401)
    expect(await errorOf(response)).toBe("NOT_SIGNED_IN")
    expect(mocks.saveProfile).not.toHaveBeenCalled()
  })

  it.each([
    [null, 42],
    [7, 42],
    ["", 42],
    ["   ", 42],
    ["a".repeat(21), 42],
    ["Alex#1", 42],
    ["A/B", 42],
    ["A\\B", 42],
    ["Alex", null],
    ["Alex", 0],
    ["Alex", "0000"],
    ["Alex", 10000],
    ["Alex", "12345"],
    ["Alex", 4.2],
    ["Alex", "x"],
    ["Alex", [42]],
    ["Alex", {}],
  ])("refuses %j with the tag %j, which no profile can have: nothing is kept", async (nickname, tag) => {
    mocks.account = { id: ANN }
    const response = await change(nickname, tag)
    expect(response.status).toBe(400)
    expect(await errorOf(response)).toBe("PROFILE_INVALID")
    expect(mocks.saveProfile).not.toHaveBeenCalled()
  })

  it("changes the nickname alone, or the tag alone: what is not in the request stays as it is", async () => {
    mocks.account = { id: ANN }
    expect(await (await send({ nickname: "Alex" })).json()).toEqual({ saved: true, nickname: "Alex" })
    expect(mocks.saveProfile).toHaveBeenLastCalledWith(ANN, { nickname: "Alex" })
    expect(await (await send({ tag: 7 })).json()).toEqual({ saved: true, tag: 7 })
    expect(mocks.saveProfile).toHaveBeenLastCalledWith(ANN, { tag: 7 })
  })

  it("refuses a request that has nothing of a profile in it", async () => {
    mocks.account = { id: ANN }
    for (const body of [{}, { user_id: ANN }, { nickname: undefined }]) {
      const response = await send(body)
      expect(response.status, JSON.stringify(body)).toBe(400)
      expect(await errorOf(response)).toBe("PROFILE_INVALID")
    }
    // A body that is not even an object is refused before the profile is looked at, by the reader of the request
    for (const body of [[], [{ nickname: "Alex" }], null, "nickname", 42]) {
      const response = await send(body)
      expect(response.status, JSON.stringify(body)).toBe(400)
      expect(["PROFILE_INVALID", "INVALID_REQUEST"]).toContain(await errorOf(response))
    }
    expect(mocks.saveProfile).not.toHaveBeenCalled()
  })

  it("refuses a body that is not JSON", async () => {
    mocks.account = { id: ANN }
    const response = await POST(request("{not json"))
    expect(response.status).toBe(400)
    expect(await errorOf(response)).toBe("INVALID_REQUEST")
    expect(mocks.saveProfile).not.toHaveBeenCalled()
  })

  describe("what a profile says of its member", () => {
    it("keeps the pronouns, the country, the favourite games and the bio, each as it is cleaned, and says what it kept", async () => {
      mocks.account = { id: ANN }
      const response = await send({ pronouns: "they/them", country: "fr", favoriteGames: ["courtisans", "flip-7"], bio: "  I play late.\r\nCome and join!  " })
      expect(response.status).toBe(200)
      const kept = { pronouns: "they/them", country: "FR", favoriteGames: ["courtisans", "flip-7"], bio: "I play late.\nCome and join!" }
      expect(await response.json()).toEqual({ saved: true, ...kept })
      expect(mocks.saveProfile).toHaveBeenCalledExactlyOnceWith(ANN, kept)
    })

    it("changes the name and the details in one request, so that they are whole or nothing", async () => {
      mocks.account = { id: ANN }
      await send({ nickname: "Alex", tag: 42, pronouns: "he/him", bio: "Hi" })
      expect(mocks.saveProfile).toHaveBeenCalledExactlyOnceWith(ANN, { nickname: "Alex", tag: 42, pronouns: "he/him", bio: "Hi" })
    })

    it("takes them away with null or with nothing: an empty text for the pronouns, the country and the bio, an empty list for the games", async () => {
      mocks.account = { id: ANN }
      expect(await (await send({ pronouns: null, country: null, favoriteGames: null, bio: null })).json()).toEqual({ saved: true, pronouns: null, country: null, favoriteGames: [], bio: null })
      expect(await (await send({ pronouns: "", country: "", favoriteGames: [], bio: "  \n " })).json()).toEqual({ saved: true, pronouns: null, country: null, favoriteGames: [], bio: null })
      expect(mocks.saveProfile).toHaveBeenLastCalledWith(ANN, { pronouns: null, country: null, favoriteGames: [], bio: null })
    })

    it.each([
      [{ pronouns: "he/she" }],
      [{ pronouns: "HE/HIM" }],
      [{ pronouns: 3 }],
      [{ country: "ZZ" }],
      [{ country: "FRA" }],
      [{ country: 12 }],
      [{ favoriteGames: "flip-7" }],
      [{ favoriteGames: ["a", "b", "c", "d", "e", "f"] }],
      [{ favoriteGames: ["flip-7", "flip-7"] }],
      [{ favoriteGames: ["Flip 7"] }],
      [{ favoriteGames: [7] }],
      [{ bio: "b".repeat(201) }],
      [{ bio: "a\nb\nc\nd\ne" }],
      [{ bio: 12 }],
      [{ bio: ["a"] }],
      [{ nickname: "Alex", tag: 42, bio: "b".repeat(201) }],
      [{ nickname: "Alex", tag: 42, pronouns: "he/she" }],
    ])("refuses %j, which no profile can hold: nothing is kept, not even the rest", async (body) => {
      mocks.account = { id: ANN }
      const response = await send(body)
      expect(response.status).toBe(400)
      expect(await errorOf(response)).toBe("PROFILE_INVALID")
      expect(mocks.saveProfile).not.toHaveBeenCalled()
      expect(mocks.catalog).not.toHaveBeenCalled()
    })

    it("never reads a bio as markup: text that looks like HTML is kept as text", async () => {
      mocks.account = { id: ANN }
      const response = await send({ bio: "<img src=x onerror=alert(1)> & <b>hi</b>" })
      expect(await response.json()).toEqual({ saved: true, bio: "<img src=x onerror=alert(1)> & <b>hi</b>" })
      expect(mocks.saveProfile).toHaveBeenCalledWith(ANN, { bio: "<img src=x onerror=alert(1)> & <b>hi</b>" })
    })

    it("asks the catalog whether the favourite games are games, all of them at once", async () => {
      mocks.account = { id: ANN }
      await send({ favoriteGames: ["courtisans", "flip-7", "hanabi"] })
      expect(mocks.catalog).toHaveBeenCalledExactlyOnceWith(["courtisans", "flip-7", "hanabi"])
    })

    it("asks the catalog nothing when the request holds no favourite games, or none at all (they are taken away)", async () => {
      mocks.account = { id: ANN }
      await send({ bio: "Hi" })
      await send({ favoriteGames: [] })
      await send({ favoriteGames: null })
      expect(mocks.catalog).not.toHaveBeenCalled()
      expect(mocks.saveProfile).toHaveBeenCalledTimes(3)
    })

    it("refuses a favourite that is not a game of the catalog, and keeps nothing", async () => {
      mocks.account = { id: ANN }
      mocks.catalog.mockResolvedValue({ unknown: ["not-a-game"], complete: true })
      const response = await send({ nickname: "Alex", tag: 42, favoriteGames: ["courtisans", "not-a-game"] })
      expect(response.status).toBe(400)
      expect(await errorOf(response)).toBe("PROFILE_GAME_UNKNOWN")
      expect(mocks.saveProfile).not.toHaveBeenCalled()
    })

    it("says it is not available while the catalog cannot be read in full and does not list a slug: it cannot tell a game from what is not", async () => {
      mocks.account = { id: ANN }
      mocks.catalog.mockResolvedValue({ unknown: ["flip-7"], complete: false })
      const response = await send({ favoriteGames: ["courtisans", "flip-7"] })
      expect(response.status).toBe(503)
      expect(await errorOf(response)).toBe("PROFILE_UNAVAILABLE")
      expect(mocks.saveProfile).not.toHaveBeenCalled()
    })

    it("keeps the favourites that the catalog lists even when it could not be read in full", async () => {
      mocks.account = { id: ANN }
      mocks.catalog.mockResolvedValue({ unknown: [], complete: false })
      const response = await send({ favoriteGames: ["courtisans"] })
      expect(response.status).toBe(200)
      expect(mocks.saveProfile).toHaveBeenCalledWith(ANN, { favoriteGames: ["courtisans"] })
    })

    it("changes the bio while the catalog is down, since it asks nothing of it", async () => {
      mocks.account = { id: ANN }
      mocks.catalog.mockRejectedValue(new Error("catalog down"))
      expect((await send({ bio: "Still here" })).status).toBe(200)
    })

    it("answers with an error when the catalog itself fails, and keeps nothing: the member is not told it is saved", async () => {
      mocks.account = { id: ANN }
      mocks.catalog.mockRejectedValue(new Error("catalog down"))
      const response = await send({ favoriteGames: ["courtisans"] })
      expect(response.status).toBe(500)
      expect(await errorOf(response)).toBe("SERVER_ERROR")
      expect(mocks.saveProfile).not.toHaveBeenCalled()
    })

    it("keeps nothing for the demo account of development, checks the request all the same, asks nothing of the catalog and says it is saved", async () => {
      mocks.account = { id: "demo" }
      const response = await send({ pronouns: "any", favoriteGames: ["courtisans"], bio: " Hi " })
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ saved: true, pronouns: "any", favoriteGames: ["courtisans"], bio: "Hi" })
      expect((await send({ pronouns: "he/she" })).status).toBe(400)
      expect(mocks.saveProfile).not.toHaveBeenCalled()
      expect(mocks.catalog).not.toHaveBeenCalled()
    })
  })

  it("says the pair is taken when somebody else has it, as a conflict", async () => {
    mocks.account = { id: ANN }
    mocks.saveProfile.mockResolvedValue("taken")
    const response = await change("Alex", 42)
    expect(response.status).toBe(409)
    expect(await errorOf(response)).toBe("PROFILE_TAKEN")
  })

  it("refuses what the database finds invalid, though the route let it through", async () => {
    mocks.account = { id: ANN }
    mocks.saveProfile.mockResolvedValue("invalid")
    const response = await change("Alex", 42)
    expect(response.status).toBe(400)
    expect(await errorOf(response)).toBe("PROFILE_INVALID")
  })

  it("makes the profile of an account that has none, and asks again", async () => {
    mocks.account = { id: ANN, nickname: "Ann" }
    mocks.saveProfile.mockResolvedValueOnce("missing").mockResolvedValueOnce("ok")
    const response = await change("Alex", 42)
    expect(response.status).toBe(200)
    expect(mocks.ensureProfile).toHaveBeenCalledExactlyOnceWith(mocks.account)
    expect(mocks.saveProfile).toHaveBeenCalledTimes(2)
  })

  it("says it is not available when the account has no profile and none can be made", async () => {
    mocks.account = { id: ANN }
    mocks.saveProfile.mockResolvedValue("missing")
    mocks.ensureProfile.mockResolvedValue(null)
    const response = await change("Alex", 42)
    expect(response.status).toBe(503)
    expect(await errorOf(response)).toBe("PROFILE_UNAVAILABLE")
    expect(mocks.saveProfile).toHaveBeenCalledTimes(1)
  })

  it("says it is not available when the profile that was made is still not there", async () => {
    mocks.account = { id: ANN }
    mocks.saveProfile.mockResolvedValue("missing")
    const response = await change("Alex", 42)
    expect(response.status).toBe(503)
    expect(await errorOf(response)).toBe("PROFILE_UNAVAILABLE")
    expect(mocks.saveProfile).toHaveBeenCalledTimes(2)
  })

  it("says it is not available where the database has not got the profiles yet, and not that something broke", async () => {
    mocks.account = { id: ANN }
    mocks.saveProfile.mockRejectedValue({ code: "PGRST202", message: "Could not find the function public.set_profile" })
    const response = await change("Alex", 42)
    expect(response.status).toBe(503)
    expect(await errorOf(response)).toBe("PROFILE_UNAVAILABLE")
  })

  it("answers with an error when the database fails otherwise, so that the member is not told it is saved", async () => {
    mocks.account = { id: ANN }
    mocks.saveProfile.mockRejectedValue(new Error("connection refused"))
    const response = await change("Alex", 42)
    expect(response.status).toBe(500)
    expect(await errorOf(response)).toBe("SERVER_ERROR")
  })

  it("keeps nothing for the demo account of development, which is in no database, and says it is saved", async () => {
    mocks.account = { id: "demo" }
    const response = await change("Alex", 42)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ saved: true, nickname: "Alex", tag: 42 })
    expect(mocks.saveProfile).not.toHaveBeenCalled()
  })

  it("refuses a request that comes from another site: it acts on the strength of a cookie", async () => {
    mocks.account = { id: ANN }
    const refused = await change("Alex", 42, { origin: "https://evil.example" })
    expect(refused.status).toBe(403)
    expect(await errorOf(refused)).toBe("CROSS_ORIGIN")
    expect(mocks.saveProfile).not.toHaveBeenCalled()
    expect((await change("Alex", 42, { origin: "http://localhost" })).status).toBe(200)
    // A client that says nothing is a script, with no cookie of ours to abuse
    expect((await change("Alex", 43)).status).toBe(200)
  })

  it("limits a script that tries pair after pair, per IP", async () => {
    mocks.account = { id: ANN }
    mocks.saveProfile.mockResolvedValue("taken")
    for (let i = 0; i < 20; i++) expect((await change("Alex", 42, { "x-forwarded-for": "2.2.2.2" })).status).toBe(409)
    const refused = await change("Alex", 42, { "x-forwarded-for": "2.2.2.2" })
    expect(refused.status).toBe(429)
    expect(await errorOf(refused)).toBe("RATE_LIMITED")
    expect((await change("Alex", 42, { "x-forwarded-for": "3.3.3.3" })).status).toBe(409)
  })

  it("has a message in the platform's wording for each of its refusals: a member never reads [missing: …]", () => {
    for (const code of ["NOT_SIGNED_IN", "PROFILE_INVALID", "PROFILE_TAKEN", "PROFILE_GAME_UNKNOWN", "PROFILE_UNAVAILABLE", "CROSS_ORIGIN", "INVALID_REQUEST", "RATE_LIMITED", "SERVER_ERROR"]) expect(CORE_ERROR_MESSAGES[code], code).toBeTruthy()
  })
})

describe("GET /api/hub/profile", () => {
  const ask = (ip = "1.1.1.1") => GET(new Request("http://localhost/api/hub/profile", { headers: { "x-forwarded-for": ip } }))

  it("says the signed-in member's own nickname and tag, the profile's", async () => {
    mocks.account = { id: ANN, nickname: "Anne Martin" }
    mocks.ensureProfile.mockResolvedValue({ userId: ANN, nickname: "Annie", tag: 7 })
    const response = await ask()
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ nickname: "Annie", tag: 7 })
    expect(mocks.ensureProfile).toHaveBeenCalledExactlyOnceWith(mocks.account)
  })

  it("is a 401 for a visitor who is not signed in, and reads nothing", async () => {
    const response = await ask()
    expect(response.status).toBe(401)
    expect(await errorOf(response)).toBe("NOT_SIGNED_IN")
    expect(mocks.ensureProfile).not.toHaveBeenCalled()
  })

  it("says the account's name with no tag where the database has no profile for the member (the migration is not applied yet)", async () => {
    mocks.account = { id: ANN, nickname: "Anne Martin" }
    mocks.ensureProfile.mockResolvedValue(null)
    expect(await (await ask()).json()).toEqual({ nickname: "Anne Martin", tag: null })
  })

  it("says the same when the database cannot be read, and the menu is not broken by it: the cause is in the log", async () => {
    mocks.account = { id: ANN, nickname: "Anne Martin" }
    mocks.ensureProfile.mockRejectedValue(new Error("connection refused"))
    const response = await ask()
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ nickname: "Anne Martin", tag: null })
    expect(console.error).toHaveBeenCalled()
  })

  it("gives the demo account of development its made-up tag, and reads nothing", async () => {
    mocks.account = { id: "demo", nickname: "Demo" }
    expect(await (await ask()).json()).toEqual({ nickname: "Demo", tag: 1 })
    expect(mocks.ensureProfile).not.toHaveBeenCalled()
  })

  it("is limited per IP, with room for a page load each time a few tabs are open", async () => {
    mocks.account = { id: ANN, nickname: "Anne" }
    mocks.ensureProfile.mockResolvedValue({ userId: ANN, nickname: "Anne", tag: 1 })
    for (let i = 0; i < 120; i++) expect((await ask("2.2.2.2")).status).toBe(200)
    const refused = await ask("2.2.2.2")
    expect(refused.status).toBe(429)
    expect(await errorOf(refused)).toBe("RATE_LIMITED")
    expect((await ask("3.3.3.3")).status).toBe(200)
  })
})
