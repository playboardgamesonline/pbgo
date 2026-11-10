import { assertNoPersonalData } from "@pbgo/analytics/privacy"
import { EngineError, type AnyGameDefinition } from "@pbgo/engine-kit"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { NO_AGE_RULES } from "../lib/age-rules"
import type { GameRouteContext } from "../lib/binding"
import { DEFAULT_REACTION_IDS } from "../lib/chat"
import { POST as chat } from "../routes/api/games/[code]/chat/route"
import { POST as action } from "../routes/api/games/[code]/action/route"
import { POST as debug } from "../routes/api/games/[code]/debug/route"
import { postJoin } from "../routes/api/games/[code]/join/route"
import { POST as leave } from "../routes/api/games/[code]/leave/route"
import { postOptions } from "../routes/api/games/[code]/options/route"
import { POST as ready } from "../routes/api/games/[code]/ready/route"
import { POST as replay } from "../routes/api/games/[code]/replay/route"
import { GET as read } from "../routes/api/games/[code]/route"
import { postStart } from "../routes/api/games/[code]/start/route"
import { POST as takeover } from "../routes/api/games/[code]/takeover/route"
import { postGame } from "../routes/api/games/route"
import { createGame, stateFingerprint } from "./games"
import { voteEntry } from "./takeover"

// These tests are not about the age check (`age-check.test.ts`): the game they play asks for no age
const noAges = async () => NO_AGE_RULES
const join = postJoin(noAges)
const options = postOptions(noAges)
const start = postStart(noAges)
const create = postGame(noAges)

/**
 * The server events of the game routes, end to end: the real routes, `updateGame`, `publicGame` and the takeover logic run
 * against an in-memory `games` table. What is faked is the database client, the player cookie, the rate limiter, `after`
 * and the PostHog `track` call. The point is what an event says about a request: which transition it caused, how many times,
 * and that a write lost to a concurrent request (the modifier runs again) leaves no flag of the first run behind.
 */

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
}

const h = vi.hoisted(() => ({
  rows: new Map<string, StoredRow>(),
  /** Runs once, right before the next conditional update compares versions: a concurrent request that wins the race */
  beforeUpdate: null as (() => void) | null,
  /** The same for the next conditional delete (an empty table): a player who sits down between the write that emptied it and the delete */
  beforeDelete: null as (() => void) | null,
  /** What the next delete answers instead of deleting, when the database cannot */
  deleteError: null as { code?: string; message: string } | null,
  scheduled: [] as Array<() => unknown>,
  track: vi.fn<(event: string, distinctId: string, properties: object) => Promise<void>>(async () => {}),
  playerId: null as string | null,
  settings: { options: { defaults: {}, hidden: [] as string[] }, maxPlayers: 3, minPlayers: 2, turnTimeout: 60 },
  /** Who is signed in: the account the create and join routes sit down as, null for a guest */
  account: null as { id: string; nickname: string; avatarUrl: string | null } | null,
  /** What the create and join routes tell `seatMember` once the response has left */
  seatMember: vi.fn<(game: { slug: string }, code: string, playerId: string, userId: string | null) => Promise<void>>(async () => {}),
  /** What the routes tell the recorder of the games (`results.ts`) once the response has left: a game that ended, one that began, the players the others played for */
  record: vi.fn<(game: { slug: string }, row: { code: string; status: string; version: number }, context?: object) => Promise<void>>(async () => {}),
  started: vi.fn<(game: { slug: string }, row: { code: string; status: string }) => Promise<void>>(async () => {}),
  takenOver: vi.fn<(game: { slug: string }, code: string, players: readonly string[]) => Promise<void>>(async () => {}),
  /** The seats `busy_seats` finds in a game somewhere else (PLT-120), and what the routes asked of the database */
  busy: [] as string[],
  rpcCalls: [] as Array<{ name: string; args: Record<string, unknown> }>,
}))

vi.mock("server-only", () => ({}))
vi.mock("next/server", () => ({ after: (callback: () => unknown) => void h.scheduled.push(callback) }))
vi.mock("@pbgo/analytics/server", () => ({ track: h.track }))
vi.mock("../sanity/client", () => ({ sanityClient: () => null }))
vi.mock("../lib/settings-server", () => ({ loadSettings: async () => h.settings }))
vi.mock("../lib/locale-server", () => ({ getLocale: async () => "en" }))
vi.mock("@pbgo/accounts/server", () => ({ getAccount: async () => h.account }))
vi.mock("./player", () => ({ getPlayerId: async () => h.playerId, getOrCreatePlayerId: async () => h.playerId }))
vi.mock("./rate-limit", () => ({ rateLimit: async () => {} }))
vi.mock("./presence", () => ({ markSeen: async () => {}, seatMember: h.seatMember }))
vi.mock("./results", () => ({ recordGameResult: h.record, markGameStarted: h.started, markTakenOver: h.takenOver }))
vi.mock("./supabase", () => {
  class Filters {
    filters: Record<string, unknown> = {}
    eq(column: string, value: unknown) {
      this.filters[column] = value
      return this
    }
  }
  class Select extends Filters {
    async maybeSingle() {
      const row = h.rows.get(`${this.filters.game}:${this.filters.code}`)
      return { data: row ? structuredClone(row) : null, error: null }
    }
  }
  class Update extends Filters {
    constructor(private patch: Partial<StoredRow>) {
      super()
    }
    async select() {
      const hook = h.beforeUpdate
      h.beforeUpdate = null
      hook?.()
      const key = `${this.filters.game}:${this.filters.code}`
      const row = h.rows.get(key)
      if (!row || row.version !== this.filters.version) return { data: [] as Array<{ code: string }>, error: null }
      h.rows.set(key, { ...row, ...structuredClone(this.patch) })
      return { data: [{ code: row.code }], error: null }
    }
  }
  class Delete extends Filters {
    async select() {
      const hook = h.beforeDelete
      h.beforeDelete = null
      hook?.()
      if (h.deleteError) return { data: null, error: h.deleteError }
      const key = `${this.filters.game}:${this.filters.code}`
      const row = h.rows.get(key)
      if (!row || row.version !== this.filters.version) return { data: [] as Array<{ code: string }>, error: null }
      h.rows.delete(key)
      return { data: [{ code: row.code }], error: null }
    }
  }
  const db = {
    from: () => ({
      select: () => new Select(),
      update: (patch: Partial<StoredRow>) => new Update(patch),
      delete: () => new Delete(),
      insert: async (row: Record<string, unknown>) => {
        const key = `${row.game}:${row.code}`
        if (h.rows.has(key)) return { error: { code: "23505" } }
        const now = new Date().toISOString()
        h.rows.set(key, { ...structuredClone(row), created_at: now, updated_at: now } as StoredRow)
        return { error: null }
      },
    }),
    channel: () => ({ httpSend: async () => ({ success: true as const }) }),
    rpc: async (name: string, args: Record<string, unknown>) => {
      h.rpcCalls.push({ name, args })
      return name === "busy_seats" ? { data: h.busy, error: null } : { data: null, error: { message: `function public.${name} does not exist` } }
    },
  }
  return { supabaseAdmin: () => db }
})

/** A game where the players move in turn and which ends after `length` moves. */
type TestState = { players: string[]; turn: number; length: number }
const isOver = (state: TestState) => state.turn >= state.length
const waitingFor = (state: TestState) => (isOver(state) ? [] : [state.players[state.turn % state.players.length]!])

