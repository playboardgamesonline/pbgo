import { beforeEach, describe, expect, it, vi } from "vitest"
import { findPlayerGame, TABLE_IDLE_MS } from "./games"

const h = vi.hoisted(() => ({
  calls: [] as Array<[string, ...unknown[]]>,
  result: { data: [] as unknown[] | null, error: null as unknown },
}))

vi.mock("server-only", () => ({}))
vi.mock("../sanity/client", () => ({ sanityClient: () => null }))
vi.mock("./supabase", () => {
  const query: Record<string, unknown> = {}
  for (const name of ["select", "eq", "in", "gte", "contains", "order"]) {
    query[name] = (...args: unknown[]) => {
      h.calls.push([name, ...args])
      return query
    }
  }
  query.limit = async (...args: unknown[]) => {
    h.calls.push(["limit", ...args])
    return h.result
  }
  return { supabaseAdmin: () => ({ from: (table: string) => (h.calls.push(["from", table]), query) }) }
})

const NOW = Date.parse("2026-11-05T12:00:00.000Z")
const row = { code: "ABC234", host_id: "p1", status: "lobby", players: [{ id: "p1", nickname: "Ann" }] }

beforeEach(() => {
  h.calls.length = 0
  h.result = { data: [], error: null }
})

describe("findPlayerGame", () => {
  it("asks for the tables of the game that wait, are starting or are played, written lately, that hold the player, the last written first", async () => {
    await findPlayerGame({ slug: "courtisans" }, "p1", NOW)
    expect(h.calls).toEqual([
      ["from", "games"],
      ["select", expect.stringContaining("players")],
      ["eq", "game", "courtisans"],
      ["in", "status", ["lobby", "starting", "playing"]],
      ["gte", "updated_at", new Date(NOW - TABLE_IDLE_MS).toISOString()],
      // A string: for an array supabase-js writes a Postgres array literal (`{…}`), which a jsonb column does not read
      ["contains", "players", '[{"id":"p1"}]'],
      ["order", "updated_at", { ascending: false }],
      ["limit", 1],
    ])
  })

  it("lets a table go after six idle hours", () => {
    expect(TABLE_IDLE_MS).toBe(6 * 60 * 60 * 1000)
  })

  it("is the table found, or null when the player sits at none", async () => {
    h.result = { data: [row], error: null }
    expect(await findPlayerGame({ slug: "courtisans" }, "p1", NOW)).toEqual(row)
    h.result = { data: [], error: null }
    expect(await findPlayerGame({ slug: "courtisans" }, "p1", NOW)).toBeNull()
    h.result = { data: null, error: null }
    expect(await findPlayerGame({ slug: "courtisans" }, "p1", NOW)).toBeNull()
  })

  it("throws what the database says rather than saying the player sits nowhere", async () => {
    h.result = { data: null, error: new Error("boom") }
    await expect(findPlayerGame({ slug: "courtisans" }, "p1", NOW)).rejects.toThrow("boom")
  })
})
