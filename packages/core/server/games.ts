import "server-only"
import { beginOf, deadlineIn, normalizeOptions, progressOf, setupOf, waitingPlayers, type OptionValues } from "@pbgo/engine-kit"
import type { GameEntry, PlayableGame } from "../lib/binding"
import { type PublicGame, type PublicPlayer, type GameStatus, UPDATE_EVENT, gameChannel } from "../lib/game-types"
import { DEFAULT_LOCALE, type Locale } from "../lib/i18n"
import { sanityClient } from "../sanity/client"
import { ApiError } from "./api"
import { validCode, generateCode, normalizeCode } from "./code"
import { type LoggedStep, type LogWrite, readLog, viewLogged, writeLog } from "./game-log"
import { expirePatch, readyExpired, readyIds, readyLeft } from "./ready"
import { supabaseAdmin } from "./supabase"
import { publicTakeover } from "./takeover"

/** A table, as stored in `games` (one table per game and code: `(game, code)` is the key). */
export type GameRow = {
  code: string
  host_id: string
  status: GameStatus
  /** The people at the table, in the order they sat down: the engine's `PlayerInfo`, plus the picture of their account when they have one */
  players: PublicPlayer[]
  options: OptionValues
  /** Engine state (the game's own type), null in the lobby */
  state: unknown
  replay: string[]
  /** Votes to play for the players the game waits for: `<state fingerprint>:<voter>:<target>` (see `takeover.ts`) */
  takeover_votes: string[]
  /** Last time the server saw each player (player id → ISO time), written by `markSeen` (`presence.ts`) without a new version */
  seen?: Record<string, string>
  /** The ready check of a table that is `starting` (`ready.ts`): when each player said they were ready (player id → ISO time), empty otherwise */
  ready_at?: Record<string, string>
  /** When the ready check ends (ISO), null outside `starting` */
  ready_deadline?: string | null
  version: number
  updated_at?: string
  created_at?: string
}

type GameRef = Pick<GameEntry, "slug">

const COLUMNS = "code, host_id, status, players, options, state, replay, takeover_votes, seen, ready_at, ready_deadline, version, updated_at, created_at"

// Concurrent writes (e.g. every player confirming the opening at once): retry after a growing random pause
const MAX_ATTEMPTS = 8
const pause = (attempt: number) => new Promise((resolve) => setTimeout(resolve, 20 + Math.random() * 60 * (attempt + 1)))

export async function readGame(game: GameRef, rawCode: string): Promise<GameRow> {
  const code = normalizeCode(rawCode)
  if (!validCode(code)) throw new ApiError("INVALID_CODE")
  const { data, error } = await supabaseAdmin().from("games").select(COLUMNS).eq("game", game.slug).eq("code", code).maybeSingle()
  if (error) throw error
  if (!data) throw new ApiError("GAME_NOT_FOUND", 404)
  return data as GameRow
}

/** A table nobody has written to for this long is no longer the one a player "sits at": a lobby walked away from, a game dropped. Presence does not count (`touch_game_player` leaves `updated_at` alone), a move or a join does. */
export const TABLE_IDLE_MS = 6 * 60 * 60 * 1000

/**
 * The table a player sits at in a game: the one that waits for players, is starting or is being played and that was written last, null when there is none. The platform's page of the game asks it
 * to show a visitor their lobby or their game (PLT-106). A table idle for `TABLE_IDLE_MS` is left out, so that a player is never held by a table they have forgotten. The people of a table are a column
 * of `games` (jsonb), not rows of their own: this reads the game's recent tables with a containment filter, which asks for no index while there are few; PLT-13's `table_players` replaces it.
 */
export async function findPlayerGame(game: GameRef, playerId: string, now = Date.now()): Promise<GameRow | null> {
  const { data, error } = await supabaseAdmin()
    .from("games")
    .select(COLUMNS)
    .eq("game", game.slug)
    .in("status", ["lobby", "starting", "playing"])
    .gte("updated_at", new Date(now - TABLE_IDLE_MS).toISOString())
    // The JSON as a string: for an array supabase-js writes a Postgres array literal (`{…}`), which a jsonb column does not read
    .contains("players", JSON.stringify([{ id: playerId }]))
    .order("updated_at", { ascending: false })
    .limit(1)
  if (error) throw error
  return (data?.[0] as GameRow | undefined) ?? null
}

