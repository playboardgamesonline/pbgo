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
import { activeTable, busySeats, hasTableToWatch, readMemberTables, type MemberTable } from "./tables"

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