const GAME: AnyGameDefinition = {
  id: "testgame",
  name: "Test game",
  minPlayers: 2,
  maxPlayers: 3,
  options: { rounds: { type: "number", label: "Rounds", defaultValue: 3, min: 1, max: 5 } },
  clientActions: ["move"],
  setup: ({ players, options }: { players: Array<{ id: string }>; options: Record<string, unknown> }): TestState => ({
    players: players.map((player) => player.id),
    turn: 0,
    length: Number(options.rounds),
  }),
  apply: (state: TestState, { playerId }: { playerId: string }): TestState => {
    if (!waitingFor(state).includes(playerId)) throw new EngineError("NOT_YOUR_TURN")
    return { ...state, turn: state.turn + 1 }
  },
  view: (state: TestState, playerId: string | null) => ({ me: playerId ? { id: playerId } : null, turn: state.turn }),
  isOver,
  waitingFor,
  autoPlayFor: (state: TestState) => ({ ...state, turn: state.turn + 1 }),
}

/** A game where several players owe a move at the same time (a simultaneous step); once all have played, the next round opens. */
type SimultaneousState = { players: string[]; pending: string[]; round: number }
const SIMULTANEOUS: AnyGameDefinition = {
  ...GAME,
  id: "simultaneous",
  apply: (state: SimultaneousState, { playerId }: { playerId: string }): SimultaneousState => {
    if (!state.pending.includes(playerId)) throw new EngineError("NOT_YOUR_TURN")
    return nextStep(state, playerId)
  },
  view: (state: SimultaneousState, playerId: string | null) => ({ me: playerId ? { id: playerId } : null, round: state.round }),
  isOver: (state: SimultaneousState) => state.round >= 5,
  waitingFor: (state: SimultaneousState) => state.pending,
  autoPlayFor: (state: SimultaneousState, playerId: string) => nextStep(state, playerId),
}
function nextStep(state: SimultaneousState, playerId: string): SimultaneousState {
  const pending = state.pending.filter((id) => id !== playerId)
  return pending.length ? { ...state, pending } : { ...state, pending: [...state.players], round: state.round + 1 }
}

const SLUG = "testgame"
const CODE = "ABC234"
const KEY = `${SLUG}:${CODE}`
const gameOf = (GAME: AnyGameDefinition) =>
  ({
    slug: SLUG,
    name: "Test game",
    tagline: "",
    sanityProjectId: "",
    live: true,
    indexable: false,
    binding: { SLUG, NAME: "Test game", GAME },
  }) as unknown as GameRouteContext["game"]
const game = gameOf(GAME)

const ann = { id: "p1", nickname: "Ann" }
const bob = { id: "p2", nickname: "Bob" }
const cy = { id: "p3", nickname: "Cy" }

const stored = () => h.rows.get(KEY)!

function seed(partial: Partial<StoredRow> = {}): StoredRow {
  const row: StoredRow = {
    game: SLUG,
    code: CODE,
    host_id: "p1",
    status: "lobby",
    players: [ann],
    options: { rounds: 3 },
    state: null,
    replay: [],
    takeover_votes: [],
    seen: {},
    ready_at: {},
    ready_deadline: null,
    version: 1,
    created_at: "2026-01-01T10:00:00.000Z",
    updated_at: "2026-01-01T10:00:00.000Z",
    ...partial,
  }
  h.rows.set(KEY, row)
  return row
}

/** A concurrent request wins the race for the next write: `change` is applied to the table and its version moves on. */
function race(change: (row: StoredRow) => Partial<StoredRow>) {
  h.beforeUpdate = () => {
    const row = stored()
    h.rows.set(KEY, { ...row, ...change(row), version: row.version + 1 })
  }
}

/** A table in play where the turn is at `turn` and the game ends after `length` moves; the players move in order. */
function playing(ids: string[], turn: number, length = 10, partial: Partial<StoredRow> = {}) {
  return seed({
    status: "playing",
    host_id: ids[0] ?? "",
    players: ids.map((id) => ({ id, nickname: id.toUpperCase() })),
    state: { players: ids, turn, length } satisfies TestState,
    version: 7,
    ...partial,
  })
}

/** A table whose game has not moved for ten minutes, with everyone seen a moment ago: the others may vote to play for the waiting player. */
const stalled = (ids: string[], turn: number, length = 10) =>
  playing(ids, turn, length, {
    seen: Object.fromEntries(ids.map((id) => [id, new Date().toISOString()])),
    updated_at: new Date(Date.now() - 10 * 60_000).toISOString(),
  })

/** A table in its ready check: the game set up for `ids`, `done` of them have said they are ready, and the time is up in `left` ms (negative: it was up that long ago). */
function starting(ids: string[], done: string[], left = 30_000, partial: Partial<StoredRow> = {}) {
  return seed({
    status: "starting",
    host_id: ids[0] ?? "",
    players: ids.map((id) => ({ id, nickname: id.toUpperCase() })),
    state: { players: ids, turn: 0, length: 3 } satisfies TestState,
    ready_at: Object.fromEntries(done.map((id) => [id, new Date().toISOString()])),
    ready_deadline: new Date(Date.now() + left).toISOString(),
    version: 7,
    ...partial,
  })
}

type Handler = (request: Request, context: GameRouteContext) => Promise<Response>
async function call(handler: Handler, body: unknown = {}, code: string | null = CODE, bound = game) {
  const url = `http://localhost/api/${SLUG}/games${code ? `/${code}` : ""}`
  return handler(new Request(url, { method: "POST", body: JSON.stringify(body) }), { game: bound, params: code ? { code } : {} })
}

/** What was sent to PostHog since the last call, once the responses have left (the `after` callbacks run). */
function tracked() {
  h.scheduled.splice(0).forEach((callback) => callback())
  const sent = h.track.mock.calls.map(([event, distinctId, properties]) => ({ event, distinctId, properties }))
  h.track.mockClear()
  return sent
}
const names = () => tracked().map((entry) => entry.event)

/** Runs what the routes left for after the response (`after`), and waits for it: the writes that tell the database how a game began and ended. */
async function afterResponse() {
  await Promise.all(h.scheduled.splice(0).map((callback) => callback()))
}

beforeEach(() => {
  h.rows.clear()
  h.scheduled.length = 0
  h.beforeUpdate = null
  h.beforeDelete = null
  h.deleteError = null
  h.track.mockReset()
  h.seatMember.mockClear()
  h.record.mockClear()
  h.started.mockClear()
  h.takenOver.mockClear()
  h.busy = []
  h.rpcCalls.length = 0
  h.playerId = null
  h.account = null
  h.settings.maxPlayers = 3
  h.settings.minPlayers = 2
  h.settings.turnTimeout = 60
})

describe("game_created", () => {
  it("is sent once the response has left, with the table's options and nothing a player typed", async () => {
    h.playerId = "p1"
    const response = await call(create, { nickname: "Ann" }, null)
    expect(response.status).toBe(200)
    expect(h.track).not.toHaveBeenCalled()
    expect(tracked()).toEqual([{ event: "game_created", distinctId: "p1", properties: { game: SLUG, options: { rounds: 3 }, max_players: 3, locale: "en" } }])
  })

  it("is not sent when the nickname is refused", async () => {
    h.playerId = "p1"
    expect((await call(create, { nickname: "  " }, null)).status).toBe(400)
    expect(names()).toEqual([])
  })
})

