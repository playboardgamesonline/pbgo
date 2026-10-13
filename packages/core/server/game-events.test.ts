import { EngineError, type AnyGameDefinition } from "@pbgo/engine-kit"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { GameRouteContext } from "../lib/binding"
import { DEFAULT_REACTION_IDS } from "../lib/chat"
import { POST as chat } from "../routes/api/games/[code]/chat/route"
import { POST as action } from "../routes/api/games/[code]/action/route"
import { POST as join } from "../routes/api/games/[code]/join/route"
import { POST as replay } from "../routes/api/games/[code]/replay/route"
import { POST as start } from "../routes/api/games/[code]/start/route"
import { POST as takeover } from "../routes/api/games/[code]/takeover/route"
import { POST as create } from "../routes/api/games/route"
import { stateFingerprint } from "./games"
import { voteEntry } from "./takeover"

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
  status: "lobby" | "playing" | "over"
  players: Array<{ id: string; nickname: string }>
  options: Record<string, number | string | boolean>
  state: unknown
  replay: string[]
  takeover_votes: string[]
  seen: Record<string, string>
  version: number
  updated_at: string
  created_at: string
}

const h = vi.hoisted(() => ({
  rows: new Map<string, StoredRow>(),
  /** Runs once, right before the next conditional update compares versions: a concurrent request that wins the race */
  beforeUpdate: null as (() => void) | null,
  scheduled: [] as Array<() => unknown>,
  track: vi.fn<(event: string, distinctId: string, properties: object) => Promise<void>>(async () => {}),
  playerId: null as string | null,
  settings: { options: { defaults: {}, hidden: [] as string[] }, maxPlayers: 3, minPlayers: 2, turnTimeout: 60 },
}))

vi.mock("server-only", () => ({}))
vi.mock("next/server", () => ({ after: (callback: () => unknown) => void h.scheduled.push(callback) }))
vi.mock("@pbgo/analytics/server", () => ({ track: h.track }))
vi.mock("../sanity/client", () => ({ sanityClient: () => null }))
vi.mock("../lib/settings-server", () => ({ loadSettings: async () => h.settings }))
vi.mock("../lib/locale-server", () => ({ getLocale: async () => "en" }))
vi.mock("./player", () => ({ getPlayerId: async () => h.playerId, getOrCreatePlayerId: async () => h.playerId }))
vi.mock("./rate-limit", () => ({ rateLimit: async () => {} }))
vi.mock("./presence", () => ({ markSeen: async () => {} }))
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
  const db = {
    from: () => ({
      select: () => new Select(),
      update: (patch: Partial<StoredRow>) => new Update(patch),
      insert: async (row: Record<string, unknown>) => {
        const key = `${row.game}:${row.code}`
        if (h.rows.has(key)) return { error: { code: "23505" } }
        const now = new Date().toISOString()
        h.rows.set(key, { ...structuredClone(row), created_at: now, updated_at: now } as StoredRow)
        return { error: null }
      },
    }),
    channel: () => ({ httpSend: async () => ({ success: true as const }) }),
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

beforeEach(() => {
  h.rows.clear()
  h.scheduled.length = 0
  h.beforeUpdate = null
  h.track.mockReset()
  h.playerId = null
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

describe("game_started", () => {
  it("is sent when the host starts the game", async () => {
    seed({ players: [ann, bob] })
    h.playerId = "p1"
    expect((await call(start)).status).toBe(200)
    expect(tracked()).toEqual([{ event: "game_started", distinctId: "p1", properties: { game: SLUG, players: 2, options: { rounds: 3 } } }])
    expect(stored().status).toBe("playing")
  })

  it("is not sent when someone else starts, the table is too small or the game already started", async () => {
    seed({ players: [ann, bob] })
    h.playerId = "p2"
    expect((await call(start)).status).toBe(403)

    seed()
    h.playerId = "p1"
    expect((await call(start)).status).toBe(400)

    playing(["p1", "p2"], 0)
    expect((await call(start)).status).toBe(409)
    expect(names()).toEqual([])
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
