import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * The nightly clean-up against an in-memory database and bucket. What is faked is the Supabase client: a query applies the filters it is
 * given (`lt`, `in`, `not`, `order`, `limit`) to the rows of its table, so a clean-up that measured the wrong column, or the wrong side of the
 * cutoff, would delete the wrong rows here. `h.log` keeps what was asked of the database and of the bucket, in order.
 */

type Row = Record<string, unknown>

const h = vi.hoisted(() => ({
  tables: { games: [] as Row[], feedback: [] as Row[], member_presence: [] as Row[], friend_requests: [] as Row[] } as Record<string, Row[]>,
  /** What `due_account_deletions` answers: the accounts whose day has passed, with their address */
  due: [] as Array<{ user_id: string; email: string | null }>,
  /** The accounts `erase_account` was asked to delete, in order, each with the day it was asked to wait for */
  erased: [] as string[],
  /** The paths of the objects in the `feedback` bucket */
  objects: new Set<string>(),
  log: [] as string[],
  fail: { games: null as string | null, presence: null as string | null, friendRequests: null as { message: string; code?: string } | null, removal: null as string | null, removalCall: 1, feedbackDelete: null as string | null, silentDelete: false, rpc: {} as Record<string, string>, erase: {} as Record<string, string>, eraseGone: [] as string[] },
  /** What each clean-up function of the database answers, one answer for each call: how many rows it deleted */
  rpcAnswers: {} as Record<string, number[]>,
  removals: 0,
  /** Runs once, right before the next delete looks for its rows: another run of the job that gets there first */
  beforeDelete: null as (() => void) | null,
}))

