import { beforeEach, describe, expect, it, vi } from "vitest"

const h = vi.hoisted(() => ({
  calls: [] as Array<{ columns: string; filters: Record<string, unknown>; in: Record<string, unknown> }>,
  answer: { data: null as unknown, error: null as { code?: string; message: string } | null },
  throws: null as Error | null,
  account: null as null | { language: string | null },
  jar: new Map<string, string>(),
  headers: {} as Record<string, string>,
  rank: null as null | { tier: string },
  standings: [] as Array<[string, string]>,
}))

vi.mock("server-only", () => ({}))
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (h.jar.has(name) ? { name, value: h.jar.get(name)! } : undefined) }),
  headers: async () => ({ get: (name: string) => h.headers[name.toLowerCase()] ?? null }),
}))
vi.mock("@pbgo/accounts/server", () => ({ getAccount: async () => h.account }))
vi.mock("./standings", () => ({
  readPlayerStanding: async (member: string, game: string) => {
    h.standings.push([member, game])
    return { rank: h.rank }
  },
}))
vi.mock("./supabase", () => ({
  supabaseAdmin: () => ({
    from: () => ({
      select: (columns: string) => {
        const call = { columns, filters: {} as Record<string, unknown>, in: {} as Record<string, unknown> }
        h.calls.push(call)
        const query = {
          eq: (column: string, value: unknown) => {
            call.filters[column] = value
            return query
          },
          in: async (column: string, values: unknown) => {
            call.in[column] = values
            if (h.throws) throw h.throws
            return h.answer
          },
          maybeSingle: async () => {
            if (h.throws) throw h.throws
            return h.answer
          },
        }
        return query
      },
    }),
  }),
}))

import { readTableSettings, readTableSettingsOf, viewerFor, visitorLanguage } from "./table-settings"

beforeEach(() => {
  h.calls = []
  h.answer = { data: null, error: null }
  h.throws = null
  h.account = null
  h.jar = new Map()
  h.headers = {}
  h.rank = null
  h.standings = []
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("readTableSettingsOf", () => {
  it("reads the settings of one table of one game, kept to what is valid", async () => {
    h.answer = { data: { settings: { visibility: "public", minRank: "Gold", seats: 99, other: true } }, error: null }
    expect(await readTableSettingsOf("courtisans", "ABC234")).toEqual({ visibility: "public", minRank: "Gold" })
    expect(h.calls).toEqual([{ columns: "settings", filters: { game: "courtisans", code: "ABC234" }, in: {} }])
  })

  it("has none for a table that has none, that does not exist, or whose settings are not an object", async () => {
    expect(await readTableSettingsOf("courtisans", "ABC234")).toEqual({})
    h.answer = { data: { settings: null }, error: null }
    expect(await readTableSettingsOf("courtisans", "ABC234")).toEqual({})
    h.answer = { data: { settings: ["public"] }, error: null }
    expect(await readTableSettingsOf("courtisans", "ABC234")).toEqual({})
  })

  it("has none, quietly, when the database has no such column yet, and says why when it fails otherwise", async () => {
    h.answer = { data: null, error: { code: "42703", message: "column games.settings does not exist" } }
    expect(await readTableSettingsOf("courtisans", "ABC234")).toEqual({})
    expect(console.error).not.toHaveBeenCalled()
    h.answer = { data: null, error: { code: "57P01", message: "terminating connection" } }
    expect(await readTableSettingsOf("courtisans", "ABC234")).toEqual({})
    h.throws = new Error("network down")
    expect(await readTableSettingsOf("courtisans", "ABC234")).toEqual({})
    expect(console.error).toHaveBeenCalledTimes(2)
  })
})

describe("readTableSettings", () => {
  it("reads the settings of several tables of a game at once, by code", async () => {
    h.answer = { data: [{ code: "AAA111", settings: { visibility: "public" } }, { code: "BBB222", settings: {} }], error: null }
    const found = await readTableSettings("courtisans", ["AAA111", "BBB222", "CCC333"])
    expect([...found]).toEqual([
      ["AAA111", { visibility: "public" }],
      ["BBB222", {}],
    ])
    expect(h.calls).toEqual([{ columns: "code, settings", filters: { game: "courtisans" }, in: { code: ["AAA111", "BBB222", "CCC333"] } }])
  })

  it("asks nothing for no table, and finds none when the database cannot say", async () => {
    expect((await readTableSettings("courtisans", [])).size).toBe(0)
    expect(h.calls).toEqual([])
    h.answer = { data: null, error: { code: "42703", message: "column games.settings does not exist" } }
    expect((await readTableSettings("courtisans", ["AAA111"])).size).toBe(0)
    h.throws = new Error("network down")
    expect((await readTableSettings("courtisans", ["AAA111"])).size).toBe(0)
    expect(console.error).toHaveBeenCalledTimes(1)
  })
})

describe("visitorLanguage", () => {
  it("is the account's language, else the cookie's, else the browser's, else English (US)", async () => {
    h.headers["accept-language"] = "de-DE,de;q=0.9"
    expect(await visitorLanguage()).toBe("de")
    h.jar.set("pbgo-locale", "fr")
    expect(await visitorLanguage()).toBe("fr")
    h.account = { language: "es" }
    expect(await visitorLanguage()).toBe("es")
    h.account = null
    h.jar.clear()
    h.headers = {}
    expect(await visitorLanguage()).toBe("en")
  })
})

describe("viewerFor", () => {
  it("looks up only what the table asks for: a rank asks for the member's standing, a language for the visitor's", async () => {
    h.rank = { tier: "Gold" }
    h.jar.set("pbgo-locale", "fr")
    expect(await viewerFor("courtisans", "u1", { visibility: "public", minRank: "Silver" })).toMatchObject({ tier: "Gold" })
    expect(h.standings).toEqual([["u1", "courtisans"]])
    h.standings = []
    expect(await viewerFor("courtisans", "u1", { visibility: "public", language: "fr" })).toEqual({ tier: "Apprentice", language: "fr" })
    expect(h.standings).toEqual([])
  })

  it("gives the lowest tier to a guest and to a member who never played the game ranked", async () => {
    expect((await viewerFor("courtisans", null, { visibility: "public", minRank: "Bronze" })).tier).toBe("Apprentice")
    expect(h.standings).toEqual([])
    expect((await viewerFor("courtisans", "u1", { visibility: "public", minRank: "Bronze" })).tier).toBe("Apprentice")
  })
})
