import { EngineError, type AnyGameDefinition } from "@pbgo/engine-kit"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { GameRouteContext } from "../lib/binding"
import { CHAT_SERVER_EVENT, DEFAULT_REACTION_IDS } from "../lib/chat"
import { POST as action } from "../routes/api/games/[code]/action/route"
import { POST as chat } from "../routes/api/games/[code]/chat/route"
import { POST as debug } from "../routes/api/games/[code]/debug/route"
import { POST as join } from "../routes/api/games/[code]/join/route"
import { POST as leave } from "../routes/api/games/[code]/leave/route"
import { POST as options } from "../routes/api/games/[code]/options/route"
import { POST as replay } from "../routes/api/games/[code]/replay/route"
import { GET as read } from "../routes/api/games/[code]/route"
import { POST as start } from "../routes/api/games/[code]/start/route"
import { POST as takeover } from "../routes/api/games/[code]/takeover/route"
import { POST as create } from "../routes/api/games/route"
import { stateFingerprint } from "./games"
import { isPlayerSecret, newPlayerSecret, playerIdOf } from "./player-id"
import { voteEntry } from "./takeover"

/**
 * The player id is public: a table gives it to whoever reads it. This is the proof that knowing it is worth nothing. The real routes, the
 * real `player.ts` and `publicGame` run against an in-memory `games` table; what is faked is the database client, the cookie jar of the
 * browser whose request is served, the rate limiter, `after` and the PostHog `track` call. The attacker is a browser with an empty jar
 * but for a cookie that it forged from what a stranger can read.
 */

type StoredRow = {
  game: string
  code: string
  host_id: string
  status: "lobby" | "playing" | "over"
  players: Array<{ id: string; nickname: string; avatarUrl?: string }>
  options: Record<string, number | string | boolean>
  state: unknown
  replay: string[]
  takeover_votes: string[]
  seen: Record<string, string>
  version: number
  updated_at: string
  created_at: string
}

type Jar = Map<string, string>

const h = vi.hoisted(() => ({
  rows: new Map<string, StoredRow>(),
  /** The cookies of the browser whose request is being served: the real `player.ts` reads and writes this jar */
  jar: new Map<string, string>(),
  scheduled: [] as Array<() => unknown>,
  /** Every message sent on a Realtime channel: the chat, and the `update` that tells the clients to read the table again */
  broadcasts: [] as Array<{ channel: string; event: string; payload: unknown }>,
  /** Everything that the routes answered, as text */
  answers: [] as string[],
  track: vi.fn<(event: string, distinctId: string, properties: object) => Promise<void>>(async () => {}),
  settings: { options: { defaults: {}, hidden: [] as string[] }, maxPlayers: 3, minPlayers: 2, turnTimeout: 60 },
}))

vi.mock("server-only", () => ({}))
vi.mock("next/server", () => ({ after: (callback: () => unknown) => void h.scheduled.push(callback) }))
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (h.jar.has(name) ? { name, value: h.jar.get(name)! } : undefined),
    set: (name: string, value: string) => void h.jar.set(name, value),
  }),
}))
vi.mock("@pbgo/analytics/server", () => ({ track: h.track }))
vi.mock("@pbgo/accounts/server", () => ({ getAccount: async () => null }))
vi.mock("../sanity/client", () => ({ sanityClient: () => null }))
vi.mock("../lib/settings-server", () => ({ loadSettings: async () => h.settings }))
vi.mock("../lib/locale-server", () => ({ getLocale: async () => "en" }))
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
    channel: (channel: string) => ({
      httpSend: async (event: string, payload: unknown) => {
        h.broadcasts.push({ channel, event, payload })
        return { success: true as const }
      },
    }),
  }
  return { supabaseAdmin: () => db }
})

/** Every player holds a hand that only they may see; the players move in turn. */
type TestState = { players: string[]; hands: Record<string, string[]>; turn: number; length: number }
const waitingFor = (state: TestState) => (state.turn >= state.length ? [] : [state.players[state.turn % state.players.length]!])