describe("player_joined", () => {
  it("is sent for a seat taken, with the seat and the size of the table", async () => {
    seed()
    h.playerId = "p2"
    expect((await call(join, { nickname: "Bob" })).status).toBe(200)
    expect(tracked()).toEqual([{ event: "player_joined", distinctId: "p2", properties: { game: SLUG, seat: 1, players: 2 } }])
  })

  it("is sent once, for the seat really taken, when the write lost a race", async () => {
    seed()
    h.playerId = "p2"
    race((row) => ({ players: [...row.players, cy] }))
    expect((await call(join, { nickname: "Bob" })).status).toBe(200)
    expect(tracked()).toEqual([{ event: "player_joined", distinctId: "p2", properties: { game: SLUG, seat: 2, players: 3 } }])
    expect(stored().players.map((player) => player.id)).toEqual(["p1", "p3", "p2"])
  })

  it("is not sent when the same player was seated by another request in the meantime", async () => {
    seed()
    h.playerId = "p2"
    race((row) => ({ players: [...row.players, bob] }))
    expect((await call(join, { nickname: "Bobby" })).status).toBe(200)
    expect(names()).toEqual([])
    expect(stored().players).toEqual([ann, { id: "p2", nickname: "Bobby" }])
  })

  it("is not sent for a rename in the lobby, a full table or a game in progress", async () => {
    seed({ players: [ann, bob] })
    h.playerId = "p2"
    expect((await call(join, { nickname: "Bobby" })).status).toBe(200)

    seed({ players: [ann, bob, cy] })
    h.playerId = "p4"
    expect((await call(join, { nickname: "Dee" })).status).toBe(409)

    playing(["p1", "p2"], 0)
    expect((await call(join, { nickname: "Dee" })).status).toBe(409)
    expect(names()).toEqual([])
  })
})

describe("who sits down", () => {
  const seated = () => [...h.rows.values()][0]!.players

  it("is the account of a visitor who is signed in: its name and its picture, taken on the server, whatever the request says", async () => {
    h.playerId = "p1"
    h.account = { id: "acct-anne", nickname: "Anne Martin", avatarUrl: "https://cdn.example/anne.png" }
    expect((await call(create, { nickname: "Someone else", avatarUrl: "https://evil.example/x.png" }, null)).status).toBe(200)
    expect(seated()).toEqual([{ id: "p1", nickname: "Anne Martin", avatarUrl: "https://cdn.example/anne.png" }])
  })

  it("is the nickname that a guest typed, with no picture", async () => {
    h.playerId = "p1"
    expect((await call(create, { nickname: "  Ann  ", avatarUrl: "https://evil.example/x.png" }, null)).status).toBe(200)
    expect(seated()).toEqual([{ id: "p1", nickname: "Ann" }])
  })

  it("is the account again at the table of somebody else, and an account needs no nickname", async () => {
    seed()
    h.playerId = "p2"
    h.account = { id: "acct-bob", nickname: "Bob B.", avatarUrl: null }
    expect((await call(join, {})).status).toBe(200)
    expect(stored().players).toEqual([ann, { id: "p2", nickname: "Bob B." }])
  })

  it("still refuses a guest with no nickname", async () => {
    seed()
    h.playerId = "p2"
    expect((await call(join, {})).status).toBe(400)
    expect(stored().players).toEqual([ann])
  })

  it("gives the engine the id and the nickname of each player and nothing else: the picture of an account is for the seat labels, not for the state", async () => {
    seed({ players: [{ ...ann, avatarUrl: "https://cdn.example/ann.png" }, bob] })
    h.playerId = "p1"
    const setup = vi.fn(GAME.setup)
    expect((await call(start, {}, CODE, gameOf({ ...GAME, setup }))).status).toBe(200)
    expect(setup.mock.calls[0]![0].players).toEqual([ann, bob])
  })
})

describe("whose seat it is", () => {
  const settle = () => h.scheduled.splice(0).forEach((callback) => callback())

  it("is told to the database for a member who opens a table, once the response has left, and never to the browser", async () => {
    h.playerId = "p1"
    h.account = { id: "acct-anne", nickname: "Anne Martin", avatarUrl: null }
    const response = await call(create, {}, null)
    expect(response.status).toBe(200)
    expect(h.seatMember).not.toHaveBeenCalled()
    settle()
    const code = [...h.rows.values()][0]!.code
    expect(h.seatMember).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ slug: SLUG }), code, "p1", "acct-anne")
    expect(JSON.stringify(await response.json())).not.toContain("acct-anne")
  })

  it("is told for a member who joins a table", async () => {
    seed()
    h.playerId = "p2"
    h.account = { id: "acct-bob", nickname: "Bob B.", avatarUrl: null }
    expect((await call(join, {})).status).toBe(200)
    settle()
    expect(h.seatMember).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ slug: SLUG }), CODE, "p2", "acct-bob")
  })

  it("is told with no account for a guest, so that nothing is written", async () => {
    seed()
    h.playerId = "p2"
    expect((await call(join, { nickname: "Bob" })).status).toBe(200)
    settle()
    expect(h.seatMember).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ slug: SLUG }), CODE, "p2", null)
  })

  it("is not told for the demo account of development: it is in no database", async () => {
    seed()
    h.playerId = "p2"
    h.account = { id: "demo", nickname: "Oré", avatarUrl: null }
    expect((await call(join, {})).status).toBe(200)
    settle()
    expect(h.seatMember).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ slug: SLUG }), CODE, "p2", null)
  })
})

describe("game_started", () => {
  it("is sent for the host when the last player says they are ready, not when the host starts the table", async () => {
    seed({ players: [ann, bob] })
    h.playerId = "p1"
    expect((await call(start)).status).toBe(200)
    expect(stored().status).toBe("starting")
    expect(names()).toEqual([])

    expect((await call(ready)).status).toBe(200)
    expect(names()).toEqual([])
    h.playerId = "p2"
    expect((await call(ready)).status).toBe(200)
    expect(tracked()).toEqual([{ event: "game_started", distinctId: "p1", properties: { game: SLUG, players: 2, options: { rounds: 3 } } }])
    expect(stored().status).toBe("playing")
  })

  it("is not sent when someone else starts, the table is too small, the game already started or is being started", async () => {
    seed({ players: [ann, bob] })
    h.playerId = "p2"
    expect((await call(start)).status).toBe(403)

    seed()
    h.playerId = "p1"
    expect((await call(start)).status).toBe(400)

    playing(["p1", "p2"], 0)
    expect((await call(start)).status).toBe(409)

    starting(["p1", "p2"], [])
    expect((await call(start)).status).toBe(409)
    expect(names()).toEqual([])
  })

  it("is sent once when the last two players say they are ready at the same time", async () => {
    starting(["p1", "p2", "p3"], ["p1"])
    h.playerId = "p2"
    // p3's request wins the race for the next write, so p2's runs again on the table as it is then, and p2 is the last
    race((row) => ({ ready_at: { ...row.ready_at, p3: new Date().toISOString() } }))
    expect((await call(ready)).status).toBe(200)
    expect(tracked()).toEqual([{ event: "game_started", distinctId: "p1", properties: { game: SLUG, players: 3, options: { rounds: 3 } } }])
    expect(stored().status).toBe("playing")
  })

  it("is not sent by a request that lost the race to the one that began the game", async () => {
    starting(["p1", "p2"], ["p1"])
    h.playerId = "p2"
    race(() => ({ status: "playing", ready_at: {}, ready_deadline: null }))
    expect((await call(ready)).status).toBe(200)
    expect(names()).toEqual([])
    expect(stored().status).toBe("playing")
  })
})