vi.mock("server-only", () => ({}))
vi.mock("./supabase", () => {
  class Query {
    private action: "select" | "delete" = "select"
    private options: { count?: string; head?: boolean } = {}
    private matches: Array<(row: Row) => boolean> = []
    private sort: string | null = null
    private max = Infinity
    constructor(private table: string) {}
    select(_columns: string, options: { count?: string; head?: boolean } = {}) {
      this.options = options
      return this
    }
    delete(options: { count?: string } = {}) {
      this.action = "delete"
      this.options = options
      return this
    }
    lt(column: string, value: string) {
      this.matches.push((row) => String(row[column]) < value)
      return this
    }
    /** `ilike` with the escapes PostgREST passes to Postgres: `\\` makes the next character plain, `%` is any run of characters and `_` any one */
    ilike(column: string, pattern: string) {
      let source = ""
      for (let i = 0; i < pattern.length; i++) {
        const character = pattern[i]!
        if (character === "\\") source += (pattern[++i] ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        else if (character === "%") source += ".*"
        else if (character === "_") source += "."
        else source += character.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      }
      const expression = new RegExp(`^${source}$`, "i")
      this.matches.push((row) => typeof row[column] === "string" && expression.test(row[column] as string))
      return this
    }
    in(column: string, values: unknown[]) {
      this.matches.push((row) => values.includes(row[column]))
      return this
    }
    not(column: string, operator: string, value: unknown) {
      if (operator !== "is" || value !== null) throw new Error(`the fake only knows .not(column, "is", null), got ${operator}`)
      this.matches.push((row) => row[column] !== null && row[column] !== undefined)
      return this
    }
    order(column: string) {
      this.sort = column
      return this
    }
    limit(count: number) {
      this.max = count
      return this
    }
    then(resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) {
      return Promise.resolve(this.run()).then(resolve, reject)
    }
    private run() {
      if (this.action === "delete" && this.table === "feedback" && h.beforeDelete) {
        const hook = h.beforeDelete
        h.beforeDelete = null
        hook()
      }
      const found = (h.tables[this.table] ?? []).filter((row) => this.matches.every((match) => match(row)))
      if (this.table === "friend_requests" && h.fail.friendRequests) return { data: null, error: { ...h.fail.friendRequests }, count: null }
      if (this.action === "delete") {
        h.log.push(`delete ${this.table} ${found.map((row) => String(row.id ?? row.code ?? row.user_id ?? row.sender)).join(",")}`)
        const failure = this.table === "games" ? h.fail.games : this.table === "member_presence" ? h.fail.presence : this.table === "feedback" ? h.fail.feedbackDelete : null
        if (failure) return { data: null, error: { message: failure }, count: null }
        if (h.fail.silentDelete && this.table === "feedback") return { data: null, error: null, count: 0 }
        h.tables[this.table] = (h.tables[this.table] ?? []).filter((row) => !found.includes(row))
        return { data: null, error: null, count: found.length }
      }
      h.log.push(`select ${this.table}${this.options.head ? " (count)" : ""}`)
      const sorted = this.sort ? [...found].sort((a, b) => String(a[this.sort!]).localeCompare(String(b[this.sort!]))) : found
      return { data: this.options.head ? null : sorted.slice(0, this.max).map((row) => structuredClone(row)), error: null, count: this.options.count ? found.length : null }
    }
  }
  const db = {
    from: (table: string) => new Query(table),
    rpc: async (name: string, args: Record<string, unknown>) => {
      // The deletion of accounts (PLT-36): its own functions and its own lines, apart from the sweeps of the games played
      if (name === "due_account_deletions") {
        h.log.push(`account due ${args.p_before} ${args.p_limit}`)
        const failure = h.fail.rpc[name]
        return failure ? { data: null, error: { message: failure } } : { data: h.due.slice(0, Number(args.p_limit)).map((row) => ({ ...row })), error: null }
      }
      if (name === "erase_account") {
        const user = String(args.p_user)
        h.log.push(`account erase ${user} ${args.p_due_before}`)
        const failure = h.fail.erase[user]
        if (failure) return { data: null, error: { message: failure } }
        if (h.fail.eraseGone.includes(user)) return { data: false, error: null }
        h.erased.push(user)
        return { data: true, error: null }
      }
      h.log.push(`rpc ${name} ${args.p_before} ${args.p_limit} ${args.p_dry}`)
      const failure = h.fail.rpc[name]
      if (failure) return { data: null, error: { message: failure } }
      return { data: h.rpcAnswers[name]?.shift() ?? 0, error: null }
    },
    storage: {
      from: (bucket: string) => ({
        remove: async (paths: string[]) => {
          h.log.push(`remove ${bucket} ${paths.join(" ")}`)
          h.removals++
          if (h.fail.removal && h.removals >= h.fail.removalCall) return { data: null, error: { message: h.fail.removal } }
          return { data: paths.filter((path) => h.objects.delete(path)).map((name) => ({ name })), error: null }
        },
      }),
    },
  }
  return { supabaseAdmin: () => db }
})

import { FOLD_BATCH_SIZE, PURGE_BATCH_SIZE, PURGE_MAX_BATCHES, STATE_BATCH_SIZE, SWEEP_MAX_BATCHES, purgeExpired } from "./retention"

const NOW = new Date("2026-11-06T12:00:00.000Z")
const DAY = 24 * 60 * 60 * 1000
const daysAgo = (days: number) => new Date(NOW.getTime() - days * DAY).toISOString()
/** A table of `game`, last written `updatedDaysAgo` days ago (created `createdDaysAgo` ago, by default at the same time) */
const table = (game: string, code: string, updatedDaysAgo: number, createdDaysAgo = updatedDaysAgo, extra: Row = {}): Row => ({
  game,
  code,
  status: "playing",
  created_at: daysAgo(createdDaysAgo),
  updated_at: daysAgo(updatedDaysAgo),
  ...extra,
})
/** A feedback received at `createdAt`, with its screenshot (which is in the bucket) unless `screenshot` is null */
const feedback = (id: string, createdAt: string, screenshot: string | null = `courtisans/${id}.webp`, extra: Row = {}): Row => {
  if (screenshot) h.objects.add(screenshot)
  return { id, game: "courtisans", created_at: createdAt, screenshot, status: "new", ...extra }
}
/** A member last seen `seenDaysAgo` days ago (a fraction of a day is fine) */
const member = (userId: string, seenDaysAgo: number): Row => ({ user_id: userId, seen_at: daysAgo(seenDaysAgo) })
const codes = () => h.tables.games!.map((row) => row.code)
const ids = () => h.tables.feedback!.map((row) => row.id)
const users = () => h.tables.member_presence!.map((row) => row.user_id)

// 12 months before NOW, to the millisecond
const YEAR_AGO = "2025-11-06T12:00:00.000Z"

beforeEach(() => {
  h.tables.games = []
  h.tables.feedback = []
  h.tables.member_presence = []
  h.tables.friend_requests = []
  h.objects.clear()
  h.log.length = 0
  h.fail.games = null
  h.fail.presence = null
  h.fail.friendRequests = null
  h.fail.removal = null
  h.fail.removalCall = 1
  h.fail.feedbackDelete = null
  h.fail.silentDelete = false
  h.fail.rpc = {}
  h.fail.erase = {}
  h.fail.eraseGone = []
  h.due = []
  h.erased = []
  h.rpcAnswers = {}
  h.removals = 0
  h.beforeDelete = null
})

describe("tables", () => {
  it("deletes the tables last written more than 30 days ago, whatever their game and status", async () => {
    h.tables.games = [
      table("courtisans", "AAAA", 31),
      table("skyjo", "BBBB", 45, 45, { status: "over" }),
      table("hanabi", "CCCC", 100, 100, { status: "lobby" }),
      table("courtisans", "DDDD", 29),
    ]
    const report = await purgeExpired({ now: NOW })
    expect(codes()).toEqual(["DDDD"])
    expect(report).toMatchObject({ dryRun: false, tables: 3, errors: [] })
  })

  it("keeps a table with a recent move or join, however old it is", async () => {
    h.tables.games = [table("courtisans", "AAAA", 3, 200), table("courtisans", "BBBB", 29, 400)]
    const report = await purgeExpired({ now: NOW })
    expect(codes()).toEqual(["AAAA", "BBBB"])
    expect(report.tables).toBe(0)
  })

  it("keeps a table written exactly 30 days ago and deletes one written a millisecond earlier", async () => {
    const edge = table("courtisans", "AAAA", 30)
    const older = { ...table("courtisans", "BBBB", 30), updated_at: new Date(NOW.getTime() - 30 * DAY - 1).toISOString() }
    h.tables.games = [edge, older]
    await purgeExpired({ now: NOW })
    expect(codes()).toEqual(["AAAA"])
  })

  it("measures from updated_at only: a player seen yesterday at a table nobody has written to for 40 days does not keep it", async () => {
    h.tables.games = [table("courtisans", "AAAA", 40, 40, { seen: { p1: daysAgo(1) } })]
    await purgeExpired({ now: NOW })
    expect(codes()).toEqual([])
  })

  it("does nothing the second time", async () => {
    h.tables.games = [table("courtisans", "AAAA", 31), table("courtisans", "BBBB", 2)]
    await purgeExpired({ now: NOW })
    const second = await purgeExpired({ now: NOW })
    expect(second.tables).toBe(0)
    expect(codes()).toEqual(["BBBB"])
  })

  it("tells the moments it measured against", async () => {
    const report = await purgeExpired({ now: NOW })
    expect(report.cutoffs).toEqual({ tables: daysAgo(30), feedback: YEAR_AGO, presence: daysAgo(1), states: daysAgo(1), seats: YEAR_AGO, friendRequests: daysAgo(30) })
  })
})

describe("presence", () => {
  it("deletes the members last seen more than a day ago and keeps the others", async () => {
    h.tables.member_presence = [member("a", 2), member("b", 0.5), member("c", 30), member("d", 0)]
    const report = await purgeExpired({ now: NOW })
    expect(users()).toEqual(["b", "d"])
    expect(report).toMatchObject({ presence: 2, errors: [] })
  })

  it("keeps a member seen exactly a day ago and deletes one seen a millisecond earlier", async () => {
    const older = { user_id: "older", seen_at: new Date(NOW.getTime() - DAY - 1).toISOString() }
    h.tables.member_presence = [member("edge", 1), older]
    await purgeExpired({ now: NOW })
    expect(users()).toEqual(["edge"])
  })

  it("does nothing the second time", async () => {
    h.tables.member_presence = [member("a", 3), member("b", 0)]
    await purgeExpired({ now: NOW })
    expect((await purgeExpired({ now: NOW })).presence).toBe(0)
    expect(users()).toEqual(["b"])
  })

  it("runs on its own: a failure here does not hold the tables or the feedback back, and says so", async () => {
    h.tables.games = [table("courtisans", "AAAA", 31)]
    h.tables.feedback = [feedback("f1", "2025-01-01T00:00:00.000Z")]
    h.tables.member_presence = [member("a", 3)]
    h.fail.presence = "relation public.member_presence does not exist"
    const report = await purgeExpired({ now: NOW })
    expect(report.errors).toEqual(["presence: relation public.member_presence does not exist"])
    expect(codes()).toEqual([])
    expect(ids()).toEqual([])
    expect(users()).toEqual(["a"])
  })
})

/** A friend request sent `sentDaysAgo` days ago */
const request = (sender: string, recipient: string, sentDaysAgo: number): Row => ({ sender, recipient, created_at: daysAgo(sentDaysAgo) })
const senders = () => h.tables.friend_requests!.map((row) => row.sender)

describe("friend requests", () => {
  it("deletes the requests that waited more than 30 days and keeps the others", async () => {
    h.tables.friend_requests = [request("a", "b", 31), request("c", "d", 29), request("e", "f", 90), request("g", "h", 0)]
    const report = await purgeExpired({ now: NOW })
    expect(senders()).toEqual(["c", "g"])
    expect(report).toMatchObject({ friendRequests: 2, errors: [] })
  })

  it("keeps a request that waited exactly 30 days and deletes one that waited a millisecond more", async () => {
    const older = { sender: "older", recipient: "x", created_at: new Date(NOW.getTime() - 30 * DAY - 1).toISOString() }
    h.tables.friend_requests = [request("edge", "x", 30), older]
    await purgeExpired({ now: NOW })
    expect(senders()).toEqual(["edge"])
  })

  it("does nothing the second time", async () => {
    h.tables.friend_requests = [request("a", "b", 40), request("c", "d", 1)]
    await purgeExpired({ now: NOW })
    expect((await purgeExpired({ now: NOW })).friendRequests).toBe(0)
    expect(senders()).toEqual(["c"])
  })

  it("counts what it would delete and deletes nothing in a dry run", async () => {
    h.tables.friend_requests = [request("a", "b", 40), request("c", "d", 1)]
    const report = await purgeExpired({ now: NOW, dryRun: true })
    expect(report).toMatchObject({ dryRun: true, friendRequests: 1, errors: [] })
    expect(senders()).toEqual(["a", "c"])
  })

  it("runs on its own: a failure here does not hold the tables back, and says so", async () => {
    h.tables.games = [table("courtisans", "AAAA", 31)]
    h.tables.friend_requests = [request("a", "b", 40)]
    h.fail.friendRequests = { message: "canceling statement due to statement timeout", code: "57014" }
    const report = await purgeExpired({ now: NOW })
    expect(report.errors).toEqual(["friendRequests: canceling statement due to statement timeout"])
    expect(codes()).toEqual([])
    expect(senders()).toEqual(["a"])
  })

  it("has none to delete where migration 0017 is not applied yet, and says nothing of it", async () => {
    h.fail.friendRequests = { message: "relation public.friend_requests does not exist", code: "42P01" }
    const report = await purgeExpired({ now: NOW })
    expect(report).toMatchObject({ friendRequests: 0, errors: [] })
  })
})

describe("feedback", () => {
  it("removes the screenshot from the bucket before it deletes the row", async () => {
    h.tables.feedback = [feedback("f1", "2025-10-01T08:00:00.000Z")]
    const report = await purgeExpired({ now: NOW })
    expect(h.objects.size).toBe(0)
    expect(ids()).toEqual([])
    expect(report).toMatchObject({ feedback: 1, screenshots: 1, errors: [] })
    const log = h.log.filter((line) => line.startsWith("remove") || line.startsWith("delete feedback"))
    expect(log).toEqual(["remove feedback courtisans/f1.webp", "delete feedback f1"])
  })

  it("deletes a feedback without a screenshot without asking the bucket", async () => {
    h.tables.feedback = [feedback("f1", "2025-10-01T08:00:00.000Z", null)]
    const report = await purgeExpired({ now: NOW })
    expect(ids()).toEqual([])
    expect(report).toMatchObject({ feedback: 1, screenshots: 0 })
    expect(h.log.some((line) => line.startsWith("remove"))).toBe(false)
  })

  it("keeps a feedback received less than 12 months ago, with its screenshot", async () => {
    h.tables.feedback = [feedback("f1", "2026-10-25T08:00:00.000Z"), feedback("f2", "2025-11-07T00:00:00.000Z")]
    const report = await purgeExpired({ now: NOW })
    expect(ids()).toEqual(["f1", "f2"])
    expect([...h.objects].sort()).toEqual(["courtisans/f1.webp", "courtisans/f2.webp"])
    expect(report).toMatchObject({ feedback: 0, screenshots: 0 })
  })

  it("keeps a feedback received exactly 12 months ago and deletes one received a millisecond earlier", async () => {
    h.tables.feedback = [feedback("edge", YEAR_AGO), feedback("older", "2025-11-06T11:59:59.999Z")]
    await purgeExpired({ now: NOW })
    expect(ids()).toEqual(["edge"])
    expect([...h.objects]).toEqual(["courtisans/edge.webp"])
  })

  it("deletes the old feedback of every game, whatever its status", async () => {
    h.tables.feedback = [
      feedback("f1", "2025-01-01T00:00:00.000Z", "skyjo/f1.webp", { game: "skyjo", status: "archived" }),
      feedback("f2", "2025-02-01T00:00:00.000Z", null, { game: "hanabi", status: "read" }),
      feedback("f3", "2026-09-01T00:00:00.000Z"),
    ]
    await purgeExpired({ now: NOW })
    expect(ids()).toEqual(["f3"])
  })

  it("goes through a backlog in batches, each batch removing its screenshots first", async () => {
    h.tables.feedback = Array.from({ length: 250 }, (_, i) => feedback(`f${String(i).padStart(3, "0")}`, `2025-01-01T00:${String(i % 60).padStart(2, "0")}:00.000Z`))
    const report = await purgeExpired({ now: NOW })
    expect(ids()).toEqual([])
    expect(h.objects.size).toBe(0)
    expect(report).toMatchObject({ feedback: 250, screenshots: 250, errors: [] })
    expect(h.log.filter((line) => line.startsWith("remove"))).toHaveLength(3)
  })

  it("stops after a bounded number of batches, and the next run finishes", async () => {
    const backlog = PURGE_BATCH_SIZE * PURGE_MAX_BATCHES + 30
    h.tables.feedback = Array.from({ length: backlog }, (_, i) => feedback(`f${i}`, "2025-01-01T00:00:00.000Z", null))
    const first = await purgeExpired({ now: NOW })
    expect(first.feedback).toBe(PURGE_BATCH_SIZE * PURGE_MAX_BATCHES)
    expect(h.tables.feedback).toHaveLength(30)
    const second = await purgeExpired({ now: NOW })
    expect(second.feedback).toBe(30)
    expect(h.tables.feedback).toHaveLength(0)
  })

  it("keeps the row, and says so, when its screenshot cannot be removed", async () => {
    h.tables.feedback = [feedback("f1", "2025-01-01T00:00:00.000Z")]
    h.fail.removal = "storage is down"
    const report = await purgeExpired({ now: NOW })
    expect(ids()).toEqual(["f1"])
    expect(h.objects.size).toBe(1)
    expect(report.errors).toEqual(["feedback: storage is down"])
    // tomorrow's run finds it again
    h.fail.removal = null
    expect((await purgeExpired({ now: NOW })).feedback).toBe(1)
    expect(h.objects.size).toBe(0)
  })

  it("says what it did before a failure: the batches that went stay counted", async () => {
    h.tables.feedback = Array.from({ length: PURGE_BATCH_SIZE + 5 }, (_, i) => feedback(`f${String(i).padStart(3, "0")}`, `2025-01-01T00:00:${String(i % 60).padStart(2, "0")}.000Z`))
    h.fail.removal = "storage went away"
    h.fail.removalCall = 2
    const report = await purgeExpired({ now: NOW })
    expect(report).toMatchObject({ feedback: PURGE_BATCH_SIZE, screenshots: PURGE_BATCH_SIZE, errors: ["feedback: storage went away"] })
    expect(h.tables.feedback).toHaveLength(5)
  })

  it("reports a row that cannot be deleted, after its screenshot went (a second removal finds nothing and is fine)", async () => {
    h.tables.feedback = [feedback("f1", "2025-01-01T00:00:00.000Z")]
    h.fail.feedbackDelete = "permission denied"
    const report = await purgeExpired({ now: NOW })
    expect(report.errors).toEqual(["feedback: permission denied"])
    expect(ids()).toEqual(["f1"])
    h.fail.feedbackDelete = null
    expect((await purgeExpired({ now: NOW })).errors).toEqual([])
    expect(ids()).toEqual([])
  })
})

describe("the states of the tables that are over", () => {
  it("asks the database to delete those that were last written a day ago, with the cutoff of the run", async () => {
    h.rpcAnswers.drop_finished_states = [3]
    const report = await purgeExpired({ now: NOW })
    expect(report).toMatchObject({ states: 3, errors: [] })
    expect(h.log).toContain(`rpc drop_finished_states ${daysAgo(1)} ${STATE_BATCH_SIZE} false`)
  })

  it("goes on while a batch is full and stops at the first that is not", async () => {
    h.rpcAnswers.drop_finished_states = [STATE_BATCH_SIZE, STATE_BATCH_SIZE, 20, 999]
    const report = await purgeExpired({ now: NOW })
    expect(report.states).toBe(STATE_BATCH_SIZE * 2 + 20)
    expect(h.log.filter((line) => line.startsWith("rpc drop_finished_states"))).toHaveLength(3)
  })

  it("stops after a bounded number of batches, and the next run finishes", async () => {
    h.rpcAnswers.drop_finished_states = Array.from({ length: SWEEP_MAX_BATCHES + 5 }, () => STATE_BATCH_SIZE)
    const report = await purgeExpired({ now: NOW })
    expect(report.states).toBe(STATE_BATCH_SIZE * SWEEP_MAX_BATCHES)
    expect(h.log.filter((line) => line.startsWith("rpc drop_finished_states"))).toHaveLength(SWEEP_MAX_BATCHES)
  })

  it("runs on its own: a failure here is reported and holds nothing else back", async () => {
    h.tables.games = [table("courtisans", "AAAA", 31)]
    h.tables.feedback = [feedback("f1", "2025-01-01T00:00:00.000Z")]
    h.fail.rpc.drop_finished_states = "function public.drop_finished_states does not exist"
    h.rpcAnswers.fold_old_results = [4]
    const report = await purgeExpired({ now: NOW })
    expect(report.errors).toEqual(["states: function public.drop_finished_states does not exist"])
    expect(report).toMatchObject({ states: 0, seats: 4, tables: 1, feedback: 1 })
    expect(codes()).toEqual([])
    expect(ids()).toEqual([])
  })
})

describe("the seats of the old unranked games", () => {
  it("asks the database to fold those of the games that ended a year ago, with the cutoff of the run", async () => {
    h.rpcAnswers.fold_old_results = [12]
    const report = await purgeExpired({ now: NOW })
    expect(report).toMatchObject({ seats: 12, errors: [] })
    expect(h.log).toContain(`rpc fold_old_results ${YEAR_AGO} ${FOLD_BATCH_SIZE} false`)
  })

  it("goes through a backlog in batches, a bounded number of them a night", async () => {
    h.rpcAnswers.fold_old_results = [FOLD_BATCH_SIZE, 7]
    expect((await purgeExpired({ now: NOW })).seats).toBe(FOLD_BATCH_SIZE + 7)
    h.log.length = 0
    h.rpcAnswers.fold_old_results = Array.from({ length: SWEEP_MAX_BATCHES + 5 }, () => FOLD_BATCH_SIZE)
    expect((await purgeExpired({ now: NOW })).seats).toBe(FOLD_BATCH_SIZE * SWEEP_MAX_BATCHES)
    expect(h.log.filter((line) => line.startsWith("rpc fold_old_results"))).toHaveLength(SWEEP_MAX_BATCHES)
  })

  it("reports a refusal of the database, and the states are still dropped", async () => {
    h.fail.rpc.fold_old_results = "permission denied for function fold_old_results"
    h.rpcAnswers.drop_finished_states = [2]
    const report = await purgeExpired({ now: NOW })
    expect(report.errors).toEqual(["seats: permission denied for function fold_old_results"])
    expect(report.states).toBe(2)
  })
})

describe("two runs at once (Vercel can call a job twice)", () => {
  it("is not an error when the other run deleted the rows first", async () => {
    h.tables.feedback = [feedback("f1", "2025-01-01T00:00:00.000Z"), feedback("f2", "2025-01-02T00:00:00.000Z", null)]
    h.beforeDelete = () => {
      h.tables.feedback = []
    }
    const report = await purgeExpired({ now: NOW })
    expect(report.errors).toEqual([])
    expect(report).toMatchObject({ feedback: 0, screenshots: 0 })
    expect(ids()).toEqual([])
    expect(h.objects.size).toBe(0)
  })

  it("is an error when a delete removes nothing and the rows are still there", async () => {
    h.tables.feedback = [feedback("f1", "2025-01-01T00:00:00.000Z")]
    h.fail.silentDelete = true
    const report = await purgeExpired({ now: NOW })
    expect(report.errors).toEqual(["feedback: feedback found but not deleted"])
    expect(ids()).toEqual(["f1"])
  })
})

describe("the two jobs", () => {
  it("run on their own: tables that cannot be deleted do not hold the feedback back, and the other way round", async () => {
    h.tables.games = [table("courtisans", "AAAA", 31)]
    h.tables.feedback = [feedback("f1", "2025-01-01T00:00:00.000Z")]
    h.fail.games = "connection reset"
    const tablesDown = await purgeExpired({ now: NOW })
    expect(tablesDown.errors).toEqual(["tables: connection reset"])
    expect(codes()).toEqual(["AAAA"])
    expect(ids()).toEqual([])

    h.tables.feedback = [feedback("f2", "2025-01-01T00:00:00.000Z")]
    h.fail.games = null
    h.fail.removal = "storage is down"
    const feedbackDown = await purgeExpired({ now: NOW })
    expect(feedbackDown.errors).toEqual(["feedback: storage is down"])
    expect(codes()).toEqual([])
    expect(ids()).toEqual(["f2"])
  })
})

describe("a dry run", () => {
  it("deletes nothing and counts what a real run would delete", async () => {
    h.tables.games = [table("courtisans", "AAAA", 31), table("courtisans", "BBBB", 5)]
    h.tables.feedback = [feedback("f1", "2025-01-01T00:00:00.000Z"), feedback("f2", "2025-01-02T00:00:00.000Z", null), feedback("f3", "2026-10-25T00:00:00.000Z")]
    h.tables.member_presence = [member("a", 3), member("b", 0)]
    const report = await purgeExpired({ now: NOW, dryRun: true })
    expect(report).toMatchObject({ dryRun: true, tables: 1, feedback: 2, screenshots: 1, presence: 1, errors: [] })
    expect(users()).toEqual(["a", "b"])
    expect(codes()).toEqual(["AAAA", "BBBB"])
    expect(ids()).toEqual(["f1", "f2", "f3"])
    expect(h.objects.size).toBe(2)
    expect(h.log.some((line) => line.startsWith("delete") || line.startsWith("remove"))).toBe(false)
    const real = await purgeExpired({ now: NOW })
    expect(real).toMatchObject({ dryRun: false, tables: 1, feedback: 2, screenshots: 1, presence: 1 })
  })

  it("asks the database to count the states and the seats once each, without deleting them", async () => {
    h.rpcAnswers.drop_finished_states = [STATE_BATCH_SIZE * 3]
    h.rpcAnswers.fold_old_results = [FOLD_BATCH_SIZE * 2]
    const report = await purgeExpired({ now: NOW, dryRun: true })
    expect(report).toMatchObject({ dryRun: true, states: STATE_BATCH_SIZE * 3, seats: FOLD_BATCH_SIZE * 2, errors: [] })
    expect(h.log.filter((line) => line.startsWith("rpc"))).toEqual([`rpc drop_finished_states ${daysAgo(1)} ${STATE_BATCH_SIZE} true`, `rpc fold_old_results ${YEAR_AGO} ${FOLD_BATCH_SIZE} true`])
  })
})

describe("the closed accounts whose day has passed (PLT-36)", () => {
  const due = (userId: string, email: string | null) => ({ user_id: userId, email })
  const steps = () => h.log.filter((line) => /^(remove|delete feedback|account erase)/.test(line))

  it("deletes the feedback sent with the address of the account, screenshot first, then the account", async () => {
    h.due = [due("u1", "ann@example.com")]
    h.tables.feedback = [
      feedback("f1", "2026-10-01T00:00:00.000Z", "courtisans/f1.webp", { email: "ann@example.com" }),
      feedback("f2", "2026-10-02T00:00:00.000Z", null, { email: "Ann@Example.com" }),
      feedback("f3", "2026-10-03T00:00:00.000Z", "courtisans/f3.webp", { email: "bob@example.com" }),
      feedback("f4", "2026-10-04T00:00:00.000Z", null, { email: null }),
    ]
    const report = await purgeExpired({ now: NOW })
    expect(ids()).toEqual(["f3", "f4"])
    expect([...h.objects]).toEqual(["courtisans/f3.webp"])
    expect(h.erased).toEqual(["u1"])
    expect(report).toMatchObject({ accounts: 1, accountFeedback: 2, screenshots: 1, errors: [] })
    expect(steps()).toEqual(["remove feedback courtisans/f1.webp", "delete feedback f1,f2", `account erase u1 ${NOW.toISOString()}`])
  })

  it("asks for the accounts whose day is before now, 20 at most in a run, and passes the same moment to each deletion so that an account reopened in the meantime is not deleted", async () => {
    h.due = Array.from({ length: 25 }, (_, i) => due(`u${String(i).padStart(2, "0")}`, null))
    const report = await purgeExpired({ now: NOW })
    expect(report).toMatchObject({ accounts: 20, errors: [] })
    expect(h.erased).toHaveLength(20)
    expect(h.log).toContain(`account due ${NOW.toISOString()} 20`)
    expect(h.log.filter((line) => line.startsWith("account erase")).every((line) => line.endsWith(NOW.toISOString()))).toBe(true)
  })

  it("matches the address and nothing else: no wildcard, whatever the case", async () => {
    h.due = [due("u1", "a_b@example.com")]
    h.tables.feedback = [
      feedback("f1", "2026-10-01T00:00:00.000Z", null, { email: "a_b@example.com" }),
      feedback("f2", "2026-10-02T00:00:00.000Z", null, { email: "aXb@example.com" }),
      feedback("f3", "2026-10-03T00:00:00.000Z", null, { email: "a%b@example.com" }),
      feedback("f4", "2026-10-04T00:00:00.000Z", null, { email: "A_B@EXAMPLE.COM" }),
      feedback("f5", "2026-10-05T00:00:00.000Z", null, { email: "xa_b@example.com" }),
    ]
    await purgeExpired({ now: NOW })
    expect(ids()).toEqual(["f2", "f3", "f5"])
  })

  it("looks for no feedback when the account has no address that mail can reach, and deletes the account all the same", async () => {
    h.due = [due("u1", null), due("u2", "steam-3f2b8c1e@external.pbgo.invalid")]
    h.tables.feedback = [feedback("f1", "2026-10-01T00:00:00.000Z", null, { email: "steam-3f2b8c1e@external.pbgo.invalid" })]
    const report = await purgeExpired({ now: NOW })
    expect(h.erased).toEqual(["u1", "u2"])
    expect(ids()).toEqual(["f1"])
    expect(report).toMatchObject({ accounts: 2, accountFeedback: 0 })
  })

  it("keeps the account for the next night when its feedback cannot be deleted: nothing would link what is left to it afterwards", async () => {
    h.due = [due("u1", "ann@example.com")]
    h.tables.feedback = [feedback("f1", "2026-10-01T00:00:00.000Z", "courtisans/f1.webp", { email: "ann@example.com" })]
    h.fail.removal = "bucket unreachable"
    const report = await purgeExpired({ now: NOW })
    expect(h.erased).toEqual([])
    expect(ids()).toEqual(["f1"])
    expect(report).toMatchObject({ accounts: 0, errors: ["accounts: bucket unreachable"] })
  })

  it("goes on with the other accounts when one fails, and says what failed without saying whose account it was", async () => {
    h.due = [due("u1", null), due("u2", null), due("u3", null)]
    h.fail.erase.u2 = "deadlock detected"
    const report = await purgeExpired({ now: NOW })
    expect(h.erased).toEqual(["u1", "u3"])
    expect(report).toMatchObject({ accounts: 2, errors: ["accounts: erase_account: deadlock detected"] })
    expect(JSON.stringify(report)).not.toContain("u2")
  })

  it("counts only the accounts that were found: one reopened in the meantime is answered as not deleted", async () => {
    h.due = [due("u1", null), due("u2", null)]
    h.fail.eraseGone = ["u2"]
    const report = await purgeExpired({ now: NOW })
    expect(report).toMatchObject({ accounts: 1, errors: [] })
  })

  it("only counts them in a dry run: no feedback, no account is touched", async () => {
    h.due = [due("u1", "ann@example.com"), due("u2", null)]
    h.tables.feedback = [feedback("f1", "2026-10-01T00:00:00.000Z", "courtisans/f1.webp", { email: "ann@example.com" })]
    const report = await purgeExpired({ now: NOW, dryRun: true })
    expect(report).toMatchObject({ dryRun: true, accounts: 2, accountFeedback: 0, errors: [] })
    expect(h.erased).toEqual([])
    expect(ids()).toEqual(["f1"])
    expect(h.log).toContain(`account due ${NOW.toISOString()} 1000`)
  })

  it("is reported when the list cannot be read, and the other jobs go on", async () => {
    h.fail.rpc.due_account_deletions = "function public.due_account_deletions does not exist"
    h.tables.feedback = [feedback("f1", "2025-01-01T00:00:00.000Z")]
    const report = await purgeExpired({ now: NOW })
    expect(report.errors).toEqual(["accounts: due_account_deletions: function public.due_account_deletions does not exist"])
    expect(ids()).toEqual([])
  })

  it("does nothing when no account is due", async () => {
    const report = await purgeExpired({ now: NOW })
    expect(report).toMatchObject({ accounts: 0, accountFeedback: 0, errors: [] })
    expect(h.erased).toEqual([])
  })
})