const GAME: AnyGameDefinition = {
  id: "hidden-hands",
  name: "Hidden hands",
  minPlayers: 2,
  maxPlayers: 3,
  options: {},
  clientActions: ["play"],
  setup: ({ players }: { players: Array<{ id: string; nickname: string }> }): TestState => ({
    players: players.map((player) => player.id),
    hands: Object.fromEntries(players.map((player) => [player.id, [`card-${player.nickname}`]])),
    turn: 0,
    length: 6,
  }),
  apply: (state: TestState, { playerId }: { playerId: string }): TestState => {
    if (!state.players.includes(playerId)) throw new EngineError("UNKNOWN_PLAYER")
    if (!waitingFor(state).includes(playerId)) throw new EngineError("NOT_YOUR_TURN")
    return { ...state, turn: state.turn + 1 }
  },
  view: (state: TestState, playerId: string | null) => ({ me: playerId ? { id: playerId, hand: state.hands[playerId] ?? null } : null, turn: state.turn }),
  isOver: (state: TestState) => state.turn >= state.length,
  waitingFor,
  autoPlayFor: (state: TestState) => ({ ...state, turn: state.turn + 1 }),
}

const SLUG = "hidden-hands"
// A dash in the slug: the cookie is `hidden_hands_player`
const COOKIE = "hidden_hands_player"
const CODE = "ABC234"
const KEY = `${SLUG}:${CODE}`
const game = {
  slug: SLUG,
  name: "Hidden hands",
  tagline: "",
  sanityProjectId: "",
  live: true,
  indexable: false,
  binding: { SLUG, NAME: "Hidden hands", GAME },
} as unknown as GameRouteContext["game"]

type Answer = {
  status: number
  body: {
    error?: string
    code: string
    hostId: string
    players: Array<{ id: string; nickname: string }>
    meId: string | null
    view: { me: { id: string; hand: string[] | null } | null; turn: number } | null
  }
}
type Handler = (request: Request, context: GameRouteContext) => Promise<Response>

/** One request from the browser that holds `jar`, served by the real route. A body means POST. */
async function send(jar: Jar, handler: Handler, body?: unknown, code: string | null = CODE): Promise<Answer> {
  h.jar = jar
  const url = `http://localhost/api/${SLUG}/games${code ? `/${code}` : ""}`
  const request = new Request(url, body === undefined ? undefined : { method: "POST", body: JSON.stringify(body) })
  const response = await handler(request, { game, params: code ? { code } : {} })
  const text = await response.text()
  h.answers.push(text)
  return { status: response.status, body: JSON.parse(text) }
}

const stored = () => h.rows.get(KEY)!

type Person = { nickname: string; secret: string; id: string; jar: Jar }
/** Somebody with a browser of their own: a secret in the cookie, and the id that the tables know them by */
function person(nickname: string): Person {
  const secret = newPlayerSecret()
  return { nickname, secret, id: playerIdOf(SLUG, secret), jar: new Map([[COOKIE, secret]]) }
}

