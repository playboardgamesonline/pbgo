import "server-only"
import * as serverBinding from "@pbgo/binding-server"
import { type State, GAME, type PlayerInfo, normalizeOptions, type OptionValues } from "@pbgo/binding"
import { type PublicGame, type GameStatus, UPDATE_EVENT, gameChannel } from "../lib/game-types"
import { ApiError } from "./api"
import { validCode, generateCode, normalizeCode } from "./code"
import { supabaseAdmin } from "./supabase"

export type GameRow = {
  code: string
  host_id: string
  status: GameStatus
  players: PlayerInfo[]
  options: OptionValues
  state: State | null
  replay: string[]
  version: number
  updated_at?: string
}

const COLUMNS = "code, host_id, status, players, options, state, replay, version, updated_at"

// Écritures concurrentes (ex. tous les joueurs qui valident l'ouverture en même temps) : on réessaie avec une attente aléatoire croissante
const MAX_ATTEMPTS = 8
const pause = (attempt: number) => new Promise((resolve) => setTimeout(resolve, 20 + Math.random() * 60 * (attempt + 1)))

export async function readGame(rawCode: string): Promise<GameRow> {
  const code = normalizeCode(rawCode)
  if (!validCode(code)) throw new ApiError("INVALID_CODE")
  const { data, error } = await supabaseAdmin().from("games").select(COLUMNS).eq("code", code).maybeSingle()
  if (error) throw error
  if (!data) throw new ApiError("GAME_NOT_FOUND", 404)
  return data as GameRow
}

export async function createGame(host: PlayerInfo, options: OptionValues = normalizeOptions(GAME.options, {})): Promise<GameRow> {
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
      version: 0,
    }
    const { error } = await db.from("games").insert(row)
    if (!error) return row
    if (error.code !== "23505") throw error
  }
  throw new ApiError("CODE_UNAVAILABLE", 500)
}

export async function updateGame(code: string, modifier: (row: GameRow) => Partial<Omit<GameRow, "code" | "version">> | null): Promise<GameRow> {
  const db = supabaseAdmin()
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) await pause(attempt)
    const row = await readGame(code)
    const patch = modifier(row)
    if (!patch) return row
    const updatedAt = new Date().toISOString()
    const next = { ...row, ...patch, version: row.version + 1, updated_at: updatedAt }
    const { data, error } = await db
      .from("games")
      .update({ ...patch, version: next.version, updated_at: updatedAt })
      .eq("code", row.code)
      .eq("version", row.version)
      .select("code")
    if (error) throw error
    if (data.length === 1) {
      await notify(row.code, next.version)
      return next
    }
  }
  throw new ApiError("CONFLICT", 409)
}

async function notify(code: string, version: number) {
  try {
    await supabaseAdmin().channel(gameChannel(code)).httpSend(UPDATE_EVENT, { version })
  } catch (error) {
    console.error("Broadcast realtime impossible", error)
  }
}

/**
 * Données de mise en place chargées côté serveur avant `GAME.setup` (ex. missions Sanity de Courtisans) :
 * export facultatif `loadSetupData({ options })` de @pbgo/binding-server.
 */
const setupLoader = (serverBinding as { loadSetupData?: (args: { options: OptionValues }) => Promise<unknown> }).loadSetupData

export async function loadSetupData(options: OptionValues = {}): Promise<unknown> {
  return setupLoader ? setupLoader({ options }) : undefined
}

export function newGame(row: GameRow, data?: unknown): Pick<GameRow, "status" | "state" | "replay"> {
  const setup = GAME.setup as (args: { players: PlayerInfo[]; options: OptionValues; data?: unknown }) => State
  const options = normalizeOptions(GAME.options, row.options, { playerCount: row.players.length })
  return { status: "playing", state: setup({ players: row.players, options, data }), replay: [] }
}

export function publicGame(row: GameRow, playerId: string | null): PublicGame {
  const member = row.players.some((j) => j.id === playerId)
  return {
    code: row.code,
    hostId: row.host_id,
    status: row.status,
    players: row.players,
    meId: member ? playerId : null,
    options: row.options ?? normalizeOptions(GAME.options, {}),
    replay: row.replay,
    version: row.version,
    updatedAt: row.updated_at ?? null,
    view: row.state ? GAME.view(row.state, member ? playerId : null) : null,
  }
}
