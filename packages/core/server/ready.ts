import type { LogWrite } from "./game-log"
import type { GameRow } from "./games"

/**
 * The ready check (PLT-107). When the host starts a table it is `starting`: everybody seated comes to its board, which loads behind the platform's start screen, and a player is ready when their board is. When all of them are, the
 * game is `playing`; whoever is not ready when the time is up is unseated and the table goes back to the lobby for the others. This file is the rules of it, pure and tested; the routes write what it says.
 *
 * While `starting` the row already holds the game's `state`, set up when the host started it: a board is drawn from a view of it, and a board needs one to be loaded behind the start screen. Going back to the lobby drops it,
 * and the next start sets the game up again with whoever is seated then.
 */

/** How long the players have to be ready (their boards loaded) once the host has started the table. */
export const READY_WINDOW_MS = 60_000

/** The window in force: `READY_CHECK_SECONDS` of the environment (a whole number of seconds, 5 to 600) when it is set, else `READY_WINDOW_MS`. A short one is how the deadline is tried by hand. */
export function readyWindowMs(env: Record<string, string | undefined> = process.env): number {
  const seconds = Number(env.READY_CHECK_SECONDS)
  return Number.isInteger(seconds) && seconds >= 5 && seconds <= 600 ? seconds * 1000 : READY_WINDOW_MS
}

type Check = Pick<GameRow, "status" | "players" | "host_id" | "ready_at" | "ready_deadline">

/** The ids of the players who said they are ready, in seat order. */
export const readyIds = (row: Pick<GameRow, "players" | "ready_at">): string[] => row.players.filter((player) => row.ready_at?.[player.id]).map((player) => player.id)

/** Whether the time of a ready check is up. A `starting` table with no deadline cannot happen, but would be up at once rather than never. */
export const readyExpired = (row: Pick<GameRow, "status" | "ready_deadline">, now: number): boolean => row.status === "starting" && !(Date.parse(row.ready_deadline ?? "") > now)

/** How many milliseconds the players still have, at `now`; null outside a ready check. */
export function readyLeft(row: Pick<GameRow, "status" | "ready_deadline">, now: number): number | null {
  if (row.status !== "starting") return null
  const left = Date.parse(row.ready_deadline ?? "") - now
  return Number.isFinite(left) ? Math.max(0, left) : 0
}

/** What the host's start writes: the game set up (`started`, from `newGame`) and waiting for the players. */
export function startingPatch(started: Pick<GameRow, "state" | "replay" | "takeover_votes"> & { log?: LogWrite }, now: number, windowMs = readyWindowMs()): Partial<GameRow> & { log?: LogWrite } {
  return {
    state: started.state,
    replay: started.replay,
    takeover_votes: started.takeover_votes,
    ...(started.log ? { log: started.log } : {}),
    status: "starting",
    ready_at: {},
    ready_deadline: new Date(now + windowMs).toISOString(),
  }
}

/**
 * What a player's "I'm ready" writes (their board sends it by itself once it is loaded): the time they said it, and, when they are the last, the beginning of the game. Null when it changes nothing: the table is not in a ready check, the
 * player is not at it, or they said it already.
 */
export function readyPatch(row: Check, playerId: string, now: number): Partial<GameRow> | null {
  if (row.status !== "starting" || !row.players.some((player) => player.id === playerId) || row.ready_at?.[playerId]) return null
  const ready_at = { ...row.ready_at, [playerId]: new Date(now).toISOString() }
  return row.players.every((player) => ready_at[player.id]) ? { status: "playing", ready_at: {}, ready_deadline: null } : { ready_at }
}

/**
 * The table goes back to the lobby with the players for whom `stays` is true: the game set up for the ready check and every mark of it are dropped. The host stays the host while they are seated, else it is whoever sat
 * down first of those who are left (as when a host leaves a lobby).
 */
function backToLobby(row: Pick<GameRow, "players" | "host_id">, stays: (id: string) => boolean): Partial<GameRow> {
  const players = row.players.filter((player) => stays(player.id))
  const host_id = players.some((player) => player.id === row.host_id) ? row.host_id : (players[0]?.id ?? row.host_id)
  return { status: "lobby", players, host_id, state: null, replay: [], takeover_votes: [], ready_at: {}, ready_deadline: null }
}

/** What ends a ready check whose time is up: whoever is not ready is unseated, the others go back to the lobby. */
export const expirePatch = (row: Check): Partial<GameRow> => backToLobby(row, (id) => !!row.ready_at?.[id])

/** What a player who leaves a table in a ready check writes: they are unseated and the check is over, since the game was set up for the seats it had. Null when the table is not in a ready check or they are not at it. */
export function withdrawPatch(row: Check, playerId: string): Partial<GameRow> | null {
  if (row.status !== "starting" || !row.players.some((player) => player.id === playerId)) return null
  return backToLobby(row, (id) => id !== playerId)
}