/**
 * Opens a table. `ranked` opens it to count for the ratings (`games.ranked`, migration 0006): the games it plays are written down as ranked when every seat is a different account, and counted for the ratings of those who played
 * their own moves. Nothing opens one yet; the matchmaking of PLT-21 will. The column is only written for a ranked table, so that a normal one is created as it always was, and a project where the migration is not applied yet keeps opening tables.
 */
export async function createGame(
  game: PlayableGame,
  host: PublicPlayer,
  options: OptionValues = normalizeOptions(game.binding.GAME.options, {}),
  { ranked = false }: { ranked?: boolean } = {},
): Promise<GameRow> {
  const db = supabaseAdmin()
  for (let attempt = 0; attempt < 5; attempt++) {
    const row: GameRow = {
      code: generateCode(),
      host_id: host.id,
      status: "lobby",
      players: [host],
      options,
      state: null,
      replay: [],
      takeover_votes: [],
      seen: {},
      ready_at: {},
      ready_deadline: null,
      version: 0,
    }
    const { error } = await db.from("games").insert({ game: game.slug, ...row, ...(ranked ? { ranked: true } : {}) })
    if (!error) return row
    if (error.code !== "23505") throw error
  }
  throw new ApiError("CODE_UNAVAILABLE", 500)
}

/**
 * Fingerprint of a state, the stamp of the takeover votes (`takeover_votes` column, see `takeover.ts`).
 * Every move changes the state, so its fingerprint: stale votes are ignored without having to purge them.
 */
export function stateFingerprint(state: unknown): string {
  const text = JSON.stringify(state ?? null)
  let h = 5381
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

/**
 * What a modifier of `updateGame` changes: columns of the table, and what the move adds to its log (`log`, which is not a column: the log has a table of its own, `game_log`). A game that says nothing of what its moves did leaves `log` out.
 */
export type GamePatch = Partial<Omit<GameRow, "code" | "version">> & { log?: LogWrite }

export async function updateGame(
  game: GameRef,
  code: string,
  modifier: (row: GameRow) => GamePatch | null,
  { quiet = false }: { quiet?: boolean } = {},
): Promise<GameRow> {
  const db = supabaseAdmin()
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) await pause(attempt)
    const row = await readGame(game, code)
    const patch = modifier(row)
    if (!patch) return row
    const { log, ...columns } = patch
    // `quiet` (votes): the version changes so clients refresh, but not the turn's inactivity clock
    const updatedAt = quiet && !("state" in columns) && row.updated_at ? row.updated_at : new Date().toISOString()
    const next = { ...row, ...columns, version: row.version + 1, updated_at: updatedAt }
    const { data, error } = await db
      .from("games")
      .update({ ...columns, version: next.version, updated_at: updatedAt })
      .eq("game", game.slug)
      .eq("code", row.code)
      .eq("version", row.version)
      .select("code")
    if (error) throw error
    if (data.length === 1) {
      // What the move said is written before the others are told, so that whoever reads the table on the ping finds it in the log
      if (log) await writeLog(game.slug, row.code, next.version, log)
      await notify(game.slug, row.code, next.version)
      return next
    }
  }
  throw new ApiError("CONFLICT", 409)
}

async function notify(slug: string, code: string, version: number) {
  try {
    await supabaseAdmin().channel(gameChannel(slug, code)).httpSend(UPDATE_EVENT, { version })
  } catch (error) {
    console.error("Realtime broadcast failed", error)
  }
}

/**
 * A table whose ready check has run out of time goes back to the lobby without those who were not ready (`expirePatch`). Nothing runs on a timer, so the first request that looks at such a table ends the check: the read
 * route that every board polls, the board's page, the ready route and the start route all pass the row they read through here. The row of any other table comes back as it is, with no write; the realtime ping of the write tells the others.
 */
export async function settleReadyCheck(game: GameRef, row: GameRow, now = Date.now()): Promise<GameRow> {
  if (!readyExpired(row, now)) return row
  return updateGame(game, row.code, (current) => (readyExpired(current, now) ? expirePatch(current) : null))
}

