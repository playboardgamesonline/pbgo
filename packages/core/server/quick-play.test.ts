import { AsyncLocalStorage } from "node:async_hooks"
import { type AnyGameDefinition } from "@pbgo/engine-kit"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { NO_AGE_RULES, type AgeRules } from "../lib/age-rules"
import type { GameRouteContext, PlayableGame } from "../lib/binding"
import { parseCancelRequest, parsePlayRequest, type PlayRequest, type PlayState } from "../lib/quick-play"
import { RANK_GAP_STEP_MS } from "../lib/table-settings"
import { POST as ready } from "../routes/api/games/[code]/ready/route"
import { postJoin } from "../routes/api/games/[code]/join/route"
import { postOptions } from "../routes/api/games/[code]/options/route"
import { POST as settingsRoute } from "../routes/api/games/[code]/settings/route"
import { postStart } from "../routes/api/games/[code]/start/route"
import { newPlayerSecret, playerIdOf } from "./player-id"
import { leaveOtherLobbies } from "./table-seat"
import { playCancel, playSearch, type PlayDeps } from "./quick-play"

// PLT-21, phase C: the search of a visitor who presses Play. The real search, routes, `player.ts` and `publicGame` run against an in-memory `games` table, as in `table-settings-routes.test.ts`; what is faked is the database client, the readers of the
// tables that are SQL functions in production (`public_tables`, `member_tables`, `busy_seats`), the cookie jar and the account of the request being served, the ranks, the age rules, the events and the rate limiter. `after` callbacks are kept, and `flush` runs
// them, as the end of a request does.

type StoredRow = {
  game: string
  code: string
  host_id: string
  status: "lobby" | "starting" | "playing" | "over"
  players: Array<{ id: string; nickname: string; avatarUrl?: string; left?: boolean }>
  options: Record<string, number | string | boolean>
  state: unknown
  replay: string[]
  takeover_votes: string[]
  seen: Record<string, string>
  ready_at: Record<string, string>
  ready_deadline: string | null
  version: number
  updated_at: string
  created_at: string
  settings?: Record<string, unknown>
  member_ids?: Record<string, string>
  ranked?: boolean
}

const h = vi.hoisted(() => ({
  rows: new Map<string, unknown>(),
  /** The cookies and the account of the request being served, each request having its own (`als`), so that two at once do not share them */
  als: null as null | { getStore(): { jar: Map<string, string>; account: null | { id: string; nickname: string; avatarUrl: string | null; language: string | null } } | undefined },
  jar: new Map<string, string>(),
  headers: {} as Record<string, string>,
  account: null as null | { id: string; nickname: string; avatarUrl: string | null; language: string | null },
  /** The rank of each member (by account id) in every game */
  ranks: {} as Record<string, { tier: string; division?: number } | null>,
  /** The dates of birth members declared, by account id */
  birthdates: {} as Record<string, string>,
  /** The age rules of each game */
  ages: {} as Record<string, unknown>,
  /** The games' own settings: the seats they take and the options the admin set */
  settings: {} as Record<string, { minPlayers: number; maxPlayers: number; options: { defaults: Record<string, unknown>; hidden: string[] } }>,
  /** The rate limiter refuses to open a table */
  noCreate: false,
  scheduled: [] as Array<() => unknown>,
  events: [] as Array<{ event: string; id: string; properties: Record<string, unknown> }>,
  seen: [] as Array<{ game: string; code: string; seat: string }>,
}))

