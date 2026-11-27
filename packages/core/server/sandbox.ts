import "server-only"
import { beginOf, isEngineError, playStepFor, setupOf, stepOf, waitingPlayers, type LogEntry } from "@pbgo/engine-kit"
import type { PlayableGame } from "../lib/binding"
import type { PublicGame } from "../lib/game-types"
import { SANDBOX_CODE, SANDBOX_MAX_TURNS, type SandboxSetup, type SandboxStep, type SandboxTable, sandboxPlayers } from "../lib/sandbox"
import { gameOptions, type OptionSettings } from "../lib/settings"
import { isAdmin } from "./admin"
import { ApiError } from "./api"
import { restoreState } from "./debug-table"
import { playDueSafely } from "./deadlines"
import { LOG_TAIL, type LoggedStep } from "./game-log"
import { type GameRow, newSeed, publicGame } from "./games"

/**
 * The made-up tables of the preview of a game in play (`lib/sandbox.ts`): the engine run on a table the browser sends, with nothing read from or written to the database. Every function here is pure but `sandboxAllowed`.
 */

/**
 * Who may open the preview: anybody on a preview deployment of Vercel and on a machine in development, where it is the way to look at a board without a database, and on the production deployment the gamemaster only (the page and its API
 * are then reached under `/gamemaster`, where the browser sends the session).
 */
export async function sandboxAllowed(): Promise<boolean> {
  return process.env.VERCEL_ENV !== "production" || (await isAdmin())
}

/** The log of a made-up table with what a move said added, as a real table keeps it: the last `LOG_TAIL` moves */
function logged(steps: readonly SandboxStep[], version: number, entries: readonly unknown[]): SandboxStep[] {
  return entries.length ? [...steps, { version, entries }].slice(-LOG_TAIL) : [...steps]
}

/** The table after a change of its state, with what it said */
function moved(game: PlayableGame, table: SandboxTable, state: unknown, entries: readonly unknown[] = []): SandboxTable {
  const version = table.version + 1
  return { ...table, state, over: game.binding.GAME.isOver(state), version, steps: logged(table.steps, version, entries) }
}

/** Plays for the first player the game waits for, `turns` times, or until it waits for nobody or is over */
function playTurns(game: PlayableGame, table: SandboxTable, turns: number): SandboxTable {
  const { GAME } = game.binding
  let current = table
  for (let i = 0; i < Math.min(turns, SANDBOX_MAX_TURNS) && !current.over; i++) {
    const [waiting] = waitingPlayers(GAME, current.state)
    if (waiting === undefined) break
    const step = playStepFor(GAME, current.state, waiting, Date.now())
    current = moved(game, current, step.state, step.events)
  }
  return current
}

/** Runs one command of the game's debug panel (`GAME.debug`); `INVALID_ACTION` for a name the game does not have */
function runDebug(game: PlayableGame, table: SandboxTable, command: string): SandboxTable {
  const run = game.binding.GAME.debug?.[command]
  if (!run) throw new ApiError("INVALID_ACTION")
  return moved(game, table, run(table.state))
}

/**
 * A new made-up table: the made-up players sit down, the game is dealt from the seed (a new one when none is given), `turns` turns are played for them and the scenario is run. `options` are the engine's options as the game's Studio sets
 * them, as a real table opens with.
 */
export function sandboxNew(game: PlayableGame, setup: SandboxSetup, options: OptionSettings, data?: unknown, now = Date.now()): SandboxTable {
  const { GAME } = game.binding
  const players = sandboxPlayers(setup.players)
  const values = gameOptions(game.binding, options, {}, { playerCount: players.length })
  const seed = setup.seed ?? newSeed()
  const opened = setupOf(GAME, { players: players.map(({ id, nickname }) => ({ id, nickname })), options: values, seed, data })
  const state = beginOf(GAME, opened.state, now)
  let table: SandboxTable = { players, options: values, state, over: GAME.isOver(state), version: 1, steps: logged([], 1, opened.events as readonly unknown[]), seed }
  table = playTurns(game, table, setup.turns)
  if (setup.scenario && GAME.debug?.[setup.scenario]) table = runDebug(game, table, setup.scenario)
  return table
}

