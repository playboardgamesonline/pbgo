import { beforeEach, describe, expect, it, vi } from "vitest"

const h = vi.hoisted(() => ({
  calls: [] as Array<{ name: string; args: Record<string, unknown> }>,
  answer: { data: null as unknown, error: null as { code?: string; message: string } | null },
  throws: null as Error | null,
}))

vi.mock("server-only", () => ({}))
vi.mock("./supabase", () => ({
  supabaseAdmin: () => ({
    rpc: async (name: string, args: Record<string, unknown>) => {
      h.calls.push({ name, args })
      if (h.throws) throw h.throws
      return h.answer
    },
  }),
}))

import { TABLE_IDLE_MS } from "./games"
import { activeTable, busySeats, hasTableToWatch, PUBLIC_ALIVE_MS, PUBLIC_TABLES_MAX, readMemberTables, readPublicTables, type MemberTable } from "./tables"

const table = (code: string, status: MemberTable["status"]): MemberTable => ({
  game: "courtisans",
  code,
  status,
  hostId: "p1",
  players: [{ id: "p1", nickname: "Ann" }],
  options: {},
  seat: "p1",
  createdAt: "2026-11-10T10:00:00.000Z",
  updatedAt: "2026-11-10T10:05:00.000Z",
})

beforeEach(() => {
  h.calls = []
  h.answer = { data: null, error: null }
  h.throws = null
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("readMemberTables", () => {
  it("asks the database for the member's tables with the idle time of the game's page, and reads them as tables", async () => {
    h.answer = {
      data: [{ game: "courtisans", code: "ABC234", status: "playing", host_id: "p1", players: [{ id: "p1", nickname: "Ann", left: true }], options: { rounds: 3 }, seat: "p1", created_at: "2026-11-10T09:00:00Z", updated_at: "2026-11-10T09:30:00Z" }],
      error: null,
    }
    const tables = await readMemberTables("0b9f6a52-8c0e-4d6e-9d53-4a1d2f6a7c11")
    expect(h.calls).toEqual([{ name: "member_tables", args: { p_user: "0b9f6a52-8c0e-4d6e-9d53-4a1d2f6a7c11", p_idle: `${TABLE_IDLE_MS / 1000} seconds` } }])
    expect(tables).toEqual([
      { game: "courtisans", code: "ABC234", status: "playing", hostId: "p1", players: [{ id: "p1", nickname: "Ann", left: true }], options: { rounds: 3 }, seat: "p1", createdAt: "2026-11-10T09:00:00Z", updatedAt: "2026-11-10T09:30:00Z" },
    ])
  })

  it("has no tables for a member who sits nowhere, and tolerates what the database leaves empty", async () => {
    expect(await readMemberTables("u")).toEqual([])
    h.answer = { data: [{ game: "hanabi", code: "XYZ789", status: "lobby", host_id: "p9", players: null, options: null, seat: "p9", created_at: "a", updated_at: "b" }], error: null }
    expect(await readMemberTables("u")).toMatchObject([{ players: [], options: {} }])
  })

  it("throws what the database says: the page decides what to do without them", async () => {
    h.answer = { data: null, error: { code: "42883", message: "function public.member_tables(uuid, text) does not exist" } }
    await expect(readMemberTables("u")).rejects.toMatchObject({ code: "42883" })
  })
})

describe("the table a member is taken to", () => {
  it("is the first one that is starting or being played, and none for lobbies alone", () => {
    expect(activeTable([table("AAA111", "lobby"), table("BBB222", "playing"), table("CCC333", "starting")])?.code).toBe("BBB222")
    expect(activeTable([table("AAA111", "starting")])?.code).toBe("AAA111")
    expect(activeTable([table("AAA111", "lobby"), table("BBB222", "lobby")])).toBeNull()
    expect(activeTable([])).toBeNull()
  })

  it("keeps what the table is at, which decides from which pages the member is taken to it", () => {
    expect(activeTable([table("AAA111", "lobby"), table("BBB222", "playing")])?.status).toBe("playing")
    expect(activeTable([table("AAA111", "starting")])?.status).toBe("starting")
  })

  it("asks for a closer look when a table may begin any moment", () => {
    expect(hasTableToWatch([table("AAA111", "lobby")])).toBe(true)
    expect(hasTableToWatch([table("AAA111", "starting")])).toBe(true)
    expect(hasTableToWatch([table("AAA111", "playing")])).toBe(false)
    expect(hasTableToWatch([])).toBe(false)
  })
})

describe("busySeats", () => {
  it("lists the seats that the database finds in a game somewhere else", async () => {
    h.answer = { data: ["p2", "p3"], error: null }
    expect(await busySeats({ slug: "courtisans" }, "ABC234")).toEqual(["p2", "p3"])
    expect(h.calls).toEqual([{ name: "busy_seats", args: { p_game: "courtisans", p_code: "ABC234", p_idle: `${TABLE_IDLE_MS / 1000} seconds` } }])
  })

  it("lists none when the database answers none", async () => {
    h.answer = { data: [], error: null }
    expect(await busySeats({ slug: "courtisans" }, "ABC234")).toEqual([])
    h.answer = { data: null, error: null }
    expect(await busySeats({ slug: "courtisans" }, "ABC234")).toEqual([])
  })

  it("lets the table start when the rule cannot be checked, and says so in the log", async () => {
    h.answer = { data: null, error: { code: "42883", message: "function public.busy_seats does not exist" } }
    expect(await busySeats({ slug: "courtisans" }, "ABC234")).toEqual([])
    h.throws = new Error("network down")
    expect(await busySeats({ slug: "courtisans" }, "ABC234")).toEqual([])
    expect(console.error).toHaveBeenCalledTimes(2)
  })
})

describe("readPublicTables", () => {
  const row = (code: string, settings: unknown = { visibility: "public" }) => ({ game: "courtisans", code, host_id: "p1", players: [{ id: "p1", nickname: "Ann" }], options: { rounds: 3 }, settings, created_at: "2026-11-10T11:49:11Z", updated_at: "2026-11-10T11:50:00Z" })

  it("asks the database for the public lobbies of a game, with the idle time of the game's page and how lately somebody must have been seen", async () => {
    h.answer = { data: [row("ABC234", { visibility: "public", minRank: "Silver", language: "fr", pace: "fast", seats: 3 })], error: null }
    const tables = await readPublicTables("courtisans")
    expect(h.calls).toEqual([{ name: "public_tables", args: { p_game: "courtisans", p_alive: `${PUBLIC_ALIVE_MS / 1000} seconds`, p_idle: `${TABLE_IDLE_MS / 1000} seconds`, p_limit: PUBLIC_TABLES_MAX } }])
    expect(tables).toEqual([
      {
        game: "courtisans",
        code: "ABC234",
        hostId: "p1",
        players: [{ id: "p1", nickname: "Ann" }],
        options: { rounds: 3 },
        settings: { visibility: "public", minRank: "Silver", language: "fr", pace: "fast", seats: 3 },
        createdAt: "2026-11-10T11:49:11Z",
        updatedAt: "2026-11-10T11:50:00Z",
      },
    ])
  })

  it("asks for every game when none is given, and for as many as it is told", async () => {
    await readPublicTables(null, 6)
    expect(h.calls).toMatchObject([{ name: "public_tables", args: { p_game: null, p_limit: 6 } }])
  })

  it("keeps the settings to what is valid and tolerates what the database leaves empty", async () => {
    h.answer = { data: [{ ...row("ABC234", { visibility: "everyone", seats: "3", minRank: "Apprentice" }), players: null, options: null }, row("XYZ789", null)], error: null }
    expect(await readPublicTables("courtisans")).toMatchObject([
      { code: "ABC234", players: [], options: {}, settings: {} },
      { code: "XYZ789", settings: {} },
    ])
  })

  it("lists none when nothing is public", async () => {
    expect(await readPublicTables("courtisans")).toEqual([])
  })

  it("lists none, quietly, on a project where migration 0014 is not applied yet", async () => {
    for (const code of ["42883", "PGRST202", "42703"]) {
      h.answer = { data: null, error: { code, message: "not there" } }
      expect(await readPublicTables("courtisans")).toEqual([])
    }
    expect(console.error).not.toHaveBeenCalled()
  })

  it("lists none, and says why, when the database cannot answer", async () => {
    h.answer = { data: null, error: { code: "57P01", message: "terminating connection" } }
    expect(await readPublicTables("courtisans")).toEqual([])
    h.throws = new Error("network down")
    expect(await readPublicTables("courtisans")).toEqual([])
    expect(console.error).toHaveBeenCalledTimes(2)
  })
})