vi.mock("server-only", () => ({}))
vi.mock("next/server", () => ({ after: (callback: () => unknown) => void h.scheduled.push(callback) }))
vi.mock("next/headers", () => ({
  cookies: async () => {
    const jar = h.als?.getStore()?.jar ?? h.jar
    return { get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined), set: (name: string, value: string) => void jar.set(name, value) }
  },
  headers: async () => ({ get: (name: string) => h.headers[name.toLowerCase()] ?? null }),
}))
vi.mock("@pbgo/analytics/server", () => ({ track: async (event: string, id: string, properties: Record<string, unknown>) => void h.events.push({ event, id, properties }) }))
vi.mock("@pbgo/accounts/server", () => ({ getAccount: async () => (h.als?.getStore() ? h.als.getStore()!.account : h.account) }))
vi.mock("../sanity/client", () => ({ sanityClient: () => null }))
vi.mock("../lib/settings-server", () => ({ loadSettings: async (game: { slug: string }) => h.settings[game.slug] }))
vi.mock("../lib/locale-server", () => ({ getLocale: async () => "en" }))
vi.mock("./rate-limit", async () => {
  const { ApiError } = await import("./api")
  return {
    rateLimit: async (_slug: string | null, _request: Request, name: string) => {
      if (name === "create" && h.noCreate) throw new ApiError("RATE_LIMITED", 429)
    },
  }
})
vi.mock("./presence", () => ({
  markSeen: async (game: { slug: string }, row: { code: string }, seat: string) => void h.seen.push({ game: game.slug, code: row.code, seat }),
  // What the `seat_member` function writes: whose a seat is
  seatMember: async (game: { slug: string }, code: string, seat: string, userId: string | null) => {
    const row = h.rows.get(`${game.slug}:${code}`) as StoredRow | undefined
    if (userId && row) row.member_ids = { ...row.member_ids, [seat]: userId }
  },
}))
vi.mock("./standings", () => ({ readPlayerStanding: async (userId: string) => ({ rank: h.ranks[userId] ?? null }) }))
vi.mock("./birthdate", () => ({ readBirthdates: async (ids: string[]) => new Map(ids.flatMap((id) => (h.birthdates[id] ? [[id, h.birthdates[id]!] as const] : []))) }))
vi.mock("./results", () => ({ markGameStarted: async () => {}, markTakenOver: async () => {}, recordGameResult: async () => {} }))
vi.mock("./tables", async () => {
  const { parseTableSettings } = await import("../lib/table-settings")
  const rows = () => [...h.rows.values()] as StoredRow[]
  const live = (row: StoredRow) => row.status === "lobby" || row.status === "starting" || row.status === "playing"
  const seats = (row: StoredRow) => row.players.filter((player) => !player.left)
  const tableOf = (row: StoredRow, seat: string) => ({ game: row.game, code: row.code, status: row.status, hostId: row.host_id, players: row.players, options: row.options, seat, createdAt: row.created_at, updatedAt: row.updated_at })
  return {
    readPublicTables: async (game: string | null = null) =>
      rows()
        .filter((row) => row.status === "lobby" && row.settings?.visibility === "public" && (game === null || row.game === game))
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map((row) => ({ game: row.game, code: row.code, hostId: row.host_id, players: row.players, options: row.options, settings: parseTableSettings(row.settings), createdAt: row.created_at, updatedAt: row.updated_at })),
    readMemberTables: async (userId: string) =>
      rows().flatMap((row) => {
        const seat = Object.keys(row.member_ids ?? {}).find((key) => row.member_ids![key] === userId && seats(row).some((player) => player.id === key))
        return live(row) && seat ? [tableOf(row, seat)] : []
      }),
    readPlayerTables: async (game: string, playerId: string) => rows().filter((row) => row.game === game && live(row) && seats(row).some((player) => player.id === playerId)).map((row) => tableOf(row, playerId)),
    // The seats of a table that also sit at another table that is starting or being played: the same seat in the same game, or the same account in any game
    busySeats: async (game: { slug: string }, code: string) => {
      const here = h.rows.get(`${game.slug}:${code}`) as StoredRow | undefined
      if (!here) return []
      return seats(here)
        .filter((seat) => {
          const account = here.member_ids?.[seat.id]
          return rows().some(
            (other) =>
              !(other.game === game.slug && other.code === code) &&
              (other.status === "starting" || other.status === "playing") &&
              seats(other).some((player) => (other.game === game.slug && player.id === seat.id) || (account !== undefined && other.member_ids?.[player.id] === account)),
          )
        })
        .map((seat) => seat.id)
    },
  }
})
vi.mock("./supabase", () => {
  class Query {
    filters: Array<[string, unknown]> = []
    lists: Array<[string, unknown[]]> = []
    eq(column: string, value: unknown) {
      this.filters.push([column, value])
      return this
    }
    in(column: string, values: unknown[]) {
      this.lists.push([column, values])
      return this
    }
    matches() {
      return [...h.rows.values()].filter((row) => this.filters.every(([column, value]) => (row as Record<string, unknown>)[column] === value) && this.lists.every(([column, values]) => values.includes((row as Record<string, unknown>)[column]))) as StoredRow[]
    }
  }
  class Select extends Query {
    async maybeSingle() {
      const [row] = this.matches()
      return { data: row ? structuredClone(row) : null, error: null }
    }
    then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) {
      return Promise.resolve({ data: this.matches().map((row) => structuredClone(row)), error: null }).then(resolve, reject)
    }
  }
  class Update extends Query {
    constructor(private patch: Record<string, unknown>) {
      super()
    }
    async select() {
      const [row] = this.matches()
      if (!row) return { data: [] as Array<{ code: string }>, error: null }
      Object.assign(row, structuredClone(this.patch))
      return { data: [{ code: row.code }], error: null }
    }
  }
  class Delete extends Query {
    async select() {
      const found = this.matches()
      for (const row of found) h.rows.delete(`${row.game}:${row.code}`)
      return { data: found.map((row) => ({ code: row.code })), error: null }
    }
  }
  const db = {
    from: () => ({
      select: () => new Select(),
      update: (patch: Record<string, unknown>) => new Update(patch),
      delete: () => new Delete(),
      insert: async (row: Record<string, unknown>) => {
        const key = `${row.game}:${row.code}`
        if (h.rows.has(key)) return { error: { code: "23505" } }
        const now = new Date().toISOString()
        h.rows.set(key, { ...structuredClone(row), created_at: now, updated_at: now })
        return { error: null }
      },
    }),
    channel: () => ({ httpSend: async () => ({ success: true as const }) }),
  }
  return { supabaseAdmin: () => db }
})

const engine = (id: string, minPlayers: number, maxPlayers: number): AnyGameDefinition =>
  ({
    id,
    name: id,
    minPlayers,
    maxPlayers,
    // `hint` is one of the aids of the game: a ranked table is opened with it off
    options: { hint: { type: "boolean", defaultValue: true } },
    clientActions: ["play"],
    setup: ({ players }: { players: Array<{ id: string }> }) => ({ players: players.map((player) => player.id) }),
    apply: (state: unknown) => state,
    view: () => ({}),
    isOver: () => false,
    waitingFor: () => [],
  }) as unknown as AnyGameDefinition

const gameOf = (slug: string, min: number, max: number) => ({ slug, name: slug, tagline: "", sanityProjectId: "", live: true, indexable: false, binding: { SLUG: slug, NAME: slug, GAME: engine(slug, min, max) } }) as unknown as PlayableGame

const GAMES: Record<string, PlayableGame> = { alpha: gameOf("alpha", 2, 4), beta: gameOf("beta", 2, 2), gamma: gameOf("gamma", 3, 3) }
const SLUGS = Object.keys(GAMES)

const deps: PlayDeps = {
  ageRules: async (slug) => (h.ages[slug] as AgeRules | undefined) ?? NO_AGE_RULES,
  loadGame: async (slug) => GAMES[slug] ?? null,
  helpersOf: async (slug) => (slug === "alpha" ? ["hint"] : []),
}

type Account = NonNullable<typeof h.account>
const requests = new AsyncLocalStorage<{ jar: Map<string, string>; account: Account | null }>()
h.als = requests
type Person = { name: string; jar: Map<string, string>; account: Account | null; id: (slug: string) => string }

/** Somebody at a browser: a cookie for each game (so that their seat there is known before they sit), and an account when they are a member. */
function visitor(name: string, account: Account | null = null): Person {
  const secrets = Object.fromEntries(SLUGS.map((slug) => [slug, newPlayerSecret()]))
  return { name, jar: new Map(SLUGS.map((slug) => [`${slug}_player`, secrets[slug]!])), account, id: (slug) => playerIdOf(slug, secrets[slug]!) }
}
let accounts = 0
const member = (name: string): Person => visitor(name, { id: `00000000-0000-4000-8000-${String(++accounts).padStart(12, "0")}`, nickname: name, avatarUrl: null, language: null })
const guest = (name: string): Person => visitor(name)

const NOW = Date.now()
const ago = (ms: number) => new Date(NOW - ms).toISOString()

