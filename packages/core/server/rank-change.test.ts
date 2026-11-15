import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ from: vi.fn() }))

vi.mock("server-only", () => ({}))
vi.mock("./supabase", () => ({ supabaseAdmin: () => ({ from: mocks.from }) }))

import { NO_RANK_CHANGE } from "../lib/rank-change"
import { readRankChange } from "./rank-change"

const USER = "0b9f6a52-8c0e-4d6e-9d53-4a1d2f6a7c11"
const TABLE = { game: "testgame", userId: USER, tableCreatedAt: "2026-11-08T10:00:00.000Z", startedAt: null }

beforeEach(() => {
  mocks.from.mockReset()
})

type Answer = { data: unknown; error: unknown }

/** The tables answer in turn: each `from(table)` takes the next answer queued for that table, and what is chained on it is recorded, so that a test can say what was asked. */
function tables(answers: Record<string, Answer[]>) {
  const log: { table: string; calls: [string, unknown[]][] }[] = []
  mocks.from.mockImplementation((table: string) => {
    const entry = { table, calls: [] as [string, unknown[]][] }
    log.push(entry)
    const answer = answers[table]?.shift() ?? { data: null, error: { message: `no answer left for ${table}` } }
    const chain: object = new Proxy(
      {},
      {
        get: (_target, name) =>
          name === "then"
            ? (resolve: (value: Answer) => unknown) => resolve(answer)
            : (...args: unknown[]) => {
                entry.calls.push([String(name), args])
                return chain
              },
      },
    )
    return chain
  })
  return log
}

/** The seat the member held in the latest game of the table, as the database answers it with the game it is joined to. */
const seat = (ranked: boolean) => ({ data: [{ game_result_id: "r1", finished_at: "2026-11-08T10:20:00.000Z", game_results: { game: "testgame", table_created_at: TABLE.tableCreatedAt, ranked } }], error: null })

describe("the experience of a game that was written down", () => {
  it("is what the member's seat holds, for a game that did not count for the rank", async () => {
    const log = tables({ game_participants: [seat(false), { data: [{ actions: 12 }], error: null }] })
    expect(await readRankChange(TABLE)).toEqual({ recorded: true, ranked: false, points: null, xp: 12 })
    // The second question is about the seat of the game and of the member
    const actionsQuery = log.filter((query) => query.table === "game_participants")[1]!
    expect(actionsQuery.calls).toContainEqual(["select", ["actions"]])
    expect(actionsQuery.calls).toContainEqual(["eq", ["game_result_id", "r1"]])
    expect(actionsQuery.calls).toContainEqual(["eq", ["user_id", USER]])
  })

  it("comes with the rank points of a game that counted for the rank", async () => {
    tables({ game_participants: [seat(true), { data: [{ actions: 31 }], error: null }], rating_changes: [{ data: { points_before: 100, points_after: 118 }, error: null }] })
    expect(await readRankChange(TABLE)).toEqual({ recorded: true, ranked: true, points: 18, xp: 31 })
  })

  it("adds the actions of every seat the account held, and reads a figure the database sends as text", async () => {
    tables({ game_participants: [seat(false), { data: [{ actions: 5 }, { actions: "7" }], error: null }] })
    expect((await readRankChange(TABLE)).xp).toBe(12)
  })

  it("is 0 for a game where the member played no action", async () => {
    tables({ game_participants: [seat(false), { data: [{ actions: 0 }], error: null }] })
    expect((await readRankChange(TABLE)).xp).toBe(0)
  })

  it("is not known where the actions cannot be read (the migration is not applied yet), and the rank points are not lost for that", async () => {
    tables({
      game_participants: [seat(true), { data: null, error: { code: "42703", message: "column game_participants.actions does not exist" } }],
      rating_changes: [{ data: { points_before: 100, points_after: 89 }, error: null }],
    })
    expect(await readRankChange(TABLE)).toEqual({ recorded: true, ranked: true, points: -11, xp: null })
  })

  it("is not known while the game is not written down, and without asking for the actions of an account that is no user of the database", async () => {
    tables({ game_participants: [{ data: [], error: null }] })
    expect(await readRankChange(TABLE)).toEqual(NO_RANK_CHANGE)
    mocks.from.mockClear()
    expect(await readRankChange({ ...TABLE, userId: "demo" })).toEqual(NO_RANK_CHANGE)
    expect(mocks.from).not.toHaveBeenCalled()
  })
})
