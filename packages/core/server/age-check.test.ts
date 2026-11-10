import type { AnyGameDefinition } from "@pbgo/engine-kit"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { CORE_ERROR_MESSAGES } from "../lib/api"
import { NO_AGE_RULES, type AgeRules } from "../lib/age-rules"
import type { GameRouteContext } from "../lib/binding"
import { postJoin } from "../routes/api/games/[code]/join/route"
import { postOptions } from "../routes/api/games/[code]/options/route"
import { postStart } from "../routes/api/games/[code]/start/route"
import { postGame } from "../routes/api/games/route"
import { AGE_REFUSALS } from "./age-gate"

/**
 * The age check of the tables (PLT-125), end to end: the real routes that open, join, set and start a table, `updateGame` and `publicGame`, against an in-memory `games` table and an in-memory `member_birthdates`. What is faked is the database client, the
 * player cookie, the account that is signed in, the rate limiter, `after`, `seatMember` (it writes `games.member_ids` the way the database function does) and the clock. The point: who is refused, with which code, that nothing is written for a
 * refusal, that an expansion for adults makes its table a table for adults, and that a game that asks for no age costs no lookup at all.
 */

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
  ready_at: Record<string, string>
  ready_deadline: string | null
  member_ids: Record<string, string>
  version: number
  updated_at: string
  created_at: string
}

const h = vi.hoisted(() => ({
  rows: new Map<string, StoredRow>(),
  /** Runs once, right before the next conditional update compares versions: a concurrent request that wins the race */
  beforeUpdate: null as (() => void) | null,
  scheduled: [] as Array<() => unknown>,
  playerId: null as string | null,
  /** Who is signed in, null for a guest */
  account: null as { id: string; nickname: string; avatarUrl: string | null } | null,
  /** The date of birth each account declared (`member_birthdates`) */
  birthdates: new Map<string, string>(),
  /** When set, the dates cannot be read: the database answers this error */
  birthdatesError: null as Error | null,
  /** How many times the dates of birth were asked for, and how many times the table was asked who sits where */
  birthdateReads: 0,
  memberIdReads: 0,
  /** Written by the options of the game the admin set: the defaults a new table opens with */
  settings: { options: { defaults: {} as Record<string, unknown>, hidden: [] as string[] }, maxPlayers: 4, minPlayers: 2, turnTimeout: 60 },
  seatMember: vi.fn<(game: { slug: string }, code: string, playerId: string, userId: string | null) => Promise<void>>(),
}))

vi.mock("server-only", () => ({}))
vi.mock("next/server", () => ({ after: (callback: () => unknown) => void h.scheduled.push(callback) }))
vi.mock("@pbgo/analytics/server", () => ({ track: async () => {} }))
vi.mock("../sanity/client", () => ({ sanityClient: () => null }))
vi.mock("../lib/settings-server", () => ({ loadSettings: async () => h.settings }))
vi.mock("../lib/locale-server", () => ({ getLocale: async () => "en" }))
vi.mock("@pbgo/accounts/server", () => ({ getAccount: async () => h.account }))
vi.mock("./player", () => ({ getPlayerId: async () => h.playerId, getOrCreatePlayerId: async () => h.playerId }))
vi.mock("./rate-limit", () => ({ rateLimit: async () => {} }))
vi.mock("./presence", () => ({ markSeen: async () => {}, seatMember: h.seatMember }))
vi.mock("./results", () => ({ recordGameResult: async () => {}, markGameStarted: async () => {}, markTakenOver: async () => {} }))
vi.mock("./supabase", () => {
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
      if (this.columns === "member_ids") h.memberIdReads++
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
  const games = {
    select: (columns: string) => new Select(columns),
    update: (patch: Partial<StoredRow>) => new Update(patch),
    insert: async (row: Record<string, unknown>) => {
      const key = `${row.game}:${row.code}`
      if (h.rows.has(key)) return { error: { code: "23505" } }
      const now = new Date().toISOString()
      h.rows.set(key, { member_ids: {}, ...structuredClone(row), created_at: now, updated_at: now } as StoredRow)
      return { error: null }
    },
  }
  const birthdates = {
    select: () => ({
      in: async (_column: string, ids: string[]) => {
        h.birthdateReads++
        if (h.birthdatesError) return { data: null, error: h.birthdatesError }
        return { data: ids.filter((id) => h.birthdates.has(id)).map((id) => ({ user_id: id, birthdate: h.birthdates.get(id) })), error: null }
      },
    }),
  }
  const db = { from: (table: string) => (table === "member_birthdates" ? birthdates : games), channel: () => ({ httpSend: async () => ({ success: true as const }) }) }
  return { supabaseAdmin: () => db }
})