/** A table of a game with these people at it (the first is the host), as the database would hold it. */
function table(slug: string, code: string, people: Person[], over: Partial<StoredRow> = {}): StoredRow {
  const row: StoredRow = {
    game: slug,
    code,
    host_id: people[0]?.id(slug) ?? "nobody",
    status: "lobby",
    players: people.map((person) => ({ id: person.id(slug), nickname: person.name })),
    options: { hint: true },
    state: null,
    replay: [],
    takeover_votes: [],
    seen: {},
    ready_at: {},
    ready_deadline: null,
    version: 1,
    created_at: ago(10_000),
    updated_at: ago(10_000),
    member_ids: Object.fromEntries(people.flatMap((person) => (person.account ? [[person.id(slug), person.account.id] as const] : []))),
    ...over,
  }
  h.rows.set(`${slug}:${code}`, row)
  return row
}

const PUBLIC = { visibility: "public", pace: "normal" }
const stored = (slug: string, code: string) => h.rows.get(`${slug}:${code}`) as StoredRow | undefined
const all = () => [...h.rows.values()] as StoredRow[]
const tablesOf = (slug: string) => all().filter((row) => row.game === slug)

async function flush() {
  while (h.scheduled.length) await h.scheduled.shift()!()
}

/** `person` presses Play (or asks again, with `poll`), and the end of the request runs. */
async function search(person: Person, games: string[], mode: "normal" | "ranked" = "normal", extra: Record<string, unknown> = {}): Promise<PlayState> {
  const input = parsePlayRequest({ games, mode, nickname: person.name, ...extra }) as PlayRequest
  try {
    return await requests.run({ jar: person.jar, account: person.account }, () => playSearch(deps, new Request("http://localhost/api/hub/play", { method: "POST" }), input))
  } finally {
    await flush()
  }
}

/** `person` stops looking. */
async function cancel(person: Person, input: Parameters<typeof playCancel>[0]) {
  try {
    return await requests.run({ jar: person.jar, account: person.account }, () => playCancel(input))
  } finally {
    await flush()
  }
}

type Answer = { status: number; body: Record<string, unknown> }
type Handler = (request: Request, context: GameRouteContext) => Promise<Response>

/** One of the routes of a game, as `person` calls it. */
async function call(person: Person, handler: Handler, slug: string, code: string, body: unknown = {}): Promise<Answer> {
  const response = await requests.run({ jar: person.jar, account: person.account }, () =>
    handler(new Request(`http://localhost/api/${slug}/games/${code}`, { method: "POST", body: JSON.stringify(body) }), { game: GAMES[slug]!, params: { code } }),
  )
  await flush()
  return { status: response.status, body: JSON.parse(await response.text()) as Record<string, unknown> }
}

const noAges = async () => NO_AGE_RULES
const join = postJoin(noAges)
const start = postStart(noAges)
const options = postOptions(noAges)

