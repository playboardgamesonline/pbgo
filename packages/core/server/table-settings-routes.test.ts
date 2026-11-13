import { EngineError, type AnyGameDefinition } from "@pbgo/engine-kit"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { NO_AGE_RULES } from "../lib/age-rules"
import type { GameRouteContext } from "../lib/binding"
import { postJoin } from "../routes/api/games/[code]/join/route"
import { POST as settings } from "../routes/api/games/[code]/settings/route"
import { postGame } from "../routes/api/games/route"
import { newPlayerSecret, playerIdOf } from "./player-id"

// PLT-21, phase B: the settings of a table (who may join, the speed, the seats) are kept with it and checked where they matter. The real routes, `player.ts` and `publicGame` run against an in-memory `games` table, as in `player-identity.test.ts`; what is
// faked is the database client (with the column of migration 0014 that can be taken away), the cookie jar and the headers of the browser whose request is served, the account that is signed in, the rank it has and the rate limiter.

const noAges = async () => NO_AGE_RULES
const join = postJoin(noAges)
const create = postGame(noAges)

type StoredRow = {
  game: string
  code: string
  host_id: string
  status: "lobby" | "starting" | "playing" | "over"
  players: Array<{ id: string; nickname: string; avatarUrl?: string }>
  options: Record<string, number | string | boolean>
  state: unknown
  replay: string[]
  takeover_votes: string[]
  seen: Record<string, string>
  version: number
  updated_at: string
  created_at: string
  settings?: unknown
}

type Jar = Map<string, string>

const h = vi.hoisted(() => ({
  rows: new Map<string, unknown>(),
  jar: new Map<string, string>(),
  /** The headers of the request being served (`accept-language`) */
  headers: {} as Record<string, string>,
  /** The signed-in account of the request being served, null for a guest */
  account: null as null | { id: string; nickname: string; avatarUrl: string | null; language: string | null },
  /** The rank the signed-in member has in the game */
  rank: null as null | { tier: string; division?: number },
  /** A project where migration 0014 is not applied: the database refuses everything that names the column */
  noColumn: false,
  broadcasts: [] as Array<{ channel: string; event: string; payload: unknown }>,
  scheduled: [] as Array<() => unknown>,
  settings: { options: { defaults: {}, hidden: [] as string[] }, maxPlayers: 3, minPlayers: 2, turnTimeout: 60 },
}))

vi.mock("server-only", () => ({}))
vi.mock("next/server", () => ({ after: (callback: () => unknown) => void h.scheduled.push(callback) }))
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (h.jar.has(name) ? { name, value: h.jar.get(name)! } : undefined),
    set: (name: string, value: string) => void h.jar.set(name, value),
  }),
  headers: async () => ({ get: (name: string) => h.headers[name.toLowerCase()] ?? null }),
}))
vi.mock("@pbgo/analytics/server", () => ({ track: async () => {} }))
vi.mock("@pbgo/accounts/server", () => ({ getAccount: async () => h.account }))
vi.mock("../sanity/client", () => ({ sanityClient: () => null }))
vi.mock("../lib/settings-server", () => ({ loadSettings: async () => h.settings }))
vi.mock("../lib/locale-server", () => ({ getLocale: async () => "en" }))
vi.mock("./rate-limit", () => ({ rateLimit: async () => {} }))
vi.mock("./presence", () => ({ markSeen: async () => {}, seatMember: async () => {} }))
vi.mock("./standings", () => ({ readPlayerStanding: async () => ({ rank: h.rank }) }))
vi.mock("./supabase", () => {
  const missing = { code: "42703", message: "column games.settings does not exist" }
  class Filters {
    filters: Record<string, unknown> = {}
    eq(column: string, value: unknown) {
      this.filters[column] = value
      return this
    }
  }
  class Select extends Filters {
    constructor(private columns: string) {
      super()
    }
    async maybeSingle() {
      if (h.noColumn && this.columns.includes("settings")) return { data: null, error: missing }
      const row = h.rows.get(`${this.filters.game}:${this.filters.code}`)
      return { data: row ? structuredClone(row) : null, error: null }
    }
  }
  class Update extends Filters {
    constructor(private patch: Record<string, unknown>) {
      super()
    }
    async select() {
      if (h.noColumn && "settings" in this.patch) return { data: null, error: { code: "PGRST204", message: "Could not find the 'settings' column" } }
      const key = `${this.filters.game}:${this.filters.code}`
      const row = h.rows.get(key) as StoredRow | undefined
      if (!row || row.version !== this.filters.version) return { data: [] as Array<{ code: string }>, error: null }
      h.rows.set(key, { ...row, ...structuredClone(this.patch) })
      return { data: [{ code: row.code }], error: null }
    }
  }
  const db = {
    from: () => ({
      select: (columns = "") => new Select(columns),
      update: (patch: Record<string, unknown>) => new Update(patch),
      insert: async (row: Record<string, unknown>) => {
        if (h.noColumn && "settings" in row) return { error: { code: "PGRST204", message: "Could not find the 'settings' column" } }
        const key = `${row.game}:${row.code}`
        if (h.rows.has(key)) return { error: { code: "23505" } }
        const now = new Date().toISOString()
        h.rows.set(key, { ...structuredClone(row), created_at: now, updated_at: now })
        return { error: null }
      },
    }),
    channel: (channel: string) => ({
      httpSend: async (event: string, payload: unknown) => {
        h.broadcasts.push({ channel, event, payload })
        return { success: true as const }
      },
    }),
  }
  return { supabaseAdmin: () => db }
})