describe("the ready check", () => {
  const body = async (response: Response) => (await response.json()) as { status: string; ready: string[]; readyInMs: number | null; meId: string | null; players: Array<{ id: string }>; view: unknown }

  it("is opened by the host's start: the game is set up for the seats, the table is starting and the players have a minute", async () => {
    seed({ players: [ann, bob] })
    h.playerId = "p1"
    const before = Date.now()
    const table = await body(await call(start))
    expect(table).toMatchObject({ status: "starting", ready: [], meId: "p1" })
    // The board of a seated player is drawn from their view of the game, behind the curtain
    expect(table.view).toEqual({ me: { id: "p1" }, turn: 0 })
    expect(table.readyInMs).toBeGreaterThan(59_000)
    expect(table.readyInMs).toBeLessThanOrEqual(60_000)
    expect(stored()).toMatchObject({ status: "starting", state: { players: ["p1", "p2"], turn: 0, length: 3 }, ready_at: {} })
    expect(Date.parse(stored().ready_deadline!)).toBeGreaterThanOrEqual(before + 60_000)
  })

  it("marks each player who says they are ready, in seat order, and begins the game with the last one", async () => {
    starting(["p1", "p2", "p3"], [])
    h.playerId = "p3"
    expect(await body(await call(ready))).toMatchObject({ status: "starting", ready: ["p3"] })
    h.playerId = "p1"
    expect(await body(await call(ready))).toMatchObject({ status: "starting", ready: ["p1", "p3"] })
    const version = stored().version

    h.playerId = "p2"
    const table = await body(await call(ready))
    expect(table).toMatchObject({ status: "playing", ready: [], readyInMs: null })
    expect(table.view).toEqual({ me: { id: "p2" }, turn: 0 })
    expect(stored()).toMatchObject({ status: "playing", ready_at: {}, ready_deadline: null, state: { players: ["p1", "p2", "p3"], turn: 0, length: 3 } })
    expect(stored().version).toBe(version + 1)
  })

  it("lets the game be played once it has begun, and not before", async () => {
    starting(["p1", "p2"], ["p1"])
    h.playerId = "p1"
    expect((await call(action, { type: "move" })).status).toBe(409)
    h.playerId = "p2"
    await call(ready)
    h.playerId = "p1"
    expect((await call(action, { type: "move" })).status).toBe(200)
  })

  it("changes nothing when a player says it again, when it is not a ready check, or for a stranger who is refused", async () => {
    starting(["p1", "p2"], ["p1"])
    h.playerId = "p1"
    const version = stored().version
    expect((await call(ready)).status).toBe(200)
    expect(stored().version).toBe(version)

    h.playerId = "stranger"
    expect((await call(ready)).status).toBe(403)
    h.playerId = null
    expect((await call(ready)).status).toBe(403)

    for (const status of ["lobby", "playing", "over"] as const) {
      seed({ status, players: [ann, bob], state: status === "lobby" ? null : { players: ["p1", "p2"], turn: 0, length: 3 } })
      h.playerId = "p2"
      expect(await body(await call(ready))).toMatchObject({ status })
      expect(stored().version).toBe(1)
    }
  })

  it("ends when the time is up, at the first look at the table: whoever was not ready is unseated and the others are back in the lobby", async () => {
    starting(["p1", "p2", "p3"], ["p1", "p3"], -1000)
    h.playerId = "p3"
    const table = await body(await call(read))
    expect(table).toMatchObject({ status: "lobby", ready: [], readyInMs: null, meId: "p3", view: null })
    expect(table.players.map((player) => player.id)).toEqual(["p1", "p3"])
    expect(stored()).toMatchObject({ status: "lobby", host_id: "p1", state: null, ready_at: {}, ready_deadline: null })
    expect(names()).toEqual([])
  })

  it("gives the unseated player a table they are not at any more, and hands the table to the first seat left when the host was not ready", async () => {
    starting(["p1", "p2", "p3"], ["p2", "p3"], -1000)
    h.playerId = "p1"
    const table = await body(await call(read))
    expect(table).toMatchObject({ status: "lobby", meId: null })
    expect(stored()).toMatchObject({ host_id: "p2" })
    expect(stored().players.map((player) => player.id)).toEqual(["p2", "p3"])
  })

  it("is ended by a player who says they are ready too late, who is then unseated like the others who were not", async () => {
    starting(["p1", "p2"], ["p1"], -1000)
    h.playerId = "p2"
    expect(await body(await call(ready))).toMatchObject({ status: "lobby", meId: null })
    expect(stored().players.map((player) => player.id)).toEqual(["p1"])
    expect(names()).toEqual([])
  })

  it("does not touch a ready check that still has time, whoever looks at it", async () => {
    starting(["p1", "p2"], ["p1"], 30_000)
    h.playerId = "p2"
    const version = stored().version
    expect(await body(await call(read))).toMatchObject({ status: "starting", ready: ["p1"], meId: "p2" })
    expect(stored().version).toBe(version)
  })

  it("lets the host start again once it has ended, with the players who are left", async () => {
    starting(["p1", "p2", "p3"], ["p1", "p2"], -1000)
    h.playerId = "p1"
    expect(await body(await call(start))).toMatchObject({ status: "starting", ready: [] })
    expect(stored().players.map((player) => player.id)).toEqual(["p1", "p2"])
    expect(stored().state).toMatchObject({ players: ["p1", "p2"] })
  })

  it("is ended for everybody by a player who leaves it, who is unseated, the game set up for the seats it had dropped", async () => {
    starting(["p1", "p2", "p3"], ["p1", "p2"])
    h.playerId = "p3"
    expect(await body(await call(leave))).toMatchObject({ status: "lobby", meId: null })
    expect(stored()).toMatchObject({ status: "lobby", host_id: "p1", state: null, ready_at: {}, ready_deadline: null })
    expect(stored().players.map((player) => player.id)).toEqual(["p1", "p2"])

    starting(["p1", "p2", "p3"], [])
    h.playerId = "p1"
    await call(leave)
    expect(stored()).toMatchObject({ status: "lobby", host_id: "p2" })

    starting(["p1", "p2"], [])
    h.playerId = "stranger"
    const version = stored().version
    await call(leave)
    expect(stored()).toMatchObject({ status: "starting", version })
  })

  it("turns away a new player and the host's changes to the options while the game is being set up", async () => {
    starting(["p1", "p2"], [])
    h.playerId = "p3"
    expect((await call(join, { nickname: "Cy" })).status).toBe(409)
    h.playerId = "p1"
    expect((await call(options, { options: { rounds: 5 } })).status).toBe(409)
    expect(stored()).toMatchObject({ status: "starting", options: { rounds: 3 } })
  })

  it("makes whoever sits down at a lobby that its ready check emptied the host, when the table could not be deleted (it is deleted otherwise: PLT-21)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    h.deleteError = { code: "57P01", message: "terminating connection" }
    starting(["p1", "p2"], [], -1000)
    h.playerId = "p1"
    await call(read)
    expect(stored().players).toEqual([])
    h.deleteError = null
    h.playerId = "p3"
    expect((await call(join, { nickname: "Cy" })).status).toBe(200)
    expect(stored()).toMatchObject({ host_id: "p3", players: [cy] })
  })
})