/** A game with a number of rounds and three expansions, each an option that is off by default: one for adults (18), one for 16 and over, one for children (advice only). */
const GAME: AnyGameDefinition = {
  id: "testgame",
  name: "Test game",
  minPlayers: 2,
  maxPlayers: 4,
  options: {
    rounds: { type: "number", label: "Rounds", defaultValue: 3, min: 1, max: 5 },
    "adult-pack": { type: "boolean", label: "Adult pack", defaultValue: false, group: "extension" },
    "spicy-pack": { type: "boolean", label: "Spicy pack", defaultValue: false, group: "extension" },
    "kids-pack": { type: "boolean", label: "Kids pack", defaultValue: false, group: "extension" },
  },
  clientActions: ["move"],
  setup: ({ players }: { players: Array<{ id: string }> }) => ({ players: players.map((player) => player.id), turn: 0 }),
  apply: (state: { turn: number }) => ({ ...state, turn: state.turn + 1 }),
  view: () => ({}),
  isOver: () => false,
  waitingFor: (state: { players: string[] }) => [state.players[0]!],
  autoPlayFor: (state: { turn: number }) => ({ ...state, turn: state.turn + 1 }),
}

const SLUG = "testgame"
const CODE = "ABC234"
const KEY = `${SLUG}:${CODE}`
const game = {
  slug: SLUG,
  name: "Test game",
  tagline: "",
  sanityProjectId: "",
  live: true,
  indexable: false,
  binding: { SLUG, NAME: "Test game", GAME },
} as unknown as GameRouteContext["game"]

/** What the Studio says: the game asks for no age, and three expansions say theirs */
const EXPANSIONS: AgeRules = { game: null, expansions: { "adult-pack": 18, "spicy-pack": 16, "kids-pack": 6 } }
/** What the Studio says: the game itself is for adults */
const ADULT_GAME: AgeRules = { game: 18, expansions: { "adult-pack": 18 } }

let rules: AgeRules = NO_AGE_RULES
const asked = vi.fn()
const source = async (slug: string) => {
  asked(slug)
  return rules
}
const create = postGame(source)
const join = postJoin(source)
const options = postOptions(source)
const start = postStart(source)

// The ages of the people of the tests, on the day the clock is set to (2026-11-09): an adult, a member of 17 whose 18th birthday is tomorrow, a member whose 18th birthday is today, a member of 15
const TODAY = new Date("2026-11-09T12:00:00Z")
const ADULT = "1990-04-02"
const SEVENTEEN = "2008-11-10"
const EIGHTEEN_TODAY = "2008-11-09"
const FIFTEEN = "2011-03-01"

const ann = { id: "p1", nickname: "Ann" }
const bob = { id: "p2", nickname: "Bob" }
const cy = { id: "p3", nickname: "Cy" }
const stored = () => h.rows.get(KEY)!

