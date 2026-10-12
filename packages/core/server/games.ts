import "server-only"
import { normalizeOptions, type OptionValues, type PlayerInfo } from "@pbgo/engine-kit"
import type { GameEntry, PlayableGame } from "../lib/binding"
import { type PublicGame, type GameStatus, UPDATE_EVENT, gameChannel } from "../lib/game-types"
import { DEFAULT_LOCALE, type Locale } from "../lib/i18n"
import { sanityClient } from "../sanity/client"
import { ApiError } from "./api"
import { validCode, generateCode, normalizeCode } from "./code"
import { supabaseAdmin } from "./supabase"

/** A table, as stored in `games` (one table per game and code: `(game, code)` is the key). */
export type GameRow = {
  code: string
  host_id: string
  status: GameStatus
  players: PlayerInfo[]
  options: OptionValues
  /** Engine state (the game's own type), null in the lobby */
  state: unknown
  replay: string[]
  /** Votes to play for the absent player: `<state fingerprint>:<player>` (see `takeoverVotes`) */
  takeover_votes: string[]
  /** Last time the server saw each player (player id → ISO time), written by `markSeen` (`presence.ts`) without a new version */
  seen?: Record<string, string>
  version: number
  updated_at?: string
  created_at?: string
}

type GameRef = Pick<GameEntry, "slug">

const COLUMNS = "code, host_id, status, players, options, state, replay, takeover_votes, seen, version, updated_at, created_at"

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

export async function createGame(game: PlayableGame, host: PlayerInfo, options: OptionValues = normalizeOptions(game.binding.GAME.options, {})): Promise<GameRow> {
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
      version: 0,
    }
    const { error } = await db.from("games").insert({ game: game.slug, ...row })
    if (!error) return row
    if (error.code !== "23505") throw error
  }
  throw new ApiError("CODE_UNAVAILABLE", 500)
}

/**
 * Votes to play for the absent player (`takeover_votes` column): `<state fingerprint>:<player>`.
 * Every move changes the state, so its fingerprint: stale votes are ignored without having to purge them.
 */
export function stateFingerprint(state: unknown): string {
  const text = JSON.stringify(state ?? null)
  let h = 5381
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

/** Takeover votes valid for the current state (player ids). */
export function takeoverVotes(row: Pick<GameRow, "takeover_votes" | "state">): string[] {
  const key = `${stateFingerprint(row.state)}:`
  return (row.takeover_votes ?? []).filter((v) => v.startsWith(key)).map((v) => v.slice(key.length))
}

export const takeoverEntry = (state: unknown, playerId: string) => `${stateFingerprint(state)}:${playerId}`

export async function updateGame(
  game: GameRef,
  code: string,
  modifier: (row: GameRow) => Partial<Omit<GameRow, "code" | "version">> | null,
  { quiet = false }: { quiet?: boolean } = {},
): Promise<GameRow> {
  const db = supabaseAdmin()
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) await pause(attempt)
    const row = await readGame(game, code)
    const patch = modifier(row)
    if (!patch) return row
    // `quiet` (votes): the version changes so clients refresh, but not the turn's inactivity clock
    const updatedAt = quiet && !("state" in patch) && row.updated_at ? row.updated_at : new Date().toISOString()
    const next = { ...row, ...patch, version: row.version + 1, updated_at: updatedAt }
    const { data, error } = await db
      .from("games")
      .update({ ...patch, version: next.version, updated_at: updatedAt })
      .eq("game", game.slug)
      .eq("code", row.code)
      .eq("version", row.version)
      .select("code")
    if (error) throw error
    if (data.length === 1) {
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

export function newGame(game: PlayableGame, row: GameRow, data?: unknown): Pick<GameRow, "status" | "state" | "replay" | "takeover_votes"> {
  const { GAME } = game.binding
  const options = normalizeOptions(GAME.options, row.options, { playerCount: row.players.length })
  return { status: "playing", state: GAME.setup({ players: row.players, options, seed: newSeed(), data }), replay: [], takeover_votes: [] }
}

export function publicGame(game: PlayableGame, row: GameRow, playerId: string | null): PublicGame {
  const { GAME } = game.binding
  const member = row.players.some((j) => j.id === playerId)
  return {
    code: row.code,
    hostId: row.host_id,
    status: row.status,
    players: row.players,
    meId: member ? playerId : null,
    options: row.options ?? normalizeOptions(GAME.options, {}),
    replay: row.replay,
    takeoverVotes: row.status === "playing" ? takeoverVotes(row) : [],
    version: row.version,
    updatedAt: row.updated_at ?? null,
    createdAt: row.created_at ?? null,
    view: row.state ? GAME.view(row.state, member ? playerId : null) : null,
  }
}