describe("game_finished", () => {
  it("is sent for the move that ends the game, and only for that one", async () => {
    playing(["p1", "p2"], 1, 3)
    h.playerId = "p2"
    expect((await call(action, { type: "move" })).status).toBe(200)
    expect(names()).toEqual([])

    h.playerId = "p1"
    expect((await call(action, { type: "move" })).status).toBe(200)
    const [finished, ...others] = tracked()
    expect(others).toEqual([])
    expect(finished).toMatchObject({
      event: "game_finished",
      distinctId: "p1",
      properties: { game: SLUG, players: 2, moves_count: 9, ended_by: "natural", approximate: true },
    })
    expect(typeof (finished?.properties as { duration_s?: unknown }).duration_s).toBe("number")
    expect(stored().status).toBe("over")
  })

  it("is not sent for a move the engine refuses", async () => {
    playing(["p1", "p2"], 2, 3)
    h.playerId = "p2"
    expect((await call(action, { type: "move" })).status).toBe(400)
    expect(names()).toEqual([])
  })
})

describe("rematch_started", () => {
  it("is sent when the last vote restarts the table, not for the first vote nor for a repeated one", async () => {
    seed({ status: "over", players: [ann, bob], state: { players: ["p1", "p2"], turn: 3, length: 3 } })
    h.playerId = "p1"
    expect((await call(replay)).status).toBe(200)
    expect((await call(replay)).status).toBe(200)
    expect(names()).toEqual([])
    expect(stored().status).toBe("over")

    h.playerId = "p2"
    expect((await call(replay)).status).toBe(200)
    expect(tracked()).toEqual([{ event: "rematch_started", distinctId: "p2", properties: { game: SLUG } }])
    expect(stored().status).toBe("playing")
  })

  it("is not sent while the game is not over", async () => {
    playing(["p1", "p2"], 0)
    h.playerId = "p1"
    expect((await call(replay)).status).toBe(409)
    expect(names()).toEqual([])
  })
})

describe("takeover events", () => {
  it("sends takeover_vote_started for the first vote of a stalled turn, and nothing for the same vote again", async () => {
    stalled(["p1", "p2", "p3"], 1)
    h.playerId = "p1"
    expect((await call(takeover)).status).toBe(200)
    expect(tracked()).toEqual([{ event: "takeover_vote_started", distinctId: "p1", properties: { game: SLUG } }])
    expect(stored().takeover_votes).toHaveLength(1)

    expect((await call(takeover)).status).toBe(200)
    expect(names()).toEqual([])
  })

  it("sends takeover_completed and turn_auto_played, not started again, for the vote that completes the takeover", async () => {
    stalled(["p1", "p2", "p3"], 1)
    h.playerId = "p1"
    await call(takeover)
    expect(names()).toEqual(["takeover_vote_started"])

    h.playerId = "p3"
    expect((await call(takeover)).status).toBe(200)
    expect(tracked()).toEqual([
      { event: "takeover_completed", distinctId: "p3", properties: { game: SLUG } },
      { event: "turn_auto_played", distinctId: "p3", properties: { game: SLUG, reason: "takeover" } },
    ])
    expect((stored().state as TestState).turn).toBe(2)
    expect(stored().takeover_votes).toEqual([])
  })

  it("sends started, completed and auto-played from one request on a table of two", async () => {
    stalled(["p1", "p2"], 1)
    h.playerId = "p1"
    expect((await call(takeover)).status).toBe(200)
    expect(names()).toEqual(["takeover_vote_started", "takeover_completed", "turn_auto_played"])
  })

  it("sends one turn_auto_played per player played for when a step owed by several players is taken over", async () => {
    seed({
      status: "playing",
      players: [ann, bob, cy],
      state: { players: ["p1", "p2", "p3"], pending: ["p2", "p3"], round: 0 } satisfies SimultaneousState,
      version: 7,
      seen: { p1: new Date().toISOString() },
      updated_at: new Date(Date.now() - 10 * 60_000).toISOString(),
    })
    h.playerId = "p1"
    expect((await call(takeover, {}, CODE, gameOf(SIMULTANEOUS))).status).toBe(200)
    const played = { event: "turn_auto_played", distinctId: "p1", properties: { game: SLUG, reason: "takeover" } }
    expect(tracked()).toEqual([
      { event: "takeover_vote_started", distinctId: "p1", properties: { game: SLUG } },
      { event: "takeover_completed", distinctId: "p1", properties: { game: SLUG } },
      played,
      played,
    ])
    expect((stored().state as SimultaneousState).round).toBe(1)
  })

  it("adds game_finished when the move played for the absent player ends the game", async () => {
    stalled(["p1", "p2"], 1, 2)
    h.playerId = "p1"
    expect((await call(takeover)).status).toBe(200)
    expect(names()).toEqual(["takeover_vote_started", "takeover_completed", "turn_auto_played", "game_finished"])
    expect(stored().status).toBe("over")
  })

  it("does not keep the 'started' flag of a run whose write was lost, when the vote turns out to be there already", async () => {
    const row = stalled(["p1", "p2", "p3"], 1)
    h.playerId = "p1"
    const fingerprint = stateFingerprint(row.state)
    race(() => ({ takeover_votes: [voteEntry(fingerprint, { voter: "p1", target: "p2" })] }))
    expect((await call(takeover)).status).toBe(200)
    expect(names()).toEqual([])
  })

  it("sends nothing when the turn is not stalled yet", async () => {
    playing(["p1", "p2", "p3"], 1, 10, { updated_at: new Date().toISOString() })
    h.playerId = "p1"
    expect((await call(takeover)).status).toBe(409)
    expect(names()).toEqual([])
  })
})