/** A table that waits, with its host and the accounts of its seats (seat → account), as the database function `seat_member` would have written them */
function seed(partial: Partial<StoredRow> = {}): StoredRow {
  const row: StoredRow = {
    game: SLUG,
    code: CODE,
    host_id: "p1",
    status: "lobby",
    players: [ann],
    options: { rounds: 3, "adult-pack": false, "spicy-pack": false, "kids-pack": false },
    state: null,
    replay: [],
    takeover_votes: [],
    seen: {},
    ready_at: {},
    ready_deadline: null,
    member_ids: {},
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

type Handler = (request: Request, context: GameRouteContext) => Promise<Response>
async function call(handler: Handler, body: unknown = {}, code: string | null = CODE) {
  const url = `http://localhost/api/${SLUG}/games${code ? `/${code}` : ""}`
  return handler(new Request(url, { method: "POST", body: JSON.stringify(body) }), { game, params: code ? { code } : {} })
}
const errorOf = async (response: Response) => ((await response.json()) as { error?: string }).error

/** Signs somebody in: the account, the date of birth it declared (none when `birthdate` is null) and the player cookie of the browser */
function signIn(account: string, birthdate: string | null, playerId: string) {
  h.account = { id: account, nickname: account.toUpperCase(), avatarUrl: null }
  if (birthdate) h.birthdates.set(account, birthdate)
  h.playerId = playerId
}
const asGuest = (playerId: string) => {
  h.account = null
  h.playerId = playerId
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(TODAY)
  h.rows.clear()
  h.scheduled.length = 0
  h.beforeUpdate = null
  h.account = null
  h.playerId = null
  h.birthdates.clear()
  h.birthdatesError = null
  h.birthdateReads = 0
  h.memberIdReads = 0
  h.settings.options.defaults = {}
  h.settings.maxPlayers = 4
  h.settings.minPlayers = 2
  h.seatMember.mockReset()
  // The database function: a member's seat says whose it is, written into the table's `member_ids`
  h.seatMember.mockImplementation(async (_game, code, playerId, userId) => {
    const row = h.rows.get(`${SLUG}:${code}`)
    if (row && userId) row.member_ids = { ...row.member_ids, [playerId]: userId }
  })
  asked.mockClear()
  rules = NO_AGE_RULES
})

afterEach(() => {
  vi.useRealTimers()
})

describe("a game that asks for no age", () => {
  it("is opened, joined, set and started by a guest, and nobody's date is looked up", async () => {
    asGuest("p1")
    expect((await call(create, { nickname: "Ann" }, null)).status).toBe(200)
    const code = [...h.rows.values()][0]!.code
    asGuest("p2")
    expect((await call(join, { nickname: "Bob" }, code)).status).toBe(200)
    asGuest("p1")
    expect((await call(options, { options: { "adult-pack": true } }, code)).status).toBe(200)
    expect((await call(start, {}, code)).status).toBe(200)
    expect([...h.rows.values()][0]!.status).toBe("starting")
    expect(h.birthdateReads).toBe(0)
    expect(h.memberIdReads).toBe(0)
  })

  it("asks the rules of the game it is given, by its slug", async () => {
    asGuest("p1")
    await call(create, { nickname: "Ann" }, null)
    expect(asked).toHaveBeenCalledWith(SLUG)
  })

  it("leaves a member's seat to be written after the response, as it always was", async () => {
    signIn("acct-ann", ADULT, "p1")
    expect((await call(create, {}, null)).status).toBe(200)
    expect(h.seatMember).not.toHaveBeenCalled()
    await Promise.all(h.scheduled.splice(0).map((callback) => callback()))
    expect(h.seatMember).toHaveBeenCalledTimes(1)
  })

  it("treats an age under 16 as advice: the game is for 14, a guest of any age sits down", async () => {
    rules = { game: 14, expansions: { "kids-pack": 12 } }
    asGuest("p1")
    expect((await call(create, { nickname: "Ann" }, null)).status).toBe(200)
    expect(h.birthdateReads).toBe(0)
  })
})

describe("opening a table of a game for adults", () => {
  beforeEach(() => {
    rules = ADULT_GAME
  })

  it("sends a guest to sign in, and opens nothing", async () => {
    asGuest("p1")
    const response = await call(create, { nickname: "Ann" }, null)
    expect(response.status).toBe(401)
    expect(await errorOf(response)).toBe("AGE_SIGN_IN_REQUIRED")
    expect(h.rows.size).toBe(0)
  })

  it("asks a member who declared no date for it, and opens nothing", async () => {
    signIn("acct-ann", null, "p1")
    const response = await call(create, {}, null)
    expect(response.status).toBe(403)
    expect(await errorOf(response)).toBe("AGE_DATE_REQUIRED")
    expect(h.rows.size).toBe(0)
  })

  it("refuses a member who is not old enough, the day before their 18th birthday included, and opens nothing", async () => {
    signIn("acct-ann", SEVENTEEN, "p1")
    const response = await call(create, {}, null)
    expect(response.status).toBe(403)
    expect(await errorOf(response)).toBe("AGE_TOO_YOUNG")
    expect(h.rows.size).toBe(0)
  })

  it("refuses a member of 15", async () => {
    signIn("acct-ann", FIFTEEN, "p1")
    expect(await errorOf(await call(create, {}, null))).toBe("AGE_TOO_YOUNG")
  })

  it("opens the table for an adult, on the day of their 18th birthday too, and records whose seat it is before the response", async () => {
    signIn("acct-ann", EIGHTEEN_TODAY, "p1")
    const response = await call(create, {}, null)
    expect(response.status).toBe(200)
    const row = [...h.rows.values()][0]!
    expect(row.players).toEqual([{ id: "p1", nickname: "ACCT-ANN" }])
    // The seat was written while the request was served, not left for after the response
    expect(h.seatMember).toHaveBeenCalledTimes(1)
    expect(row.member_ids).toEqual({ p1: "acct-ann" })
  })

  it("counts the demo account of development as an adult: it is in no database", async () => {
    h.account = { id: "demo", nickname: "Oré", avatarUrl: null }
    h.playerId = "p1"
    expect((await call(create, {}, null)).status).toBe(200)
    expect(h.birthdateReads).toBe(0)
  })

  it("trusts the date the database holds, never anything in the request", async () => {
    signIn("acct-ann", SEVENTEEN, "p1")
    expect(await errorOf(await call(create, { birthdate: ADULT, age: 40, nickname: "Ann" }, null))).toBe("AGE_TOO_YOUNG")
  })
})

describe("opening a table when the admin's defaults switch an expansion for adults on", () => {
  beforeEach(() => {
    rules = EXPANSIONS
    h.settings.options.defaults = { "adult-pack": true }
  })

  it("is a table for adults: a guest signs in, a minor is refused", async () => {
    asGuest("p1")
    expect(await errorOf(await call(create, { nickname: "Ann" }, null))).toBe("AGE_SIGN_IN_REQUIRED")
    signIn("acct-ann", SEVENTEEN, "p1")
    expect(await errorOf(await call(create, {}, null))).toBe("AGE_TOO_YOUNG")
    expect(h.rows.size).toBe(0)
  })

  it("is opened by an adult", async () => {
    signIn("acct-ann", ADULT, "p1")
    expect((await call(create, {}, null)).status).toBe(200)
    expect([...h.rows.values()][0]!.options["adult-pack"]).toBe(true)
  })
})

describe("joining a table", () => {
  it("is open to anybody at a table with no expansion for adults, though the game has one: a guest sits down", async () => {
    rules = EXPANSIONS
    seed()
    asGuest("p2")
    expect((await call(join, { nickname: "Bob" })).status).toBe(200)
    expect(stored().players.map((player) => player.id)).toEqual(["p1", "p2"])
    expect(h.birthdateReads).toBe(0)
  })

  describe("at a table with an expansion for adults switched on", () => {
    beforeEach(() => {
      rules = EXPANSIONS
      seed({ options: { rounds: 3, "adult-pack": true, "spicy-pack": false, "kids-pack": false } })
    })

    it("sends a guest to sign in", async () => {
      asGuest("p2")
      const response = await call(join, { nickname: "Bob" })
      expect(response.status).toBe(401)
      expect(await errorOf(response)).toBe("AGE_SIGN_IN_REQUIRED")
      expect(stored().players).toEqual([ann])
    })

    it("asks a member who declared no date for it", async () => {
      signIn("acct-bob", null, "p2")
      expect(await errorOf(await call(join, {}))).toBe("AGE_DATE_REQUIRED")
      expect(stored().players).toEqual([ann])
    })

    it("refuses a member who is not old enough", async () => {
      signIn("acct-bob", SEVENTEEN, "p2")
      expect(await errorOf(await call(join, {}))).toBe("AGE_TOO_YOUNG")
      expect(stored().players).toEqual([ann])
    })

    it("seats an adult and records whose seat it is before the response", async () => {
      signIn("acct-bob", ADULT, "p2")
      expect((await call(join, {})).status).toBe(200)
      expect(stored().players.map((player) => player.id)).toEqual(["p1", "p2"])
      expect(h.seatMember).toHaveBeenCalledWith(expect.objectContaining({ slug: SLUG }), CODE, "p2", "acct-bob")
      expect(stored().member_ids).toEqual({ p2: "acct-bob" })
    })

    it("lets an adult who is seated rename themselves", async () => {
      seed({ players: [ann, bob], options: { rounds: 3, "adult-pack": true, "spicy-pack": false, "kids-pack": false } })
      signIn("acct-bob", ADULT, "p2")
      expect((await call(join, {})).status).toBe(200)
    })
  })

  it("is judged on the table as it is when the write lands: a host who switches an expansion for adults on while a guest is on their way refuses the guest", async () => {
    rules = EXPANSIONS
    seed()
    asGuest("p2")
    race(() => ({ options: { rounds: 3, "adult-pack": true, "spicy-pack": false, "kids-pack": false } }))
    const response = await call(join, { nickname: "Bob" })
    expect(response.status).toBe(401)
    expect(await errorOf(response)).toBe("AGE_SIGN_IN_REQUIRED")
    expect(stored().players).toEqual([ann])
  })

  it("asks the age of the table, not 18: a table with an expansion for 16 seats a member of 16 and refuses a member of 15", async () => {
    rules = EXPANSIONS
    seed({ options: { rounds: 3, "adult-pack": false, "spicy-pack": true, "kids-pack": false } })
    signIn("acct-bob", FIFTEEN, "p2")
    expect(await errorOf(await call(join, {}))).toBe("AGE_TOO_YOUNG")
    signIn("acct-cy", "2010-11-09", "p3")
    expect((await call(join, {})).status).toBe(200)
  })

  it("seats at a game for adults only the people who are old enough, whatever the expansions", async () => {
    rules = ADULT_GAME
    seed()
    asGuest("p2")
    expect(await errorOf(await call(join, { nickname: "Bob" }))).toBe("AGE_SIGN_IN_REQUIRED")
    signIn("acct-bob", SEVENTEEN, "p2")
    expect(await errorOf(await call(join, {}))).toBe("AGE_TOO_YOUNG")
    signIn("acct-bob", ADULT, "p2")
    expect((await call(join, {})).status).toBe(200)
  })
})

describe("switching an expansion for adults on", () => {
  const withAdultPack = { options: { "adult-pack": true } }

  beforeEach(() => {
    rules = EXPANSIONS
  })

  it("is the host's to do when they are old enough: alone at the table, only their own date is looked up", async () => {
    seed({ member_ids: { p1: "acct-ann" } })
    signIn("acct-ann", ADULT, "p1")
    expect((await call(options, withAdultPack)).status).toBe(200)
    expect(stored().options["adult-pack"]).toBe(true)
    // The table was not asked who sits where: the host is the only one, and the gate knows them
    expect(h.memberIdReads).toBe(0)
  })

  it("sends a host who is a guest to sign in, and changes nothing", async () => {
    seed()
    asGuest("p1")
    const response = await call(options, withAdultPack)
    expect(response.status).toBe(401)
    expect(await errorOf(response)).toBe("AGE_SIGN_IN_REQUIRED")
    expect(stored().options["adult-pack"]).toBe(false)
  })

  it("asks a host who declared no date for it", async () => {
    seed({ member_ids: { p1: "acct-ann" } })
    signIn("acct-ann", null, "p1")
    expect(await errorOf(await call(options, withAdultPack))).toBe("AGE_DATE_REQUIRED")
    expect(stored().options["adult-pack"]).toBe(false)
  })

  it("refuses a host who is not old enough", async () => {
    seed({ member_ids: { p1: "acct-ann" } })
    signIn("acct-ann", SEVENTEEN, "p1")
    expect(await errorOf(await call(options, withAdultPack))).toBe("AGE_TOO_YOUNG")
    expect(stored().options["adult-pack"]).toBe(false)
  })

  it("is done with adults seated beside the host: they are looked up, and nobody is refused", async () => {
    seed({ players: [ann, bob], member_ids: { p1: "acct-ann", p2: "acct-bob" } })
    h.birthdates.set("acct-bob", EIGHTEEN_TODAY)
    signIn("acct-ann", ADULT, "p1")
    expect((await call(options, withAdultPack)).status).toBe(200)
    expect(stored().options["adult-pack"]).toBe(true)
    expect(h.memberIdReads).toBe(1)
  })

  it("is refused when a player who is not old enough is seated, and says nothing of who", async () => {
    seed({ players: [ann, bob], member_ids: { p1: "acct-ann", p2: "acct-bob" } })
    h.birthdates.set("acct-bob", SEVENTEEN)
    signIn("acct-ann", ADULT, "p1")
    const response = await call(options, withAdultPack)
    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: "AGE_TABLE_NOT_ALLOWED" })
    expect(stored().options["adult-pack"]).toBe(false)
  })

  it("is refused when a guest is seated: a guest has no date", async () => {
    seed({ players: [ann, bob], member_ids: { p1: "acct-ann" } })
    signIn("acct-ann", ADULT, "p1")
    expect(await errorOf(await call(options, withAdultPack))).toBe("AGE_TABLE_NOT_ALLOWED")
    expect(stored().options["adult-pack"]).toBe(false)
  })

  it("is refused when a member who declared no date is seated", async () => {
    seed({ players: [ann, bob], member_ids: { p1: "acct-ann", p2: "acct-bob" } })
    signIn("acct-ann", ADULT, "p1")
    expect(await errorOf(await call(options, withAdultPack))).toBe("AGE_TABLE_NOT_ALLOWED")
  })

  it("asks the age of the expansion: one for 16 is switched on with a member of 16 seated, not with one of 15", async () => {
    seed({ players: [ann, bob], member_ids: { p1: "acct-ann", p2: "acct-bob" } })
    signIn("acct-ann", ADULT, "p1")
    h.birthdates.set("acct-bob", "2010-11-09")
    expect((await call(options, { options: { "spicy-pack": true } })).status).toBe(200)
    seed({ players: [ann, bob], member_ids: { p1: "acct-ann", p2: "acct-bob" } })
    h.birthdates.set("acct-bob", FIFTEEN)
    expect(await errorOf(await call(options, { options: { "spicy-pack": true } }))).toBe("AGE_TABLE_NOT_ALLOWED")
  })

  it("asks the highest age when the table already asks for less: 18 over a table that asks 16", async () => {
    seed({ players: [ann, bob], member_ids: { p1: "acct-ann", p2: "acct-bob" }, options: { rounds: 3, "adult-pack": false, "spicy-pack": true, "kids-pack": false } })
    signIn("acct-ann", ADULT, "p1")
    h.birthdates.set("acct-bob", "2010-11-09")
    expect(await errorOf(await call(options, withAdultPack))).toBe("AGE_TABLE_NOT_ALLOWED")
  })

  it("asks nothing for an expansion that is advice only, and looks nobody up", async () => {
    seed({ players: [ann, bob] })
    asGuest("p1")
    expect((await call(options, { options: { "kids-pack": true } })).status).toBe(200)
    expect(h.memberIdReads).toBe(0)
    expect(h.birthdateReads).toBe(0)
  })

  it("is refused when somebody sat down since the table was read: the host asks again", async () => {
    seed({ member_ids: { p1: "acct-ann" } })
    signIn("acct-ann", ADULT, "p1")
    race((row) => ({ players: [...row.players, bob] }))
    const response = await call(options, withAdultPack)
    expect(response.status).toBe(409)
    expect(await errorOf(response)).toBe("CONFLICT")
    expect(stored().options["adult-pack"]).toBe(false)
  })

  it("asks only the host of their own table", async () => {
    seed({ players: [ann, bob], member_ids: { p1: "acct-ann", p2: "acct-bob" } })
    signIn("acct-bob", ADULT, "p2")
    h.birthdates.set("acct-ann", ADULT)
    expect(await errorOf(await call(options, withAdultPack))).toBe("HOST_ONLY")
  })
})