const GAME: AnyGameDefinition = {
  id: "settled",
  name: "Settled",
  minPlayers: 2,
  maxPlayers: 3,
  options: {},
  clientActions: ["play"],
  setup: ({ players }: { players: Array<{ id: string; nickname: string }> }) => ({ players: players.map((player) => player.id) }),
  apply: (state: unknown) => {
    throw new EngineError("INVALID_ACTION")
    return state
  },
  view: () => ({}),
  isOver: () => false,
  waitingFor: () => [],
} as unknown as AnyGameDefinition

const SLUG = "settled"
const COOKIE = "settled_player"
const CODE = "ABC234"
const KEY = `${SLUG}:${CODE}`
const game = { slug: SLUG, name: "Settled", tagline: "", sanityProjectId: "", live: true, indexable: false, binding: { SLUG, NAME: "Settled", GAME } } as unknown as GameRouteContext["game"]

type Answer = { status: number; body: { error?: string; code: string; hostId: string; players: Array<{ id: string; nickname: string }>; version: number } }
type Handler = (request: Request, context: GameRouteContext) => Promise<Response>

async function send(jar: Jar, handler: Handler, body?: unknown, code: string | null = CODE): Promise<Answer> {
  h.jar = jar
  const url = `http://localhost/api/${SLUG}/games${code ? `/${code}` : ""}`
  const response = await handler(new Request(url, body === undefined ? undefined : { method: "POST", body: JSON.stringify(body) }), { game, params: code ? { code } : {} })
  return { status: response.status, body: JSON.parse(await response.text()) }
}

const stored = () => h.rows.get(KEY) as StoredRow

type Person = { nickname: string; id: string; jar: Jar }
function person(nickname: string): Person {
  const secret = newPlayerSecret()
  return { nickname, id: playerIdOf(SLUG, secret), jar: new Map([[COOKIE, secret]]) }
}

/** The table `ABC234` in its lobby, with these people at it, the first being the host. */
function lobby(people: Person[], partial: Partial<StoredRow> = {}): StoredRow {
  const row: StoredRow = {
    game: SLUG,
    code: CODE,
    host_id: people[0]!.id,
    status: "lobby",
    players: people.map(({ id, nickname }) => ({ id, nickname })),
    options: {},
    state: null,
    replay: [],
    takeover_votes: [],
    seen: {},
    version: 1,
    created_at: "2026-01-01T10:00:00.000Z",
    updated_at: "2026-01-01T10:00:00.000Z",
    ...partial,
  }
  h.rows.set(KEY, row)
  return row
}

const input = (over: Record<string, unknown> = {}) => ({ visibility: "public", minRank: null, language: null, pace: "normal", seats: 3, ...over })