describe("the result of a game", () => {
  it("is written down once the response has left, for the move that ends the game and for that one only", async () => {
    playing(["p1", "p2"], 1, 3)
    h.playerId = "p2"
    expect((await call(action, { type: "move" })).status).toBe(200)
    await afterResponse()
    expect(h.record).not.toHaveBeenCalled()

    h.playerId = "p1"
    expect((await call(action, { type: "move" })).status).toBe(200)
    expect(h.record).not.toHaveBeenCalled()
    await afterResponse()
    expect(h.record).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ slug: SLUG }), expect.objectContaining({ code: CODE, status: "over", version: 9 }))
  })

  it("is written once when two requests end the game together: the other is refused, as it always was", async () => {
    playing(["p1", "p2"], 2, 3)
    h.playerId = "p1"
    const answers = await Promise.all([call(action, { type: "move" }), call(action, { type: "move" })])
    expect(answers.map((answer) => answer.status).sort()).toEqual([200, 409])
    await afterResponse()
    expect(h.record).toHaveBeenCalledTimes(1)
    expect(stored().status).toBe("over")
  })

  it("is not written by a move the engine refuses, nor by one that lost the race to the move that ended the game", async () => {
    playing(["p1", "p2"], 2, 3)
    h.playerId = "p2"
    expect((await call(action, { type: "move" })).status).toBe(400)

    h.playerId = "p1"
    race(() => ({ status: "over", state: { players: ["p1", "p2"], turn: 3, length: 3 } satisfies TestState }))
    expect((await call(action, { type: "move" })).status).toBe(409)
    await afterResponse()
    expect(h.record).not.toHaveBeenCalled()
  })

  it("is written, with the players the others played for named, when a takeover ends the game; they are told to the table first", async () => {
    stalled(["p1", "p2"], 1, 2)
    h.playerId = "p1"
    expect((await call(takeover)).status).toBe(200)
    await afterResponse()
    expect(h.takenOver).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ slug: SLUG }), CODE, ["p2"])
    expect(h.record).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ slug: SLUG }), expect.objectContaining({ status: "over" }), { takenOver: ["p2"] })
    expect(h.takenOver.mock.invocationCallOrder[0]).toBeLessThan(h.record.mock.invocationCallOrder[0]!)
  })

  it("tells the table who was played for by a takeover that does not end the game, and writes no result; a vote alone tells nothing", async () => {
    stalled(["p1", "p2", "p3"], 1)
    h.playerId = "p1"
    expect((await call(takeover)).status).toBe(200)
    await afterResponse()
    expect(h.takenOver).not.toHaveBeenCalled()

    h.playerId = "p3"
    expect((await call(takeover)).status).toBe(200)
    await afterResponse()
    expect(h.takenOver).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ slug: SLUG }), CODE, ["p2"])
    expect(h.record).not.toHaveBeenCalled()
  })

  it("is written for a debug command that ends the game, marked as one, and not again by a command that finds the game over", async () => {
    const debuggable = gameOf({ ...GAME, debug: { over: (state: TestState) => ({ ...state, turn: state.length }) } })
    playing(["p1", "p2"], 1, 5)
    h.playerId = "p1"
    expect((await call(debug, { command: "over" }, CODE, debuggable)).status).toBe(200)
    await afterResponse()
    expect(h.record).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ slug: SLUG }), expect.objectContaining({ status: "over" }), { debug: true })

    h.record.mockClear()
    expect((await call(debug, { command: "over" }, CODE, debuggable)).status).toBe(200)
    await afterResponse()
    expect(h.record).not.toHaveBeenCalled()
  })

  it("is not written by a debug command that leaves the game going, and a debug start begins a game", async () => {
    const debuggable = gameOf({ ...GAME, debug: { turn: (state: TestState) => ({ ...state, turn: state.turn + 1 }) } })
    playing(["p1", "p2"], 1, 5)
    h.playerId = "p1"
    expect((await call(debug, { command: "turn" }, CODE, debuggable)).status).toBe(200)
    await afterResponse()
    expect(h.record).not.toHaveBeenCalled()
    expect(h.started).not.toHaveBeenCalled()

    expect((await call(debug, { command: "start" }, CODE, debuggable)).status).toBe(200)
    await afterResponse()
    expect(h.started).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ slug: SLUG }), expect.objectContaining({ code: CODE, status: "playing" }))
    expect(h.record).not.toHaveBeenCalled()
  })
})

describe("the start of a game", () => {
  it("is told to the table when the last player says they are ready, once the response has left, and not before", async () => {
    starting(["p1", "p2"], [])
    h.playerId = "p1"
    expect((await call(ready)).status).toBe(200)
    await afterResponse()
    expect(h.started).not.toHaveBeenCalled()

    h.playerId = "p2"
    expect((await call(ready)).status).toBe(200)
    expect(h.started).not.toHaveBeenCalled()
    await afterResponse()
    expect(h.started).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ slug: SLUG }), expect.objectContaining({ code: CODE, status: "playing" }))
  })

  it("is told again when the last vote of a rematch starts the next game, and not for the votes before it", async () => {
    seed({ status: "over", players: [ann, bob], state: { players: ["p1", "p2"], turn: 3, length: 3 } })
    h.playerId = "p1"
    expect((await call(replay)).status).toBe(200)
    await afterResponse()
    expect(h.started).not.toHaveBeenCalled()

    h.playerId = "p2"
    expect((await call(replay)).status).toBe(200)
    await afterResponse()
    expect(h.started).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ slug: SLUG }), expect.objectContaining({ status: "playing" }))
  })
})

describe("a ranked table", () => {
  it("is opened with its flag; a normal table is opened without the column at all, as it always was", async () => {
    const host = { id: "p1", nickname: "Ann" }
    await createGame(game, host)
    expect([...h.rows.values()]).toHaveLength(1)
    expect([...h.rows.values()][0]).not.toHaveProperty("ranked")

    h.rows.clear()
    await createGame(game, host, undefined, { ranked: true })
    expect([...h.rows.values()][0]).toMatchObject({ ranked: true, status: "lobby" })
  })
})

describe("chat_message_sent", () => {
  it("says a text was sent, never what it said", async () => {
    seed({ players: [ann, bob] })
    h.playerId = "p1"
    expect((await call(chat, { text: "the password is swordfish" })).status).toBe(200)
    const sent = tracked()
    expect(sent).toEqual([{ event: "chat_message_sent", distinctId: "p1", properties: { game: SLUG, kind: "text" } }])
    expect(JSON.stringify(sent)).not.toContain("swordfish")
  })

  it("says a reaction was sent, not which one", async () => {
    seed({ players: [ann, bob] })
    h.playerId = "p2"
    const reaction = [...DEFAULT_REACTION_IDS][0]!
    expect((await call(chat, { reaction })).status).toBe(200)
    expect(tracked()).toEqual([{ event: "chat_message_sent", distinctId: "p2", properties: { game: SLUG, kind: "reaction" } }])
  })

  it("sends nothing for a message that is refused", async () => {
    seed({ players: [ann, bob] })
    h.playerId = null
    expect((await call(chat, { text: "hello" })).status).toBe(401)
    h.playerId = "stranger"
    expect((await call(chat, { text: "hello" })).status).toBe(403)
    h.playerId = "p1"
    expect((await call(chat, { text: "   " })).status).toBe(400)
    expect(names()).toEqual([])
  })
})