/** The table that the browser sent, checked enough for the engine to run on it: its seats are the made-up players' */
export function sandboxTableOf(game: PlayableGame, value: unknown): SandboxTable {
  const table = value as Partial<SandboxTable> | null
  if (!table || typeof table !== "object" || !Array.isArray(table.players) || !table.players.length || table.state === undefined || typeof table.version !== "number") throw new ApiError("INVALID_STATE")
  const expected = sandboxPlayers(table.players.length)
  if (table.players.some((player, i) => player?.id !== expected[i]!.id)) throw new ApiError("INVALID_STATE")
  try {
    game.binding.GAME.isOver(table.state)
  } catch {
    throw new ApiError("INVALID_STATE")
  }
  return {
    players: expected,
    options: table.options ?? {},
    state: table.state,
    over: game.binding.GAME.isOver(table.state),
    version: table.version,
    steps: Array.isArray(table.steps) ? table.steps.slice(-LOG_TAIL) : [],
    seed: typeof table.seed === "number" ? table.seed : 0,
  }
}

/** A move of `viewer`, as the action route plays one: the deadlines that are due first, then the move */
export function sandboxAction(game: PlayableGame, table: SandboxTable, viewer: string, action: { type?: string } & Record<string, unknown>, now = Date.now()): SandboxTable {
  const { GAME } = game.binding
  if (!action.type || !(GAME.clientActions as readonly string[]).includes(action.type)) throw new ApiError("INVALID_ACTION")
  if (table.over) throw new ApiError("GAME_OVER", 409)
  const due = playDueSafely(GAME, table.state, now)
  const step = stepOf(GAME, due.state, { ...action, type: action.type, playerId: viewer, at: now })
  return moved(game, table, step.state, [...due.events, ...step.events])
}

/** Plays for players the game waits for (by default the first of them), as the server plays for an absent player */
export function sandboxPlayFor(game: PlayableGame, table: SandboxTable, ids?: readonly string[], now = Date.now()): SandboxTable {
  const { GAME } = game.binding
  if (table.over) return table
  const waiting = waitingPlayers(GAME, table.state)
  const targets = (ids?.length ? ids.filter((id) => waiting.includes(id)) : waiting.slice(0, 1))
  let current = table
  for (const id of targets) {
    if (current.over || !waitingPlayers(GAME, current.state).includes(id)) continue
    const step = playStepFor(GAME, current.state, id, now)
    current = moved(game, current, step.state, step.events as readonly LogEntry<unknown>[])
  }
  return current
}

/** A command of the debug panel of the game: `GAME.debug`'s, or `start`, a new deal with the same players */
export function sandboxDebug(game: PlayableGame, table: SandboxTable, command: string, options: OptionSettings, data?: unknown): SandboxTable {
  if (command === "start") return { ...sandboxNew(game, { players: table.players.length, turns: 0, scenario: null, seed: null, seat: 0 }, options, data), version: table.version + 1 }
  if (table.over && command !== "over") return table
  return runDebug(game, table, command)
}

/** The deadlines that are due, played */
export function sandboxTick(game: PlayableGame, table: SandboxTable, now = Date.now()): SandboxTable {
  const due = playDueSafely(game.binding.GAME, table.state, now)
  return due.applied ? moved(game, table, due.state, due.events) : table
}

/** A state saved by the debug panel (`Copy state`), from a real table or a made-up one, with as many seats */
export function sandboxLoad(game: PlayableGame, table: SandboxTable, saved: unknown): SandboxTable {
  const { GAME } = game.binding
  try {
    const state = restoreState(saved, game.slug, table.players.map((player) => player.id))
    GAME.isOver(state)
    for (const player of table.players) GAME.view(state, player.id)
    return { ...moved(game, table, state), steps: [] }
  } catch (error) {
    if (isEngineError(error) || error instanceof RangeError || error instanceof TypeError) throw new ApiError("INVALID_STATE")
    throw error
  }
}

/** The made-up table as `viewer` sees it, as a real one is served: everybody is present and nothing is late */
export function sandboxView(game: PlayableGame, table: SandboxTable, viewer: string, now = Date.now()): PublicGame {
  const at = new Date(now).toISOString()
  const row: GameRow = {
    code: SANDBOX_CODE,
    host_id: table.players[0]!.id,
    status: table.over ? "over" : "playing",
    players: table.players,
    options: table.options,
    state: table.state,
    replay: [],
    takeover_votes: [],
    seen: Object.fromEntries(table.players.map((player) => [player.id, at])),
    version: table.version,
    updated_at: at,
    created_at: at,
  }
  const seat = table.players.some((player) => player.id === viewer) ? viewer : table.players[0]!.id
  return publicGame(game, row, seat, now, table.steps as LoggedStep[])
}