describe("a change of the options that does not raise the age of the table", () => {
  beforeEach(() => {
    rules = EXPANSIONS
  })

  it("asks nothing: switching the expansion for adults off, a guest or a minor seated", async () => {
    seed({ players: [ann, bob], options: { rounds: 3, "adult-pack": true, "spicy-pack": false, "kids-pack": false }, member_ids: { p1: "acct-ann", p2: "acct-bob" } })
    signIn("acct-ann", SEVENTEEN, "p1")
    h.birthdates.set("acct-bob", FIFTEEN)
    expect((await call(options, { options: { "adult-pack": false } })).status).toBe(200)
    expect(stored().options["adult-pack"]).toBe(false)
  })

  it("asks nothing: another option of a table that already asks for the age, as the people seated were let in for it", async () => {
    seed({ players: [ann, bob], options: { rounds: 3, "adult-pack": true, "spicy-pack": false, "kids-pack": false }, member_ids: { p1: "acct-ann", p2: "acct-bob" } })
    signIn("acct-ann", ADULT, "p1")
    h.birthdates.set("acct-bob", FIFTEEN)
    expect((await call(options, { options: { rounds: 4 } })).status).toBe(200)
    expect(stored().options.rounds).toBe(4)
  })
})

describe("starting a table", () => {
  beforeEach(() => {
    rules = EXPANSIONS
  })

  it("starts a table for adults when everybody seated is old enough", async () => {
    seed({ players: [ann, bob], options: { rounds: 3, "adult-pack": true, "spicy-pack": false, "kids-pack": false }, member_ids: { p1: "acct-ann", p2: "acct-bob" } })
    h.birthdates.set("acct-bob", ADULT)
    signIn("acct-ann", ADULT, "p1")
    expect((await call(start)).status).toBe(200)
    expect(stored().status).toBe("starting")
  })

  it("does not start it with somebody seated who is not old enough: the table stays in the lobby", async () => {
    seed({ players: [ann, bob], options: { rounds: 3, "adult-pack": true, "spicy-pack": false, "kids-pack": false }, member_ids: { p1: "acct-ann", p2: "acct-bob" } })
    h.birthdates.set("acct-bob", SEVENTEEN)
    signIn("acct-ann", ADULT, "p1")
    const response = await call(start)
    expect(response.status).toBe(403)
    expect(await errorOf(response)).toBe("AGE_TABLE_NOT_ALLOWED")
    expect(stored().status).toBe("lobby")
  })

  it("does not start it with a guest seated", async () => {
    seed({ players: [ann, cy], options: { rounds: 3, "adult-pack": true, "spicy-pack": false, "kids-pack": false }, member_ids: { p1: "acct-ann" } })
    signIn("acct-ann", ADULT, "p1")
    expect(await errorOf(await call(start))).toBe("AGE_TABLE_NOT_ALLOWED")
    expect(stored().status).toBe("lobby")
  })

  it("starts a table that asks for no age with guests and minors seated, and looks nobody up", async () => {
    seed({ players: [ann, bob], member_ids: { p2: "acct-bob" } })
    h.birthdates.set("acct-bob", FIFTEEN)
    asGuest("p1")
    expect((await call(start)).status).toBe(200)
    expect(h.birthdateReads).toBe(0)
    expect(h.memberIdReads).toBe(0)
  })

  it("is refused when somebody sat down since the table was read: the host starts again", async () => {
    seed({ players: [ann, bob], options: { rounds: 3, "adult-pack": true, "spicy-pack": false, "kids-pack": false }, member_ids: { p1: "acct-ann", p2: "acct-bob" } })
    h.birthdates.set("acct-bob", ADULT)
    signIn("acct-ann", ADULT, "p1")
    race((row) => ({ players: [...row.players, cy] }))
    const response = await call(start)
    expect(response.status).toBe(409)
    expect(await errorOf(response)).toBe("CONFLICT")
    expect(stored().status).toBe("lobby")
  })

  it("keeps the rules that were there: only the host starts, and a table that began cannot start again", async () => {
    seed({ players: [ann, bob], options: { rounds: 3, "adult-pack": true, "spicy-pack": false, "kids-pack": false }, member_ids: { p1: "acct-ann", p2: "acct-bob" } })
    h.birthdates.set("acct-bob", ADULT)
    signIn("acct-bob", ADULT, "p2")
    expect(await errorOf(await call(start))).toBe("HOST_ONLY")
    signIn("acct-ann", ADULT, "p1")
    expect((await call(start)).status).toBe(200)
    expect(await errorOf(await call(start))).toBe("GAME_IN_PROGRESS")
  })
})