describe("a table that nobody sits at any more is deleted (PLT-21)", () => {
  it("is what happens to a lobby when its last player leaves it", async () => {
    seed({ players: [ann], version: 4 })
    h.playerId = "p1"
    const answer = await call(leave)
    expect(answer.status).toBe(200)
    expect(h.rows.has(KEY)).toBe(false)
    // The table is gone for whoever comes with its link
    h.playerId = "p3"
    expect((await call(join, { nickname: "Cy" })).status).toBe(404)
    expect((await call(read)).status).toBe(404)
  })

  it("is what happens to a ready check when its last player leaves it", async () => {
    starting(["p1"], [])
    h.playerId = "p1"
    expect((await call(leave)).status).toBe(200)
    expect(h.rows.has(KEY)).toBe(false)
  })

  it("is not what happens while somebody still sits at it: the host goes and the table goes on, and a seat that left leaves the others their table", async () => {
    seed({ players: [ann, bob] })
    h.playerId = "p1"
    await call(leave)
    expect(stored()).toMatchObject({ host_id: "p2" })
    expect(stored().players.map((player) => player.id)).toEqual(["p2"])
    // A game in progress where one player is left keeps its table, whoever left
    playing(["p1", "p2"], 0)
    h.playerId = "p1"
    await call(leave)
    expect(stored().players.map((player) => player.left)).toEqual([true, undefined])
  })

  it("is what happens to a ready check that ends with nobody ready, the first time somebody looks at it", async () => {
    starting(["p1", "p2"], [], -1000)
    h.playerId = "p1"
    const answer = await call(read)
    // The look that ended the check saw the lobby it left, which is empty; the next finds no table
    expect(answer.status).toBe(200)
    expect(h.rows.has(KEY)).toBe(false)
    expect((await call(read)).status).toBe(404)
  })

  it("is not what happens to a ready check that ends with somebody ready: the lobby is theirs", async () => {
    starting(["p1", "p2"], ["p2"], -1000)
    h.playerId = "p1"
    await call(read)
    expect(stored()).toMatchObject({ status: "lobby", host_id: "p2" })
    expect(stored().players.map((player) => player.id)).toEqual(["p2"])
  })

  it("keeps the table of a player who sat down between the write that emptied it and the delete", async () => {
    seed({ players: [ann], version: 4 })
    h.playerId = "p1"
    h.beforeDelete = () => {
      const row = stored()
      h.rows.set(KEY, { ...row, players: [bob], host_id: "p2", version: row.version + 1 })
    }
    expect((await call(leave)).status).toBe(200)
    expect(stored().players.map((player) => player.id)).toEqual(["p2"])
  })

  it("leaves the table to the nightly clean-up, and the leave stands, when the database cannot delete it", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    seed({ players: [ann], version: 4 })
    h.playerId = "p1"
    h.deleteError = { code: "57P01", message: "terminating connection" }
    expect((await call(leave)).status).toBe(200)
    expect(stored().players).toEqual([])
    expect(console.error).toHaveBeenCalled()
  })

  it("is never what a request that changes nothing does: a stranger asking to leave an empty table does not delete it", async () => {
    seed({ players: [], host_id: "p1", version: 4 })
    h.playerId = "stranger"
    await call(leave)
    expect(stored()).toMatchObject({ version: 4, players: [] })
  })
})

describe("table_deleted", () => {
  const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
  /** What the deletions told PostHog since the last look */
  const deletions = () => tracked().filter((entry) => entry.event === "table_deleted")

  it("says that the last player left the lobby, for nobody: the identifier is one that is used once", async () => {
    seed({ players: [ann], version: 4 })
    h.playerId = "p1"
    await call(leave)
    const [only, ...more] = deletions()
    expect(more).toEqual([])
    expect(only).toEqual({ event: "table_deleted", distinctId: expect.stringMatching(ID), properties: { game: SLUG, reason: "lobby_left" } })
    expect(only?.distinctId).not.toBe("p1")
  })

  it("says that the last player left the ready check", async () => {
    starting(["p1"], [])
    h.playerId = "p1"
    await call(leave)
    expect(deletions().map((entry) => entry.properties)).toEqual([{ game: SLUG, reason: "ready_check_left" }])
  })

  it("says that everybody left the game in progress", async () => {
    withLeftPlayers(["p1", "p2"], ["p1"])
    h.playerId = "p2"
    await call(leave)
    expect(deletions().map((entry) => entry.properties)).toEqual([{ game: SLUG, reason: "game_left" }])
  })

  it("says that a ready check ended with nobody ready, at the first look at the table", async () => {
    starting(["p1", "p2"], [], -1000)
    h.playerId = "p1"
    await call(read)
    expect(deletions().map((entry) => entry.properties)).toEqual([{ game: SLUG, reason: "nobody_ready" }])
    // The next look finds no table, and has nothing to say
    await call(read)
    expect(deletions()).toEqual([])
  })

  it("uses an identifier of its own for each table", async () => {
    seed({ players: [ann], version: 4 })
    h.playerId = "p1"
    await call(leave)
    seed({ players: [ann], version: 4 })
    await call(leave)
    const ids = deletions().map((entry) => entry.distinctId)
    expect(ids).toHaveLength(2)
    expect(new Set(ids).size).toBe(2)
  })

  it("says nothing while somebody still sits at the table, or when the database could not delete it", async () => {
    seed({ players: [ann, bob] })
    h.playerId = "p1"
    await call(leave)
    expect(deletions()).toEqual([])

    vi.spyOn(console, "error").mockImplementation(() => {})
    seed({ players: [ann], version: 4 })
    h.deleteError = { code: "57P01", message: "terminating connection" }
    await call(leave)
    expect(deletions()).toEqual([])
  })

  it("holds nothing personal", async () => {
    seed({ players: [ann], version: 4 })
    h.playerId = "p1"
    await call(leave)
    for (const entry of deletions()) assertNoPersonalData(entry.properties)
  })
})

/** A game in progress where `left` of the players already left */
function withLeftPlayers(ids: string[], left: string[]) {
  return playing(ids, 1, 10, { players: ids.map((id) => ({ id, nickname: id.toUpperCase(), ...(left.includes(id) ? { left: true } : {}) })) })
}

