import type { OptionValues } from "@pbgo/engine-kit"
import type { PublicGame, PublicPlayer } from "./game-types"

/**
 * The preview of a game in play (`/<slug>/preview/play`): a made-up table, played in the browser against the game's real engine, with no database, no account and nobody else. The whole table travels with each request (`SandboxTable`):
 * the server keeps nothing, it only runs the engine on what it is sent and answers the table that follows and how the seat being looked at sees it. A developer's and a designer's tool, never on the production deployment but for the gamemaster.
 */

/** The code of every made-up table: the address of nothing, so that no channel of a real table is ever reached */
export const SANDBOX_CODE = "PREVIEW"

/** The made-up players, in seat order */
export const SANDBOX_NAMES = ["Alix", "Basile", "Camille", "Dorian", "Élise", "Félix", "Gabriel", "Héloïse", "Inès", "Jules", "Katia", "Léon"]

/** How many turns are played for the players before the table is shown, by default: a game a little under way, with something on the table */
export const SANDBOX_TURNS = 0

/** The most turns that are played for the players at once */
export const SANDBOX_MAX_TURNS = 200

/** The log a made-up table keeps: what one move said, as the table of a real game keeps it (`LoggedStep` of the server) */
export type SandboxStep = { version: number; entries: readonly unknown[] }

/** A made-up table, whole: what the browser holds and sends back with each request. Its state is the engine's, in full, hidden cards included: it is a tool to look at a game, not a game to win */
export type SandboxTable = {
  players: PublicPlayer[]
  options: OptionValues
  state: unknown
  over: boolean
  version: number
  steps: SandboxStep[]
  /** The seed the game was dealt from: the same seed and the same turns give the same table */
  seed: number
}

/** What a made-up table is opened with, read from the address of the page (`sandboxParams`) */
export type SandboxSetup = {
  players: number
  /** Turns played for the players before the table is shown */
  turns: number
  /** A command of the game's debug panel (`GAME.debug`) run once they are played: a situation to look at (`princessInHand`, `bustOnTop`…) */
  scenario: string | null
  seed: number | null
  /** The seat the table is seen from, 0 for the first */
  seat: number
}

/** What the browser asks of a made-up table (`POST /gamemaster/api/<slug>/sandbox`) */
export type SandboxRequest =
  | { op: "new"; setup: SandboxSetup }
  | { op: "view"; table: SandboxTable; viewer: string }
  | { op: "action"; table: SandboxTable; viewer: string; action: { type: string } & Record<string, unknown> }
  /** Plays for the players the game waits for (`ids`, by default the first of them): an absent player's move */
  | { op: "playFor"; table: SandboxTable; viewer: string; ids?: string[] }
  | { op: "debug"; table: SandboxTable; viewer: string; command: string }
  | { op: "tick"; table: SandboxTable; viewer: string }
  | { op: "load"; table: SandboxTable; viewer: string; saved: unknown }

export type SandboxAnswer = { table: SandboxTable; game: PublicGame }

const whole = (value: string | null, fallback: number, min: number, max: number) => {
  const n = value === null || value.trim() === "" ? NaN : Number(value)
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.trunc(n))) : fallback
}

/**
 * The setup of a made-up table from the address of the page: `?players=4&turns=6&scenario=princessInHand&seed=42&seat=1`. Every value is optional and kept within what the game takes: the players between its least and its most (3 by
 * default, or its least), the seat one of theirs, the turns up to `SANDBOX_MAX_TURNS`. A scenario is any name: the server runs it only when the game has that debug command.
 */
export function sandboxParams(search: URLSearchParams | Record<string, string | string[] | undefined>, bounds: { minPlayers: number; maxPlayers: number }): SandboxSetup {
  const get = (key: string): string | null => {
    if (search instanceof URLSearchParams) return search.get(key)
    const value = search[key]
    return Array.isArray(value) ? (value[0] ?? null) : (value ?? null)
  }
  const fallback = Math.max(bounds.minPlayers, Math.min(bounds.maxPlayers, 3))
  const players = whole(get("players"), fallback, bounds.minPlayers, bounds.maxPlayers)
  const scenario = get("scenario")?.trim() || null
  const seedText = get("seed")
  const seed = seedText !== null && /^\d{1,15}$/.test(seedText) ? Number(seedText) : null
  return { players, turns: whole(get("turns"), SANDBOX_TURNS, 0, SANDBOX_MAX_TURNS), scenario, seed, seat: whole(get("seat"), 0, 0, players - 1) }
}

/** The address of the page for a setup: the values that are not the default only, so that a link says what it changes */
export function sandboxSearch(setup: SandboxSetup): string {
  const params = new URLSearchParams()
  params.set("players", String(setup.players))
  if (setup.turns !== SANDBOX_TURNS) params.set("turns", String(setup.turns))
  if (setup.scenario) params.set("scenario", setup.scenario)
  if (setup.seed !== null) params.set("seed", String(setup.seed))
  if (setup.seat !== 0) params.set("seat", String(setup.seat))
  return `?${params.toString()}`
}

/** The made-up players of a table of `count` seats */
export const sandboxPlayers = (count: number): PublicPlayer[] =>
  Array.from({ length: count }, (_, i) => ({ id: `preview-${i + 1}`, nickname: SANDBOX_NAMES[i % SANDBOX_NAMES.length]! }))