/** Data loaded on the server before `GAME.setup` (e.g. Courtisans' missions from Sanity): the game's optional `loadSetupData`. */
export async function loadSetupData(game: PlayableGame, options: OptionValues = {}, locale: Locale = DEFAULT_LOCALE): Promise<unknown> {
  return game.binding.loadSetupData?.({ game, locale, sanity: sanityClient(game), options })
}

/** Data given to the board (`data` prop of its `Game`, e.g. Courtisans' card catalog): the game's optional `loadGameData`. */
export async function loadGameData(game: PlayableGame, locale: Locale = DEFAULT_LOCALE): Promise<unknown> {
  return game.binding.loadGameData?.({ game, locale, sanity: sanityClient(game) })
}

/**
 * Seed of a new game (crypto random, an integer below 2^52): the engine derives the whole game from it, which
 * keeps games reproducible. `createRng` only uses the low 32 bits; engines may use the high ones for side streams.
 * Staying below 2^52 leaves room for engines that add small offsets to it.
 */
export function newSeed(): number {
  const [high, low] = crypto.getRandomValues(new Uint32Array(2))
  return (high! & 0xfffff) * 2 ** 32 + low!
}

export function newGame(game: PlayableGame, row: GameRow, data?: unknown, now = Date.now()): Pick<GameRow, "status" | "state" | "replay" | "takeover_votes"> & { log?: LogWrite } {
  const { GAME } = game.binding
  const options = normalizeOptions(GAME.options, row.options, { playerCount: row.players.length })
  // The engine is given `PlayerInfo` and nothing more: a picture of an account is for the seat labels, never for the state
  const players = row.players.map(({ id, nickname }) => ({ id, nickname }))
  const opened = setupOf(GAME, { players, options, seed: newSeed(), data })
  // A new game on the table starts a new log, when the game keeps one, and the log opens with what the setup said (the first round dealt). A game that says nothing never touches `game_log`
  // The clock of the first step starts when the game is live: here for a table that is played at once, and again when the last player of a ready check is ready
  return { status: "playing", state: beginOf(GAME, opened.state, now), replay: [], takeover_votes: [], ...(GAME.step ? { log: { reset: true, entries: opened.events } } : {}) }
}

/**
 * The table as `playerId` sees it. `waitingFor`, `present` and `takeovers` are public information, identical for every viewer
 * except that the viewer counts as present (their request is being served right now; `markSeen` records it after the response).
 */
export function publicGame(game: PlayableGame, row: GameRow, playerId: string | null, now = Date.now(), steps: readonly LoggedStep[] = []): PublicGame {
  const { GAME } = game.binding
  const member = row.players.some((j) => j.id === playerId)
  const playing = row.status === "playing" && !!row.state
  const waitingFor = playing ? waitingPlayers(GAME, row.state) : []
  const { present, takeovers } = publicTakeover({
    players: row.players,
    seen: row.seen,
    viewer: playerId,
    waiting: waitingFor,
    entries: playing ? row.takeover_votes : [],
    fingerprint: playing ? stateFingerprint(row.state) : "",
    now,
  })
  return {
    code: row.code,
    hostId: row.host_id,
    status: row.status,
    players: row.players,
    meId: member ? playerId : null,
    options: row.options ?? normalizeOptions(GAME.options, {}),
    replay: row.replay,
    ready: row.status === "starting" ? readyIds(row) : [],
    readyInMs: readyLeft(row, now),
    deadlineInMs: playing ? deadlineIn(GAME, row.state, now) : null,
    waitingFor,
    present,
    takeovers,
    version: row.version,
    progress: row.state ? progressOf(GAME, row.state) : null,
    updatedAt: row.updated_at ?? null,
    createdAt: row.created_at ?? null,
    view: row.state ? GAME.view(row.state, member ? playerId : null) : null,
    log: viewLogged(steps, member ? playerId : null),
  }
}

/**
 * The table as `playerId` sees it, with its log: `publicGame` after a read of the log of the table. Every route that answers a player with the table goes through it. A game that says nothing of what its moves did, and a table with no
 * game in it yet, have no log and cost no read.
 */
export async function servedGame(game: PlayableGame, row: GameRow, playerId: string | null, now = Date.now()): Promise<PublicGame> {
  const steps = game.binding.GAME.step && row.state ? await readLog(game.slug, row.code) : []
  return publicGame(game, row, playerId, now, steps)
}