describe("leaving a game in progress", () => {
  const table = async (response: Response) => (await response.json()) as { status: string; meId: string | null; players: Array<{ id: string; nickname: string; left?: boolean }>; view: { me: unknown; turn: number } | null; error?: string }
  const turn = () => (stored().state as TestState).turn
  /** A table in play where `left` of the players already left */
  const withLeft = (ids: string[], at: number, left: string[], length = 10) =>
    playing(ids, at, length, { players: ids.map((id) => ({ id, nickname: id.toUpperCase(), ...(left.includes(id) ? { left: true } : {}) })) })

  it("marks the seat of the player and keeps it at the table, tells PostHog and tells the table that the seat is not rated", async () => {
    playing(["p1", "p2", "p3"], 0)
    h.playerId = "p2"
    const answer = await table(await call(leave))
    expect(answer).toMatchObject({ status: "playing", meId: null })
    expect(answer.players).toEqual([
      { id: "p1", nickname: "P1" },
      { id: "p2", nickname: "P2", left: true },
      { id: "p3", nickname: "P3" },
    ])
    expect(stored().players[1]).toEqual({ id: "p2", nickname: "P2", left: true })
    expect(turn()).toBe(0)
    expect(tracked()).toEqual([{ event: "game_left", distinctId: "p2", properties: { game: SLUG, phase: "playing" } }])
    await afterResponse()
    expect(h.takenOver).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ slug: SLUG }), CODE, ["p2"])
    expect(h.record).not.toHaveBeenCalled()
  })

  it("plays the seat at once when the game is waiting for the player who leaves", async () => {
    playing(["p1", "p2", "p3"], 1)
    h.playerId = "p2"
    await call(leave)
    expect(turn()).toBe(2)
    expect(stored().status).toBe("playing")
    await afterResponse()
    expect(h.takenOver).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ slug: SLUG }), CODE, ["p2"])
  })

  it("plays the seat again whenever a move of the others reaches it, in the same write", async () => {
    withLeft(["p1", "p2", "p3"], 0, ["p2"])
    h.playerId = "p1"
    expect((await call(action, { type: "move" })).status).toBe(200)
    // p1 moved (turn 1), the game then waited for p2, who left: the server played it (turn 2), and the game waits for p3
    expect(turn()).toBe(2)
    expect(stored().version).toBe(8)
  })

  it("plays every turn in a row that belongs to players who left, and ends the game when the last move is theirs", async () => {
    withLeft(["p1", "p2", "p3"], 2, ["p2"], 3)
    h.playerId = "p3"
    const answer = await table(await call(leave))
    expect(turn()).toBe(3)
    expect(answer.status).toBe("over")
    expect(stored().status).toBe("over")
    expect(names()).toEqual(["game_left", "game_finished"])
    await afterResponse()
    expect(h.takenOver).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ slug: SLUG }), CODE, ["p3"])
    expect(h.record).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ slug: SLUG }), expect.objectContaining({ status: "over" }), { takenOver: ["p3"] })
    expect(h.takenOver.mock.invocationCallOrder[0]).toBeLessThan(h.record.mock.invocationCallOrder[0]!)
  })

  it("does not play a game out alone when the last player who is there leaves: the table is abandoned, and goes", async () => {
    withLeft(["p1", "p2"], 1, ["p1"])
    h.playerId = "p2"
    const answer = await table(await call(leave))
    // What the leave answered: nobody was left to play for, the game stays where it was
    expect(answer.players.map((player) => player.left)).toEqual([true, true])
    expect(answer.status).toBe("playing")
    expect(answer.view?.turn).toBe(1)
    // Nobody sits at it and nobody can come back: the table is deleted (PLT-21)
    expect(h.rows.has(KEY)).toBe(false)
    await afterResponse()
    expect(h.record).not.toHaveBeenCalled()
  })

  it("changes nothing for a player who leaves twice, a stranger, or a table that is over", async () => {
    withLeft(["p1", "p2", "p3"], 0, ["p2"])
    const version = stored().version
    h.playerId = "p2"
    await call(leave)
    h.playerId = "stranger"
    await call(leave)
    h.playerId = null
    await call(leave)
    expect(stored().version).toBe(version)
    expect(names()).toEqual([])

    seed({ status: "over", players: [ann, bob], state: { players: ["p1", "p2"], turn: 3, length: 3 }, version: 9 })
    h.playerId = "p1"
    await call(leave)
    expect(stored()).toMatchObject({ status: "over", version: 9 })
    expect(stored().players).toEqual([ann, bob])
  })

  it("unseats a player who leaves the lobby, and hands the table to the next one when the host goes", async () => {
    seed({ players: [ann, bob, cy] })
    h.playerId = "p2"
    await call(leave)
    expect(stored().players.map((player) => player.id)).toEqual(["p1", "p3"])
    h.playerId = "p1"
    await call(leave)
    expect(stored()).toMatchObject({ host_id: "p3" })
    // A lobby that is left is no event: the ready check and the game are
    expect(names()).toEqual([])
  })

  it("tells PostHog the player left from the ready check", async () => {
    starting(["p1", "p2", "p3"], [])
    h.playerId = "p3"
    await call(leave)
    expect(tracked()).toEqual([{ event: "game_left", distinctId: "p3", properties: { game: SLUG, phase: "starting" } }])
    await afterResponse()
    expect(h.takenOver).not.toHaveBeenCalled()
  })

  it("takes the player out of the table: they see it as anybody does, cannot play, chat or vote, and are not counted present", async () => {
    withLeft(["p1", "p2", "p3"], 0, ["p2"])
    h.playerId = "p2"
    expect(await table(await call(read))).toMatchObject({ meId: null, view: { me: null } })
    expect(await table(await call(action, { type: "move" }))).toEqual({ error: "LEFT_GAME" })
    expect((await call(chat, { text: "hello" })).status).toBe(403)
    expect((await call(takeover)).status).toBe(403)
    expect(turn()).toBe(0)
  })

  it("lets the others play for an absent player without waiting for the one who left", async () => {
    // p1 is absent, p2 left, p3 is there and is the only one who has to agree
    const ids = ["p1", "p2", "p3"]
    stalled(ids, 0)
    stored().players[1]!.left = true
    h.playerId = "p3"
    expect((await call(takeover)).status).toBe(200)
    // p1 was played for (turn 1), then the game waited for p2, who left: the server played that too, and the game waits for p3
    expect(turn()).toBe(2)
  })
})

describe("a table that does not start while a player is in a game", () => {
  it("is refused with PLAYER_BUSY when a seat is in a game somewhere else, and starts once the database finds none", async () => {
    seed({ players: [ann, bob] })
    h.playerId = "p1"
    h.busy = ["p2"]
    const refused = await call(start)
    expect(refused.status).toBe(409)
    expect(await refused.json()).toEqual({ error: "PLAYER_BUSY" })
    expect(stored().status).toBe("lobby")
    expect(h.rpcCalls).toEqual([{ name: "busy_seats", args: { p_game: SLUG, p_code: CODE, p_idle: "21600 seconds" } }])

    h.busy = []
    expect((await call(start)).status).toBe(200)
    expect(stored().status).toBe("starting")
  })

  it("is not started on a look that the table has outdated: somebody who sat down meanwhile was not checked", async () => {
    seed({ players: [ann, bob] })
    h.playerId = "p1"
    race((row) => ({ players: [...row.players, cy] }))
    const refused = await call(start)
    expect(refused.status).toBe(409)
    expect(await refused.json()).toEqual({ error: "CONFLICT" })
    expect(stored().status).toBe("lobby")
    // The host presses again: the table is looked at again, with three players
    expect((await call(start)).status).toBe(200)
    expect(stored()).toMatchObject({ status: "starting" })
  })

  it("asks the database nothing for a table that cannot start anyway", async () => {
    playing(["p1", "p2"], 0)
    h.playerId = "p1"
    expect((await call(start)).status).toBe(409)
    expect(h.rpcCalls).toEqual([])
  })
})

describe("the rematch of a table", () => {
  const over = (players: StoredRow["players"]) => seed({ status: "over", players, state: { players: players.map((player) => player.id), turn: 3, length: 3 } satisfies TestState })

  it("is played by the players who stayed: the one who left is not asked and the table drops them", async () => {
    over([ann, { ...bob, left: true }, cy])
    h.playerId = "p1"
    expect((await call(replay)).status).toBe(200)
    expect(stored().status).toBe("over")
    h.playerId = "p3"
    expect((await call(replay)).status).toBe(200)
    expect(stored()).toMatchObject({ status: "playing", host_id: "p1", replay: [] })
    expect(stored().players).toEqual([ann, cy])
    expect((stored().state as TestState).players).toEqual(["p1", "p3"])
    expect(names()).toEqual(["rematch_started"])
  })

  it("gives the table to the first player who stayed when the host is the one who left", async () => {
    over([{ ...ann, left: true }, bob, cy])
    h.playerId = "p2"
    await call(replay)
    h.playerId = "p3"
    await call(replay)
    expect(stored()).toMatchObject({ status: "playing", host_id: "p2" })
  })

  it("does not begin with fewer players than the game needs", async () => {
    over([ann, { ...bob, left: true }])
    h.playerId = "p1"
    const refused = await call(replay)
    expect(refused.status).toBe(400)
    expect(await refused.json()).toEqual({ error: "NOT_ENOUGH_PLAYERS" })
    expect(stored().status).toBe("over")
  })

  it("does not begin while one of the players is in a game somewhere else, and begins once they are not", async () => {
    over([ann, bob])
    h.playerId = "p1"
    h.busy = ["p2"]
    expect((await call(replay)).status).toBe(200)
    h.playerId = "p2"
    const refused = await call(replay)
    expect(refused.status).toBe(409)
    expect(await refused.json()).toEqual({ error: "PLAYER_BUSY" })
    expect(stored().status).toBe("over")
    h.busy = []
    expect((await call(replay)).status).toBe(200)
    expect(stored().status).toBe("playing")
  })
})