/** The table `ABC234`, with these people at it, the first one being the host. By default it is in play and the first one's turn. */
function seat(people: Array<{ id: string; nickname: string }>, partial: Partial<StoredRow> = {}): StoredRow {
  const row: StoredRow = {
    game: SLUG,
    code: CODE,
    host_id: people[0]!.id,
    status: "playing",
    players: people.map(({ id, nickname }) => ({ id, nickname })),
    options: {},
    state: GAME.setup({ players: people.map(({ id, nickname }) => ({ id, nickname })), options: {} }),
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

/** What was sent to PostHog since the last call, once the responses have left (the `after` callbacks run). */
function distinctIds() {
  h.scheduled.splice(0).forEach((callback) => callback())
  return h.track.mock.calls.map(([, distinctId]) => distinctId)
}

const chatEvents = () => h.broadcasts.filter(({ event }) => event === CHAT_SERVER_EVENT)

beforeEach(() => {
  h.rows.clear()
  h.jar = new Map()
  h.scheduled.length = 0
  h.broadcasts.length = 0
  h.answers.length = 0
  h.track.mockReset()
  h.settings.maxPlayers = 3
})

describe("the player id", () => {
  it("is what a table shows to anybody, and the secrets of the browsers never leave their cookies", async () => {
    const ann: Jar = new Map()
    const bob: Jar = new Map()
    const created = await send(ann, create, { nickname: "Ann" }, null)
    const code = created.body.code
    await send(bob, join, { nickname: "Bob" }, code)
    expect((await send(ann, start, {}, code)).status).toBe(200)
    await send(ann, action, { type: "play" }, code)
    await send(bob, chat, { text: "hello" }, code)

    // A browser with no cookie at all reads the table: this is all the attacker has
    const stranger = await send(new Map(), read, undefined, code)
    expect(stranger.status).toBe(200)
    const ids = stranger.body.players.map((player) => player.id)
    expect(ids).toHaveLength(2)
    for (const id of ids) expect(id).toMatch(/^[0-9a-f]{32}$/)
    expect(stranger.body.hostId).toBe(ids[0])

    const secrets = [ann.get(COOKIE)!, bob.get(COOKIE)!]
    for (const secret of secrets) {
      expect(isPlayerSecret(secret)).toBe(true)
      expect(ids).not.toContain(secret)
    }
    expect(ids).toEqual(secrets.map((secret) => playerIdOf(SLUG, secret)))

    // The statistics are told the public id, and nothing the server said, stored or broadcast holds a secret
    const tracked = distinctIds()
    expect(tracked.length).toBeGreaterThan(0)
    for (const id of tracked) expect(ids).toContain(id)
    const everything = JSON.stringify([h.answers, h.broadcasts, h.track.mock.calls, [...h.rows.values()]])
    for (const secret of secrets) expect(everything).not.toContain(secret)
  })
})

/** What an attacker can make out of the id of a player that the table shows: the id itself in the cookie, in several shapes. */
const FORGERIES: Array<[name: string, forge: (playerId: string) => string]> = [
  ["the player id", (id) => id],
  ["the player id in capitals", (id) => id.toUpperCase()],
  ["the player id padded to the length of a secret", (id) => id.padEnd(43, "0")],
  ["the hash of the player id", (id) => playerIdOf(SLUG, id)],
]

/**
 * What an attacker would do as the player it names, and why the server refuses. The table is in play and it is the turn of Ann, the host.
 * Whether the forged cookie reads as no player (401) or as a stranger with a well-formed secret (400 from the engine, 403 from the route),
 * the answer is a refusal for the same reason.
 */
const ATTACKS: Array<[name: string, handler: Handler, body: unknown, error: string]> = [
  ["play in their name", action, { type: "play" }, "UNKNOWN_PLAYER"],
  ["write in the chat in their name", chat, { text: "I am Ann" }, "UNKNOWN_PLAYER"],
  ["send a reaction in their name", chat, { reaction: DEFAULT_REACTION_IDS[0] }, "UNKNOWN_PLAYER"],
  ["vote in their name to play for a player", takeover, {}, "UNKNOWN_PLAYER"],
  ["start the table as the host", start, {}, "HOST_ONLY"],
  ["set the options of the table as the host", options, { options: {} }, "HOST_ONLY"],
  ["drive the table with the debug route", debug, { command: "start" }, "UNKNOWN_PLAYER"],
]

describe.each(FORGERIES)("a browser whose cookie is %s of a player", (_name, forge) => {
  let ann: Person
  let bob: Person
  let before: StoredRow
  let mallory: Jar

  beforeEach(() => {
    ann = person("Ann")
    bob = person("Bob")
    before = structuredClone(seat([ann, bob]))
    mallory = new Map([[COOKIE, forge(ann.id)]])
  })

  it("is shown the table as a stranger sees it: no seat, no hand, nobody's hand", async () => {
    const seen = await send(mallory, read)
    expect(seen.status).toBe(200)
    expect(seen.body.meId).toBeNull()
    expect(seen.body.view?.me).toBeNull()
    expect(JSON.stringify(seen.body)).not.toMatch(/card-Ann|card-Bob/)
  })

  it.each(ATTACKS)("cannot %s", async (_attack, handler, body, error) => {
    const answer = await send(mallory, handler, body)
    expect([400, 401, 403]).toContain(answer.status)
    expect(answer.body.error).toBe(error)
    // Nothing was written, nothing was said on any channel, and the cookie is as it was forged
    expect(stored()).toEqual(before)
    expect(h.broadcasts).toEqual([])
    expect(mallory.get(COOKIE)).toBe(forge(ann.id))
  })

  it("still lets the player it names do all of it with their own cookie", async () => {
    const mine = await send(ann.jar, read)
    expect(mine.body.meId).toBe(ann.id)
    expect(mine.body.view?.me?.hand).toEqual(["card-Ann"])
    expect((await send(bob.jar, read)).body.view?.me?.hand).toEqual(["card-Bob"])

    expect((await send(ann.jar, chat, { text: "hello" })).status).toBe(200)
    expect(chatEvents()).toEqual([expect.objectContaining({ payload: expect.objectContaining({ playerId: ann.id, text: "hello" }) })])
    expect((await send(ann.jar, action, { type: "play" })).status).toBe(200)
    expect((stored().state as TestState).turn).toBe(1)
  })
})

describe("a browser with a forged cookie", () => {
  it("joins under a new id of its own, never as the player that it names: their seat and their name stay theirs", async () => {
    const ann = person("Ann")
    seat([ann], { status: "lobby", state: null })
    const mallory: Jar = new Map([[COOKIE, ann.id]])

    const joined = await send(mallory, join, { nickname: "Mallory" })
    expect(joined.status).toBe(200)
    expect(joined.body.meId).not.toBeNull()
    expect(joined.body.meId).not.toBe(ann.id)
    expect(stored().players).toEqual([
      { id: ann.id, nickname: "Ann" },
      { id: joined.body.meId, nickname: "Mallory" },
    ])
    // It was given a secret of its own in place of the forged value
    expect(isPlayerSecret(mallory.get(COOKIE)!)).toBe(true)
    expect(joined.body.meId).toBe(playerIdOf(SLUG, mallory.get(COOKIE)!))
  })

  it("cannot make a host leave their table", async () => {
    const ann = person("Ann")
    const bob = person("Bob")
    const before = structuredClone(seat([ann, bob], { status: "lobby", state: null }))
    const answer = await send(new Map([[COOKIE, ann.id]]), leave)
    expect(answer.status).toBe(200)
    expect(stored()).toEqual(before)
  })

  it("cannot vote for a rematch in the name of a player", async () => {
    const ann = person("Ann")
    const bob = person("Bob")
    const before = structuredClone(seat([ann, bob], { status: "over", replay: [ann.id] }))
    const answer = await send(new Map([[COOKIE, bob.id]]), replay)
    expect(answer.status).toBe(403)
    expect(answer.body.error).toBe("UNKNOWN_PLAYER")
    expect(stored()).toEqual(before)

    // The same vote from the player's own cookie is the rematch
    expect((await send(bob.jar, replay)).status).toBe(200)
    expect((stored().state as TestState).turn).toBe(0)
    expect(stored().status).toBe("playing")
  })

  it("cannot complete a takeover in the name of the last player who has to agree", async () => {
    const ann = person("Ann")
    const bob = person("Bob")
    const cy = person("Cy")
    const now = new Date().toISOString()
    // The game has waited ten minutes for Ann, who is absent; Bob and Cy are there and have to agree to play for her
    seat([ann, bob, cy], { seen: { [bob.id]: now, [cy.id]: now }, updated_at: new Date(Date.now() - 10 * 60_000).toISOString() })

    expect((await send(bob.jar, takeover, {})).status).toBe(200)
    expect(stored().takeover_votes).toEqual([voteEntry(stateFingerprint(stored().state), { voter: bob.id, target: ann.id })])

    // Cy's id is public and Cy's vote is the one missing: only Cy's cookie casts it
    const forged = await send(new Map([[COOKIE, cy.id]]), takeover, {})
    expect(forged.status).toBe(403)
    expect(forged.body.error).toBe("UNKNOWN_PLAYER")
    expect((stored().state as TestState).turn).toBe(0)
    expect(stored().takeover_votes).toHaveLength(1)

    expect((await send(cy.jar, takeover, {})).status).toBe(200)
    expect((stored().state as TestState).turn).toBe(1)
  })
})

describe("a cookie from before the id and the secret were told apart", () => {
  const LEGACY = { ann: "c58d1aa1-1a8f-4eac-921a-95604115b9db", bob: "357ca813-d992-431f-b0c0-02583afaa0a7" }
  let before: StoredRow

  beforeEach(() => {
    // A table as the old code wrote it: the ids of the seats are the values of the players' cookies, which every table showed
    before = structuredClone(
      seat([
        { id: LEGACY.ann, nickname: "Ann" },
        { id: LEGACY.bob, nickname: "Bob" },
      ]),
    )
  })

  it("identifies nobody, so the table it seated is out of its reach, and so is the hand of its players", async () => {
    const old: Jar = new Map([[COOKIE, LEGACY.ann]])
    const seen = await send(old, read)
    expect(seen.body.meId).toBeNull()
    expect(seen.body.view?.me).toBeNull()
    expect((await send(old, action, { type: "play" })).status).toBe(401)
    expect((await send(old, chat, { text: "hello" })).status).toBe(401)
    expect(stored()).toEqual(before)
    expect(h.broadcasts).toEqual([])
  })

  it("is replaced by a secret when its browser opens a table, which it then sits at under a new id", async () => {
    const old: Jar = new Map([[COOKIE, LEGACY.ann]])
    const created = await send(old, create, { nickname: "Ann" }, null)
    expect(created.status).toBe(200)
    expect(isPlayerSecret(old.get(COOKIE)!)).toBe(true)
    expect(created.body.meId).toBe(playerIdOf(SLUG, old.get(COOKIE)!))
    expect(created.body.meId).not.toBe(LEGACY.ann)
    expect(created.body.hostId).toBe(created.body.meId)
  })
})