describe("when the database cannot say who is old enough", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    h.birthdatesError = new Error('relation "public.member_birthdates" does not exist')
  })

  it("lets nobody through to open a table: a failure to read the dates is an error, not a pass", async () => {
    rules = ADULT_GAME
    signIn("acct-ann", ADULT, "p1")
    const response = await call(create, {}, null)
    expect(response.status).toBe(500)
    expect(await errorOf(response)).toBe("SERVER_ERROR")
    expect(h.rows.size).toBe(0)
  })

  it("lets nobody through to a table for adults, and seats nobody", async () => {
    rules = EXPANSIONS
    seed({ options: { rounds: 3, "adult-pack": true, "spicy-pack": false, "kids-pack": false } })
    signIn("acct-bob", ADULT, "p2")
    expect((await call(join, {})).status).toBe(500)
    expect(stored().players).toEqual([ann])
  })

  it("changes no option that raises the age of the table", async () => {
    rules = EXPANSIONS
    seed({ players: [ann, bob], member_ids: { p1: "acct-ann", p2: "acct-bob" } })
    signIn("acct-ann", ADULT, "p1")
    expect((await call(options, { options: { "adult-pack": true } })).status).toBe(500)
    expect(stored().options["adult-pack"]).toBe(false)
  })
})

describe("the words of the refusals", () => {
  it("are all worded by the platform: a player never reads [missing: …]", () => {
    for (const { code } of Object.values(AGE_REFUSALS)) expect(CORE_ERROR_MESSAGES[code], code).toBeTruthy()
    expect(CORE_ERROR_MESSAGES.AGE_TABLE_NOT_ALLOWED).toBeTruthy()
  })

  it("send a guest to sign in with a 401 and the rest with a 403", () => {
    expect(AGE_REFUSALS["sign-in"]).toEqual({ code: "AGE_SIGN_IN_REQUIRED", status: 401 })
    expect(AGE_REFUSALS.date).toEqual({ code: "AGE_DATE_REQUIRED", status: 403 })
    expect(AGE_REFUSALS["too-young"]).toEqual({ code: "AGE_TOO_YOUNG", status: 403 })
  })
})