beforeEach(() => {
  h.rows.clear()
  h.jar = new Map()
  h.headers = {}
  h.account = null
  h.rank = null
  h.noColumn = false
  h.broadcasts.length = 0
  h.scheduled.length = 0
  h.settings.maxPlayers = 3
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("the host sets a table", () => {
  it("keeps what the panel shows, as one version of the table that the people at it are told of", async () => {
    const ann = person("Ann")
    const bob = person("Bob")
    lobby([ann, bob])
    const answer = await send(ann.jar, settings, { settings: input({ minRank: "Silver", language: "fr", pace: "fast", seats: 2 }) })
    expect(answer.status).toBe(200)
    expect(stored().settings).toEqual({ visibility: "public", minRank: "Silver", language: "fr", pace: "fast", seats: 2 })
    expect(stored().version).toBe(2)
    expect(h.broadcasts).toEqual([{ channel: `game:${SLUG}:${CODE}`, event: "update", payload: { version: 2 } }])
  })

  it("replaces what was kept: a rank or a language that asks for nothing is not written, and making it private keeps the rest", async () => {
    const ann = person("Ann")
    lobby([ann], { settings: { visibility: "public", minRank: "Gold", language: "de", pace: "slow", seats: 2 } })
    await send(ann.jar, settings, { settings: input({ visibility: "private", minRank: null, language: null, pace: "normal", seats: 3 }) })
    expect(stored().settings).toEqual({ visibility: "private", pace: "normal", seats: 3 })
  })

  it("is the host's alone", async () => {
    const ann = person("Ann")
    const bob = person("Bob")
    const row = lobby([ann, bob])
    const answer = await send(bob.jar, settings, { settings: input() })
    expect(answer.status).toBe(403)
    expect(answer.body.error).toBe("HOST_ONLY")
    expect(stored()).toEqual(row)
    expect((await send(new Map(), settings, { settings: input() })).body.error).toBe("HOST_ONLY")
  })

  it("is for a table that waits", async () => {
    const ann = person("Ann")
    const bob = person("Bob")
    for (const status of ["starting", "playing"] as const) {
      lobby([ann, bob], { status })
      const answer = await send(ann.jar, settings, { settings: input() })
      expect(answer.status).toBe(409)
      expect(answer.body.error).toBe("GAME_IN_PROGRESS")
      expect(stored().settings).toBeUndefined()
    }
  })

  it("refuses what is not a setting, and a number of seats the game does not take or that is under the people who sit", async () => {
    const ann = person("Ann")
    const bob = person("Bob")
    const cy = person("Cy")
    lobby([ann, bob, cy])
    for (const [body, error] of [
      [{ settings: input({ visibility: "friends" }) }, "INVALID_REQUEST"],
      [{ settings: input({ minRank: "Apprentice" }) }, "INVALID_REQUEST"],
      [{ settings: input({ language: "en-GB" }) }, "INVALID_REQUEST"],
      [{ settings: input({ pace: "turbo" }) }, "INVALID_REQUEST"],
      [{}, "INVALID_REQUEST"],
      // Three people sit: two seats are under them, and four are over what the game takes
      [{ settings: input({ seats: 2 }) }, "INVALID_PLAYERS"],
      [{ settings: input({ seats: 4 }) }, "INVALID_PLAYERS"],
    ] as const) {
      const answer = await send(ann.jar, settings, body)
      expect([answer.status, answer.body.error]).toEqual([400, error])
    }
    expect(stored().settings).toBeUndefined()
    expect(stored().version).toBe(1)
  })

  it("says so when the database has no place to keep them yet", async () => {
    const ann = person("Ann")
    lobby([ann])
    h.noColumn = true
    const answer = await send(ann.jar, settings, { settings: input() })
    expect(answer.status).toBe(503)
    expect(answer.body.error).toBe("SETTINGS_UNAVAILABLE")
  })
})

describe("a table is opened with settings", () => {
  it("keeps what the host chose before it existed, so that a public table is listed from its first moment", async () => {
    const answer = await send(new Map(), create, { nickname: "Ann", settings: input({ minRank: "Bronze", seats: 2 }) }, null)
    expect(answer.status).toBe(200)
    const row = h.rows.get(`${SLUG}:${answer.body.code}`) as StoredRow
    expect(row.settings).toEqual({ visibility: "public", minRank: "Bronze", pace: "normal", seats: 2 })
  })

  it("opens a private table of the median of the game's players (2 to 3: two) when no settings were sent", async () => {
    const answer = await send(new Map(), create, { nickname: "Ann" }, null)
    expect(answer.status).toBe(200)
    const row = h.rows.get(`${SLUG}:${answer.body.code}`) as StoredRow
    expect(row.settings).toEqual({ visibility: "private", pace: "normal", seats: 2 })
  })

  it("opens nothing when the settings are not valid", async () => {
    for (const body of [{ nickname: "Ann", settings: input({ visibility: "all" }) }, { nickname: "Ann", settings: input({ seats: 9 }) }, { nickname: "Ann", settings: null }]) {
      const answer = await send(new Map(), create, body, null)
      expect(answer.status).toBe(400)
    }
    expect(h.rows.size).toBe(0)
  })

  it("opens the table all the same, private, on a project where the database has no place for the settings yet", async () => {
    h.noColumn = true
    const answer = await send(new Map(), create, { nickname: "Ann", settings: input() }, null)
    expect(answer.status).toBe(200)
    const row = h.rows.get(`${SLUG}:${answer.body.code}`) as StoredRow
    expect(row.players).toHaveLength(1)
    expect("settings" in row).toBe(false)
    expect(console.error).toHaveBeenCalled()
  })
})

describe("a public table asks for something", () => {
  const member = (id: string, nickname: string, language: string | null = null) => ({ id, nickname, avatarUrl: null, language })

  it("is not sat at by a guest when it asks for a rank: a guest has the lowest tier", async () => {
    const ann = person("Ann")
    lobby([ann], { settings: { visibility: "public", minRank: "Bronze" } })
    const answer = await send(new Map(), join, { nickname: "Gus" })
    expect(answer.status).toBe(403)
    expect(answer.body.error).toBe("RANK_TOO_LOW")
    expect(stored().players).toHaveLength(1)
  })

  it("is sat at by a member whose rank in the game is the asked one or over it, and not by one under it", async () => {
    const ann = person("Ann")
    lobby([ann], { settings: { visibility: "public", minRank: "Silver" } })
    h.account = member("0b9f6a52-8c0e-4d6e-9d53-4a1d2f6a7c11", "Bea")
    h.rank = { tier: "Bronze", division: 3 }
    expect((await send(new Map(), join, {})).body.error).toBe("RANK_TOO_LOW")
    // A member who never played the game ranked has no rank: the lowest tier
    h.rank = null
    expect((await send(new Map(), join, {})).body.error).toBe("RANK_TOO_LOW")
    h.rank = { tier: "Silver", division: 1 }
    expect((await send(new Map(), join, {})).status).toBe(200)
    expect(stored().players).toHaveLength(2)
    h.account = member("1c0a7b63-9d1f-4e7f-8e64-5b2e3a7b8d22", "Cal")
    h.rank = { tier: "Legend" }
    expect((await send(new Map(), join, {})).status).toBe(200)
    expect(stored().players).toHaveLength(3)
  })

  it("asks a language of the visitor: their account's, else the cookie's, else their browser's, and English (UK) speaks English", async () => {
    const ann = person("Ann")
    lobby([ann], { settings: { visibility: "public", language: "fr" } })
    h.headers["accept-language"] = "en-US,en;q=0.9"
    const refused = await send(new Map(), join, { nickname: "Gus" })
    expect([refused.status, refused.body.error]).toEqual([403, "LANGUAGE_MISMATCH"])
    // The cookie of the platform's language says French
    const french = new Map([["pbgo-locale", "fr"]])
    expect((await send(french, join, { nickname: "Gus" })).status).toBe(200)
    // An account that keeps French overrides the browser
    h.account = member("0b9f6a52-8c0e-4d6e-9d53-4a1d2f6a7c11", "Bea", "fr")
    expect((await send(new Map(), join, {})).status).toBe(200)

    lobby([ann], { settings: { visibility: "public", language: "en" } })
    h.account = null
    h.headers["accept-language"] = "en-GB,en;q=0.9"
    expect((await send(new Map(), join, { nickname: "Gus" })).status).toBe(200)
  })

  it("is joined by whoever comes when it asks for nothing, and a private table asks for nothing whatever it says", async () => {
    const ann = person("Ann")
    lobby([ann], { settings: { visibility: "public" } })
    expect((await send(new Map(), join, { nickname: "Gus" })).status).toBe(200)
    lobby([ann], { settings: { visibility: "private", minRank: "Legend", language: "fr" } })
    h.headers["accept-language"] = "de"
    expect((await send(new Map(), join, { nickname: "Gus" })).status).toBe(200)
    lobby([ann])
    expect((await send(new Map(), join, { nickname: "Gus" })).status).toBe(200)
  })

  it("never asks a player who sits already again: renaming oneself is not a join", async () => {
    const ann = person("Ann")
    const bob = person("Bob")
    lobby([ann, bob], { settings: { visibility: "public", minRank: "Legend", language: "fr" } })
    const answer = await send(bob.jar, join, { nickname: "Bobby" })
    expect(answer.status).toBe(200)
    expect(stored().players.find((player) => player.id === bob.id)?.nickname).toBe("Bobby")
  })

  it("is full when its seats are taken, though the game takes more", async () => {
    const ann = person("Ann")
    const bob = person("Bob")
    lobby([ann, bob], { settings: { visibility: "private", seats: 2 } })
    const answer = await send(new Map(), join, { nickname: "Gus" })
    expect([answer.status, answer.body.error]).toEqual([409, "GAME_FULL"])
    expect(stored().players).toHaveLength(2)
    // Without settings it takes what the game takes, and the table that has filled begins by itself: the next one finds it begun
    lobby([ann, bob])
    expect((await send(new Map(), join, { nickname: "Gus" })).status).toBe(200)
    expect(stored().status).toBe("starting")
    expect((await send(new Map(), join, { nickname: "Hal" })).body.error).toBe("GAME_IN_PROGRESS")
  })

  it("does not look up the rank or the language of a table that asks for neither", async () => {
    const ann = person("Ann")
    lobby([ann], { settings: { visibility: "public", pace: "fast" } })
    h.rank = { tier: "Legend" }
    // No account, no header: nothing to read, and the join goes through
    expect((await send(new Map(), join, { nickname: "Gus" })).status).toBe(200)
  })
})