beforeEach(() => {
  h.rows.clear()
  h.jar = new Map()
  h.headers = {}
  h.account = null
  h.ranks = {}
  h.birthdates = {}
  h.ages = {}
  h.noCreate = false
  h.scheduled.length = 0
  h.events.length = 0
  h.seen.length = 0
  h.settings = {
    alpha: { minPlayers: 2, maxPlayers: 4, options: { defaults: {}, hidden: [] } },
    beta: { minPlayers: 2, maxPlayers: 2, options: { defaults: {}, hidden: [] } },
    gamma: { minPlayers: 3, maxPlayers: 3, options: { defaults: {}, hidden: [] } },
  }
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("a visitor presses Play and no table waits", () => {
  it("opens a public table of the game, with the seats between the game's least and most players", async () => {
    const ann = member("Ann")
    const { tables } = await search(ann, ["alpha"])
    expect(tables).toHaveLength(1)
    expect(tables[0]).toMatchObject({ game: "alpha", status: "lobby", players: 1, seats: 3, mode: "normal", opened: true })
    const row = stored("alpha", tables[0]!.code)!
    expect(row.settings).toEqual({ visibility: "public", pace: "normal", seats: 3 })
    expect(row.host_id).toBe(ann.id("alpha"))
    expect(row.ranked).toBeUndefined()
    expect(row.member_ids).toEqual({ [ann.id("alpha")]: ann.account!.id })
  })

  it("opens it with the admin's defaults for the options", async () => {
    h.settings.alpha!.options.defaults = { hint: false }
    const { tables } = await search(member("Ann"), ["alpha"])
    expect(stored("alpha", tables[0]!.code)!.options).toEqual({ hint: false })
  })

  it("lists the table as it opens, with the host seen at it: it is offered at once", async () => {
    const { tables } = await search(member("Ann"), ["alpha"])
    expect(Object.keys(stored("alpha", tables[0]!.code)!.seen)).toHaveLength(1)
  })

  it("sits a guest down under their nickname, with a cookie made for the game if they had none", async () => {
    const gus = visitor("Gus")
    gus.jar.clear()
    const { tables } = await search(gus, ["alpha"])
    const row = stored("alpha", tables[0]!.code)!
    expect(row.players).toEqual([{ id: expect.any(String), nickname: "Gus" }])
    expect(gus.jar.get("alpha_player")).toBeDefined()
    // A guest holds no account: the table records none for the seat
    expect(row.member_ids).toBeUndefined()
  })

  it("needs a nickname from a guest, and opens nothing without one", async () => {
    await expect(search(guest("  "), ["alpha"])).rejects.toMatchObject({ code: "INVALID_NICKNAME" })
    expect(all()).toHaveLength(0)
  })

  it("is refused a game that cannot be played here", async () => {
    await expect(search(member("Ann"), ["nowhere"])).rejects.toMatchObject({ code: "GAME_NOT_FOUND", status: 404 })
    // The games that can be played are looked for all the same
    const { tables } = await search(member("Ann"), ["nowhere", "alpha"])
    expect(tables.map((one) => one.game)).toEqual(["alpha"])
  })
})

describe("a visitor presses Play and a table waits", () => {
  it("sits at it, and the game begins by itself when it is full", async () => {
    const ann = member("Ann")
    const bob = member("Bob")
    const opened = (await search(ann, ["beta"])).tables[0]!
    expect(opened).toMatchObject({ status: "lobby", players: 1, seats: 2, opened: true })
    const found = (await search(bob, ["beta"])).tables[0]!
    expect(found).toMatchObject({ code: opened.code, status: "starting", players: 2, seats: 2, opened: false })
    expect(tablesOf("beta")).toHaveLength(1)
    const row = stored("beta", opened.code)!
    expect(row.status).toBe("starting")
    expect(row.players.map((player) => player.id)).toEqual([ann.id("beta"), bob.id("beta")])
    expect(row.ready_deadline).not.toBeNull()
    // The first visitor sees it begin the next time they ask
    expect((await search(ann, ["beta"], "normal", { poll: true })).tables[0]).toMatchObject({ code: opened.code, status: "starting" })
  })

  it("does not begin a table that has not filled", async () => {
    const opened = (await search(member("Ann"), ["alpha"])).tables[0]!
    const found = (await search(member("Bob"), ["alpha"])).tables[0]!
    expect(found).toMatchObject({ code: opened.code, status: "lobby", players: 2, seats: 3 })
    expect(stored("alpha", opened.code)!.status).toBe("lobby")
  })

  it("takes the fullest table of the game first", async () => {
    table("alpha", "EMPTY1", [member("Eve")], { settings: PUBLIC })
    table("alpha", "FULLER", [member("Fay"), member("Gil")], { settings: PUBLIC })
    const { tables } = await search(member("Ann"), ["alpha"])
    expect(tables[0]).toMatchObject({ code: "FULLER", players: 3 })
  })

  it("leaves a table that is full to the next, and does not open one while another has a seat", async () => {
    table("alpha", "FULLFU", [member("Eve"), member("Fay"), member("Gil"), member("Hal")], { settings: { ...PUBLIC, seats: 4 } })
    table("alpha", "SPARE1", [member("Ivy")], { settings: PUBLIC })
    const { tables } = await search(member("Ann"), ["alpha"])
    expect(tables[0]).toMatchObject({ code: "SPARE1", opened: false })
    expect(tablesOf("alpha")).toHaveLength(2)
  })

  it("opens its own when every table is full", async () => {
    table("alpha", "FULLFU", [member("Eve"), member("Fay"), member("Gil")], { settings: { ...PUBLIC, seats: 3 } })
    const { tables } = await search(member("Ann"), ["alpha"])
    expect(tables[0]).toMatchObject({ opened: true, players: 1 })
    expect(tablesOf("alpha")).toHaveLength(2)
  })

  it("passes a table whose rank the visitor does not meet, and one whose language it does not speak", async () => {
    table("alpha", "GOLDGO", [member("Eve")], { settings: { ...PUBLIC, minRank: "Gold" } })
    table("alpha", "FRENCH", [member("Fay")], { settings: { ...PUBLIC, language: "fr" } })
    const ann = member("Ann")
    h.ranks[ann.account!.id] = { tier: "Silver", division: 1 }
    h.headers["accept-language"] = "en-US"
    expect((await search(ann, ["alpha"])).tables[0]).toMatchObject({ opened: true })
    expect(tablesOf("alpha")).toHaveLength(3)
  })

  it("sits at a table whose rank it meets", async () => {
    table("alpha", "GOLDGO", [member("Eve")], { settings: { ...PUBLIC, minRank: "Gold" } })
    const ann = member("Ann")
    h.ranks[ann.account!.id] = { tier: "Platinum", division: 2 }
    expect((await search(ann, ["alpha"])).tables[0]).toMatchObject({ code: "GOLDGO", opened: false })
  })

  it("never sits at a private table, whatever it is", async () => {
    table("alpha", "PRIVAT", [member("Eve")], { settings: { visibility: "private", pace: "normal", seats: 4 } })
    expect((await search(member("Ann"), ["alpha"])).tables[0]).toMatchObject({ opened: true })
  })

  it("passes a table that is not played at the usual speed", async () => {
    table("alpha", "FASTFA", [member("Eve")], { settings: { ...PUBLIC, pace: "fast" } })
    expect((await search(member("Ann"), ["alpha"])).tables[0]).toMatchObject({ opened: true })
  })

  it("passes a table that began, and a table of another game", async () => {
    table("alpha", "BEGUNB", [member("Eve"), member("Fay")], { settings: PUBLIC, status: "starting" })
    table("beta", "OTHERG", [member("Gil")], { settings: PUBLIC })
    expect((await search(member("Ann"), ["alpha"])).tables[0]).toMatchObject({ game: "alpha", opened: true })
  })

  it("goes on to the next table when the one it chose was taken in the meantime", async () => {
    table("alpha", "TAKENT", [member("Eve"), member("Fay")], { settings: { ...PUBLIC, seats: 3 } })
    table("alpha", "SPARE1", [member("Gil")], { settings: PUBLIC })
    // Another visitor took the last seat of the fuller table between the read and the join
    const lost = table("alpha", "RACERS", [member("Hal"), member("Ivy"), member("Jan")], { settings: { ...PUBLIC, seats: 3 } })
    expect(lost.players).toHaveLength(3)
    const { tables } = await search(member("Ann"), ["alpha"])
    expect(tables[0]).toMatchObject({ code: "TAKENT" })
  })
})

describe("a search is asked again while it lasts", () => {
  it("answers with the same table and writes nothing new", async () => {
    const ann = member("Ann")
    const first = (await search(ann, ["alpha"])).tables[0]!
    const version = stored("alpha", first.code)!.version
    for (let poll = 0; poll < 3; poll++) expect((await search(ann, ["alpha"], "normal", { poll: true })).tables).toEqual([{ ...first, opened: false }])
    expect(tablesOf("alpha")).toHaveLength(1)
    expect(stored("alpha", first.code)!.version).toBe(version)
  })

  it("does the same for a guest, who is known by their cookie", async () => {
    const gus = guest("Gus")
    const first = (await search(gus, ["alpha"])).tables[0]!
    expect((await search(gus, ["alpha"], "normal", { poll: true })).tables[0]).toMatchObject({ code: first.code, opened: false })
    expect(tablesOf("alpha")).toHaveLength(1)
  })

  it("says a table has filled when the next searcher took the last seat", async () => {
    const ann = member("Ann")
    const first = (await search(ann, ["beta"])).tables[0]!
    expect(first.status).toBe("lobby")
    await search(member("Bob"), ["beta"])
    expect((await search(ann, ["beta"], "normal", { poll: true })).tables[0]).toMatchObject({ status: "starting", players: 2 })
  })

  it("keeps the visitor's seat alive, so that the table stays listed, and not more often than the server writes a seat", async () => {
    const ann = member("Ann")
    await search(ann, ["alpha"])
    const writes = h.seen.length
    await search(ann, ["alpha"], "normal", { poll: true })
    await search(ann, ["alpha"], "normal", { poll: true })
    expect(h.seen.length).toBe(writes)
    expect(writes).toBeGreaterThan(0)
  })

  it("moves a visitor who sits alone to an older table that has somebody, and drops the one they opened", async () => {
    const ann = member("Ann")
    const bob = member("Bob")
    // Both opened a table at the same moment and neither found the other's: Bob's is the older
    table("alpha", "BOBTAB", [bob], { settings: PUBLIC, created_at: ago(5_000) })
    table("alpha", "ANNTAB", [ann], { settings: PUBLIC, created_at: ago(1_000) })
    const moved = (await search(ann, ["alpha"], "normal", { poll: true })).tables[0]!
    expect(moved).toMatchObject({ code: "BOBTAB", players: 2 })
    expect(stored("alpha", "ANNTAB")).toBeUndefined()
    // And Bob, who sits at the older table, stays
    expect((await search(bob, ["alpha"], "normal", { poll: true })).tables[0]).toMatchObject({ code: "BOBTAB" })
    expect(tablesOf("alpha")).toHaveLength(1)
  })

  it("does not move a visitor who sits with others, nor to a table that is newer", async () => {
    const ann = member("Ann")
    table("alpha", "ANNTAB", [ann, member("Cy")], { settings: PUBLIC, created_at: ago(1_000) })
    table("alpha", "OLDERT", [member("Bob")], { settings: PUBLIC, created_at: ago(5_000) })
    expect((await search(ann, ["alpha"], "normal", { poll: true })).tables[0]).toMatchObject({ code: "ANNTAB" })
    const dan = member("Dan")
    table("beta", "DANTAB", [dan], { settings: PUBLIC, created_at: ago(5_000) })
    table("beta", "NEWERT", [member("Eve")], { settings: PUBLIC, created_at: ago(1_000), status: "lobby" })
    expect((await search(dan, ["beta"], "normal", { poll: true })).tables[0]).toMatchObject({ code: "DANTAB" })
    expect(stored("beta", "DANTAB")!.players).toHaveLength(1)
  })
})

describe("a search of several games", () => {
  it("sits the visitor at one table of each game: they join the one that waits and open the others", async () => {
    table("alpha", "WAITIN", [member("Eve")], { settings: PUBLIC })
    const ann = member("Ann")
    const { tables } = await search(ann, ["alpha", "beta", "gamma"])
    expect(tables.map((one) => [one.game, one.opened])).toEqual([
      ["alpha", false],
      ["beta", true],
      ["gamma", true],
    ])
    expect(tablesOf("alpha")).toHaveLength(1)
    expect(tablesOf("beta")).toHaveLength(1)
    expect(tablesOf("gamma")).toHaveLength(1)
  })

  it("keeps one table for each game when it is asked again", async () => {
    const ann = member("Ann")
    const first = (await search(ann, ["alpha", "beta"])).tables
    const again = (await search(ann, ["alpha", "beta"], "normal", { poll: true })).tables
    expect(again.map((one) => one.code)).toEqual(first.map((one) => one.code))
    expect(all()).toHaveLength(2)
  })

  it("says which game filled, and only that one: it is the table the visitor goes to, and the others stay until the game begins", async () => {
    const ann = member("Ann")
    const first = (await search(ann, ["alpha", "beta"])).tables
    await search(member("Bob"), ["beta"])
    const { tables } = await search(ann, ["alpha", "beta"], "normal", { poll: true })
    expect(tables).toEqual([{ game: "beta", code: first.find((one) => one.game === "beta")!.code, status: "starting", players: 2, seats: 2, mode: "normal", opened: false }])
    expect(tablesOf("alpha")).toHaveLength(1)
    expect(stored("alpha", first.find((one) => one.game === "alpha")!.code)!.players).toHaveLength(1)
  })

  it("is not refused for a game the visitor may not play when another one can be played", async () => {
    h.ages.alpha = { game: 18, expansions: {} }
    const gus = guest("Gus")
    const { tables } = await search(gus, ["alpha", "beta"])
    expect(tables.map((one) => one.game)).toEqual(["beta"])
    expect(tablesOf("alpha")).toHaveLength(0)
  })

  it("says why when no game can be played: a guest signs in, a member adds their date of birth or is too young", async () => {
    h.ages.alpha = { game: 18, expansions: {} }
    await expect(search(guest("Gus"), ["alpha"])).rejects.toMatchObject({ code: "AGE_SIGN_IN_REQUIRED", status: 401 })
    const ann = member("Ann")
    await expect(search(ann, ["alpha"])).rejects.toMatchObject({ code: "AGE_DATE_REQUIRED" })
    h.birthdates[ann.account!.id] = "2015-05-05"
    await expect(search(ann, ["alpha"])).rejects.toMatchObject({ code: "AGE_TOO_YOUNG" })
    h.birthdates[ann.account!.id] = "1990-05-05"
    expect((await search(ann, ["alpha"])).tables[0]).toMatchObject({ game: "alpha" })
  })

  it("says the table could not be opened when the limit on opening is reached, and sits at the ones that waited", async () => {
    h.noCreate = true
    table("alpha", "WAITIN", [member("Eve")], { settings: PUBLIC })
    const { tables } = await search(member("Ann"), ["alpha", "beta"])
    expect(tables.map((one) => one.game)).toEqual(["alpha"])
    await expect(search(member("Bob"), ["gamma"])).rejects.toMatchObject({ code: "RATE_LIMITED", status: 429 })
  })
})

describe("two searchers who meet", () => {
  it("sit at the same table: the one who opened it and the one who found it", async () => {
    const ann = member("Ann")
    const bob = member("Bob")
    const first = (await search(ann, ["alpha"])).tables[0]!
    const second = (await search(bob, ["alpha"])).tables[0]!
    expect(second).toMatchObject({ code: first.code, opened: false, players: 2 })
    expect(stored("alpha", first.code)!.players.map((player) => player.nickname)).toEqual(["Ann", "Bob"])
  })

  it("begin the game once, even when the last two seats are taken at the same instant", async () => {
    const eve = member("Eve")
    table("gamma", "RACE12", [eve], { settings: { ...PUBLIC, seats: 3 } })
    const joined = await Promise.all([search(member("Ann"), ["gamma"]), search(member("Bob"), ["gamma"])])
    expect(tablesOf("gamma")).toHaveLength(1)
    const row = stored("gamma", "RACE12")!
    expect(row.players).toHaveLength(3)
    expect(row.status).toBe("starting")
    // The version: the two joins and the one start, and no second start
    expect(row.version).toBe(1 + 2 + 1)
    expect(h.events.filter((entry) => entry.event === "player_joined")).toHaveLength(2)
    // Both are told it has begun, one by the seat they took and the other by the next look
    expect(joined.flatMap((state) => state.tables).every((one) => one.code === "RACE12")).toBe(true)
  })
})

describe("a table that fills begins by itself", () => {
  it("does not wait for its host: the join that takes the last seat starts it, for every table", async () => {
    const ann = member("Ann")
    const bob = member("Bob")
    table("beta", "FRIEND", [ann], { settings: { visibility: "private", seats: 2 } })
    const answer = await call(bob, join, "beta", "FRIEND", {})
    expect(answer.status).toBe(200)
    expect(answer.body.status).toBe("starting")
    expect(stored("beta", "FRIEND")!.status).toBe("starting")
  })

  it("does not begin with fewer than two players, nor a table that has not filled", async () => {
    table("alpha", "SOLO12", [member("Ann")], { settings: { visibility: "public", seats: 2 } })
    const answer = await call(member("Bob"), join, "alpha", "SOLO12", {})
    // Two of two seats: it has filled
    expect(answer.body.status).toBe("starting")
    table("alpha", "NOTYET", [member("Cy")], { settings: { visibility: "public", seats: 3 } })
    expect((await call(member("Dee"), join, "alpha", "NOTYET", {})).body.status).toBe("lobby")
  })

  it("leaves the seat taken and the table a lobby when somebody at it is in a game", async () => {
    const eve = member("Eve")
    const bob = member("Bob")
    // Eve is playing something else, which her account says at every table
    table("gamma", "PLAYIN", [eve, member("Fay"), member("Gil")], { status: "playing" })
    table("beta", "WAITIN", [eve], { settings: { ...PUBLIC, seats: 2 } })
    const answer = await call(bob, join, "beta", "WAITIN", {})
    expect(answer.status).toBe(200)
    expect(answer.body.status).toBe("lobby")
    expect((answer.body.players as unknown[]).length).toBe(2)
    expect(stored("beta", "WAITIN")!.status).toBe("lobby")
  })

  it("is not what happens when the seat is only renamed", async () => {
    const ann = member("Ann")
    table("beta", "FULLAL", [ann, member("Bob")], { settings: { visibility: "private", seats: 2 } })
    const answer = await call(ann, join, "beta", "FULLAL", { nickname: "Annie" })
    expect(answer.body.status).toBe("lobby")
  })

  it("is the host's to start sooner: a table that is not full still starts on their click", async () => {
    const ann = member("Ann")
    table("alpha", "EARLYE", [ann, member("Bob")], { settings: { visibility: "private", seats: 4 } })
    expect((await call(ann, start, "alpha", "EARLYE")).body.status).toBe("starting")
  })
})

describe("when a game begins", () => {
  it("its players leave every other lobby where they sit, whatever the table is", async () => {
    const ann = member("Ann")
    const bob = member("Bob")
    const cy = member("Cy")
    table("beta", "THEGAM", [ann, bob], { status: "starting", ready_at: { [ann.id("beta")]: ago(1_000) }, ready_deadline: new Date(NOW + 30_000).toISOString() })
    // Ann also waits at a table of another game with Cy, and at a private one of the same game with a friend
    table("alpha", "OTHERA", [ann, cy], { settings: PUBLIC })
    table("beta", "FRIEND", [ann, member("Dee")], { settings: { visibility: "private" } })
    // Bob is at a lobby alone
    table("gamma", "BOBONL", [bob], { settings: PUBLIC })
    const answer = await call(bob, ready, "beta", "THEGAM")
    expect(answer.body.status).toBe("playing")
    expect(stored("alpha", "OTHERA")!.players.map((player) => player.nickname)).toEqual(["Cy"])
    expect(stored("beta", "FRIEND")!.players.map((player) => player.nickname)).toEqual(["Dee"])
    // A lobby that nobody is left at is deleted
    expect(stored("gamma", "BOBONL")).toBeUndefined()
    expect(stored("beta", "THEGAM")!.players).toHaveLength(2)
  })

  it("hands the host of a lobby they leave to the next one", async () => {
    const ann = member("Ann")
    const cy = member("Cy")
    table("alpha", "OTHERA", [ann, cy], { settings: PUBLIC })
    await leaveOtherLobbies({ slug: "beta" }, { code: "THEGAM", players: [{ id: ann.id("beta"), nickname: "Ann" }, { id: member("Bob").id("beta"), nickname: "Bob" }] })
    // Nothing is known of the table that began: the accounts are its `member_ids`, which it has none of here
    expect(stored("alpha", "OTHERA")!.host_id).toBe(ann.id("alpha"))
    table("beta", "THEGAM", [ann, member("Bob")], { status: "playing" })
    await leaveOtherLobbies({ slug: "beta" }, stored("beta", "THEGAM")!)
    expect(stored("alpha", "OTHERA")!.host_id).toBe(cy.id("alpha"))
  })

  it("leaves no table of a game in progress, nor a ready check", async () => {
    const ann = member("Ann")
    table("beta", "THEGAM", [ann, member("Bob")], { status: "playing" })
    table("alpha", "INGAME", [ann, member("Cy")], { status: "playing" })
    table("gamma", "CHECKI", [ann, member("Cy"), member("Dee")], { status: "starting" })
    await leaveOtherLobbies({ slug: "beta" }, stored("beta", "THEGAM")!)
    expect(stored("alpha", "INGAME")!.players).toHaveLength(2)
    expect(stored("gamma", "CHECKI")!.players).toHaveLength(3)
  })

  it("takes a guest out of the lobbies of the same game, the only ones the cookie of the game knows", async () => {
    const gus = guest("Gus")
    const bob = guest("Bob")
    table("beta", "THEGAM", [gus, bob], { status: "playing" })
    table("beta", "SAMEGA", [gus, guest("Cy")], { settings: PUBLIC })
    table("alpha", "OTHERA", [gus, guest("Dee")], { settings: PUBLIC })
    await leaveOtherLobbies({ slug: "beta" }, stored("beta", "THEGAM")!)
    expect(stored("beta", "SAMEGA")!.players.map((player) => player.nickname)).toEqual(["Cy"])
    expect(stored("alpha", "OTHERA")!.players).toHaveLength(2)
  })
})

describe("a visitor who is playing presses Play", () => {
  it("is told the table they play, and sits at nothing else", async () => {
    const ann = member("Ann")
    table("beta", "THEGAM", [ann, member("Bob")], { status: "playing" })
    const { tables } = await search(ann, ["alpha", "gamma"])
    expect(tables).toEqual([{ game: "beta", code: "THEGAM", status: "playing", players: 2, seats: 2, mode: "normal", opened: false }])
    expect(tablesOf("alpha")).toHaveLength(0)
    expect(tablesOf("gamma")).toHaveLength(0)
  })

  it("is told the table whose ready check is on", async () => {
    const ann = member("Ann")
    table("alpha", "CHECKI", [ann, member("Bob")], { status: "starting" })
    expect((await search(ann, ["alpha"])).tables[0]).toMatchObject({ code: "CHECKI", status: "starting" })
  })

  it("is not taken to a game they left, which their seat only keeps", async () => {
    const ann = member("Ann")
    const row = table("beta", "THEGAM", [ann, member("Bob")], { status: "playing" })
    row.players[0]!.left = true
    expect((await search(ann, ["alpha"])).tables[0]).toMatchObject({ game: "alpha", opened: true })
  })
})

describe("a ranked search", () => {
  it("is for members: a guest is asked to sign in", async () => {
    await expect(search(guest("Gus"), ["alpha"], "ranked")).rejects.toMatchObject({ code: "RANKED_MEMBERS_ONLY", status: 403 })
    expect(all()).toHaveLength(0)
  })

  it("opens a ranked table: public, fixed, with the tier of the member who opened it and no helpers", async () => {
    const ann = member("Ann")
    h.ranks[ann.account!.id] = { tier: "Gold", division: 2 }
    const { tables } = await search(ann, ["alpha"], "ranked")
    expect(tables[0]).toMatchObject({ mode: "ranked", opened: true, seats: 3 })
    const row = stored("alpha", tables[0]!.code)!
    expect(row.settings).toEqual({ visibility: "public", pace: "normal", seats: 3, ranked: true, anchor: "Gold" })
    expect(row.ranked).toBe(true)
    // The aid is off, whatever the admin set
    expect(row.options).toEqual({ hint: false })
  })

  it("keeps the helpers of a game that has none as they are", async () => {
    const { tables } = await search(member("Ann"), ["beta"], "ranked")
    expect(stored("beta", tables[0]!.code)!.options).toEqual({ hint: true })
  })

  it("never joins a normal table, and a normal search never joins a ranked one", async () => {
    const eve = member("Eve")
    table("alpha", "NORMAL", [eve], { settings: PUBLIC })
    expect((await search(member("Ann"), ["alpha"], "ranked")).tables[0]).toMatchObject({ mode: "ranked", opened: true })
    const ranked = tablesOf("alpha").find((row) => row.settings?.ranked)!
    expect((await search(member("Bob"), ["alpha"], "normal")).tables[0]).toMatchObject({ code: "NORMAL" })
    expect(ranked.players).toHaveLength(1)
  })

  it("sits a member at a ranked table opened near their tier, and opens their own when theirs is too far from it", async () => {
    const eve = member("Eve")
    table("alpha", "GOLDEN", [eve], { settings: { ...PUBLIC, ranked: true, anchor: "Gold", seats: 3 }, ranked: true })
    const near = member("Ann")
    h.ranks[near.account!.id] = { tier: "Silver", division: 3 }
    expect((await search(near, ["alpha"], "ranked")).tables[0]).toMatchObject({ code: "GOLDEN", opened: false })
    const far = member("Bob")
    h.ranks[far.account!.id] = { tier: "Bronze", division: 1 }
    const farTable = (await search(far, ["alpha"], "ranked")).tables[0]!
    expect(farTable).toMatchObject({ opened: true })
    expect(stored("alpha", farTable.code)!.settings).toMatchObject({ ranked: true, anchor: "Bronze" })
  })

  it("takes anybody at a table that has waited long enough", async () => {
    table("alpha", "GOLDEN", [member("Eve")], { settings: { ...PUBLIC, ranked: true, anchor: "Gold", seats: 3 }, ranked: true, created_at: ago(8 * RANK_GAP_STEP_MS) })
    const far = member("Bob")
    h.ranks[far.account!.id] = { tier: "Apprentice", division: 1 }
    expect((await search(far, ["alpha"], "ranked")).tables[0]).toMatchObject({ code: "GOLDEN" })
  })

  it("begins by itself when it is full, like any table", async () => {
    const opened = (await search(member("Ann"), ["beta"], "ranked")).tables[0]!
    expect((await search(member("Bob"), ["beta"], "ranked")).tables[0]).toMatchObject({ code: opened.code, status: "starting", mode: "ranked" })
  })
})

describe("a ranked table is fixed", () => {
  const ranked = (people: Person[], over: Partial<StoredRow> = {}) => table("alpha", "RANKED", people, { settings: { ...PUBLIC, ranked: true, anchor: "Silver", seats: 3 }, ranked: true, ...over })

  it("is not changed by its host: not its options, not its settings", async () => {
    const ann = member("Ann")
    ranked([ann])
    const changed = await call(ann, options, "alpha", "RANKED", { options: { hint: true } })
    expect([changed.status, changed.body.error]).toEqual([403, "RANKED_TABLE_LOCKED"])
    const set = await call(ann, settingsRoute, "alpha", "RANKED", { settings: { visibility: "private", minRank: null, language: null, pace: "normal", seats: 3 } })
    expect([set.status, set.body.error]).toEqual([403, "RANKED_TABLE_LOCKED"])
    expect(stored("alpha", "RANKED")!.settings).toMatchObject({ visibility: "public", ranked: true })
    expect(stored("alpha", "RANKED")!.options).toEqual({ hint: true })
  })

  it("is not started by its host before it is full, and begins when it is", async () => {
    const ann = member("Ann")
    ranked([ann, member("Bob")])
    const early = await call(ann, start, "alpha", "RANKED")
    expect([early.status, early.body.error]).toEqual([409, "RANKED_TABLE_NOT_FULL"])
    expect(stored("alpha", "RANKED")!.status).toBe("lobby")
    // Unranked, a member has the lowest tier, which is too far from Silver: Cy is a Silver
    const cy = member("Cy")
    h.ranks[cy.account!.id] = { tier: "Silver", division: 1 }
    const joined = await call(cy, join, "alpha", "RANKED", {})
    expect(joined.body.status).toBe("starting")
  })

  it("is not sat at by a guest", async () => {
    ranked([member("Ann")])
    const answer = await call(guest("Gus"), join, "alpha", "RANKED", { nickname: "Gus" })
    expect([answer.status, answer.body.error]).toEqual([403, "RANKED_MEMBERS_ONLY"])
    expect(stored("alpha", "RANKED")!.players).toHaveLength(1)
  })

  it("is not sat at by a member too far from the tier it opened at, until it has waited", async () => {
    ranked([member("Ann")])
    const bob = member("Bob")
    h.ranks[bob.account!.id] = { tier: "Legend" }
    const refused = await call(bob, join, "alpha", "RANKED", {})
    expect([refused.status, refused.body.error]).toEqual([403, "RANK_GAP"])
    stored("alpha", "RANKED")!.created_at = ago(10 * RANK_GAP_STEP_MS)
    expect((await call(bob, join, "alpha", "RANKED", {})).status).toBe(200)
  })

  it("is sat at by a member near the tier it opened at", async () => {
    ranked([member("Ann")])
    const bob = member("Bob")
    h.ranks[bob.account!.id] = { tier: "Gold", division: 1 }
    expect((await call(bob, join, "alpha", "RANKED", {})).status).toBe(200)
  })

  it("leaves a normal table as it was: its host changes it, and a guest sits at it", async () => {
    const ann = member("Ann")
    table("alpha", "NORMAL", [ann], { settings: PUBLIC })
    expect((await call(ann, options, "alpha", "NORMAL", { options: { hint: false } })).status).toBe(200)
    expect((await call(guest("Gus"), join, "alpha", "NORMAL", { nickname: "Gus" })).status).toBe(200)
  })
})

describe("a visitor stops looking", () => {
  it("leaves the tables of the search, and a table nobody is left at is deleted", async () => {
    const ann = member("Ann")
    const first = (await search(ann, ["alpha", "beta"])).tables
    const answer = await cancel(ann, { tables: first.map(({ game, code }) => ({ game, code })) })
    expect(answer).toEqual({ left: 2 })
    expect(all()).toHaveLength(0)
  })

  it("leaves the others at a table they sat at, with another host if they were it", async () => {
    const ann = member("Ann")
    const bob = member("Bob")
    const opened = (await search(ann, ["alpha"])).tables[0]!
    await search(bob, ["alpha"])
    await cancel(ann, { tables: [{ game: "alpha", code: opened.code }] })
    const row = stored("alpha", opened.code)!
    expect(row.players.map((player) => player.nickname)).toEqual(["Bob"])
    expect(row.host_id).toBe(bob.id("alpha"))
  })

  it("does not leave a table that has begun, nor one they do not sit at", async () => {
    const ann = member("Ann")
    table("beta", "BEGUNB", [ann, member("Bob")], { status: "starting" })
    table("alpha", "NOTMIN", [member("Cy")], { settings: PUBLIC })
    expect(await cancel(ann, { tables: [{ game: "beta", code: "BEGUNB" }, { game: "alpha", code: "NOTMIN" }, { game: "alpha", code: "GONEGO" }] })).toEqual({ left: 0 })
    expect(stored("beta", "BEGUNB")!.players).toHaveLength(2)
    expect(stored("alpha", "NOTMIN")!.players).toHaveLength(1)
  })

  it("is a search that can begin again, at the same tables or at others", async () => {
    const ann = member("Ann")
    const first = (await search(ann, ["alpha"])).tables[0]!
    await cancel(ann, { tables: [{ game: "alpha", code: first.code }] })
    const second = (await search(ann, ["alpha"])).tables[0]!
    expect(second).toMatchObject({ opened: true, players: 1 })
    expect(tablesOf("alpha")).toHaveLength(1)
  })
})

describe("the events of a search", () => {
  it("says a search began on the press, and not on the calls that keep it alive", async () => {
    const ann = member("Ann")
    await search(ann, ["alpha", "beta"])
    await search(ann, ["alpha", "beta"], "normal", { poll: true })
    const started = h.events.filter((entry) => entry.event === "quick_play_started")
    expect(started).toHaveLength(1)
    expect(started[0]!.properties).toEqual({ mode: "normal", games: ["alpha", "beta"] })
    expect(started[0]!.id).toBe(ann.id("alpha"))
  })

  it("says a search was matched with how long it waited, whether the visitor opened the table or sat at it, and how many play", async () => {
    const ann = member("Ann")
    const bob = member("Bob")
    await search(ann, ["beta"])
    await search(bob, ["beta"], "normal", { poll: true, waited: 4 })
    await search(ann, ["beta"], "normal", { poll: true, waited: 9 })
    const matched = h.events.filter((entry) => entry.event === "quick_play_matched")
    expect(matched.map((entry) => entry.properties)).toEqual([
      { game: "beta", mode: "normal", how: "joined", wait_s: 4, players: 2 },
      { game: "beta", mode: "normal", how: "opened", wait_s: 9, players: 2 },
    ])
  })

  it("says nothing of a match whose wait is not known", async () => {
    await search(member("Ann"), ["beta"])
    await search(member("Bob"), ["beta"])
    expect(h.events.filter((entry) => entry.event === "quick_play_matched")).toEqual([])
  })

  it("says a search was stopped, with the games and how long it lasted", async () => {
    const ann = member("Ann")
    const found = (await search(ann, ["alpha", "beta"])).tables
    await cancel(ann, { tables: found.map(({ game, code }) => ({ game, code })), mode: "normal", waited: 21 })
    expect(h.events.filter((entry) => entry.event === "quick_play_cancelled").map((entry) => entry.properties)).toEqual([{ mode: "normal", games: ["alpha", "beta"], wait_s: 21 }])
  })

  it("carries no name, no table code and no account", async () => {
    const ann = member("Ann")
    const bob = member("Bob")
    await search(ann, ["beta"])
    await search(bob, ["beta"], "normal", { waited: 2 })
    const text = JSON.stringify(h.events.filter((entry) => entry.event.startsWith("quick_play_")))
    for (const secret of ["Ann", "Bob", ann.account!.id, bob.account!.id, stored("beta", all()[0]!.code)?.code ?? "x"]) expect(text).not.toContain(secret)
  })
})

describe("what the search asks of the browser's requests", () => {
  it("is nothing for a body that is not a search or not a cancel", () => {
    expect(parsePlayRequest({ games: [], mode: "normal" })).toBeNull()
    expect(parseCancelRequest({ tables: "x" })).toBeNull()
  })
})
