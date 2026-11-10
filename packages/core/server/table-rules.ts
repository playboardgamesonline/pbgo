import { canPlayFor, isEngineError, type LogEntry, playStepFor, waitingPlayers, type AnyGameDefinition } from "@pbgo/engine-kit"
import type { PublicPlayer } from "../lib/game-types"
import type { GameRow } from "./games"
import { withdrawPatch } from "./ready"

/**
 * The rules of the tables that PLT-120 adds, pure and tested; the routes write what they say.
 *
 * - A player can sit at several lobbies, but a table does not start while one of its players is in a game somewhere else (`busy_seats`, migration 0013, read by `server/tables.ts`).
 * - A player who leaves a game in progress keeps their seat at the table, marked `left`: the state of the game has a seat for them, so it cannot go. The server plays it from then on (`settleLeavers`), so that the others can finish. A
 *   player who has left takes no part in the table any more: they are not a member of it for the routes, not present, and the table is no longer theirs (`isSeated`).
 * - A table in its ready check or in the lobby has nobody who left: a player who leaves one of those is unseated (`leavePatch`).
 */

/** Whether the player left the game while it was in progress. */
export const hasLeft = (player: Pick<PublicPlayer, "left">): boolean => player.left === true

/** The players who are still at the table: everybody but those who left. */
export const seatedPlayers = <P extends Pick<PublicPlayer, "left">>(players: readonly P[]): P[] => players.filter((player) => !hasLeft(player))

/** Whether `playerId` sits at the table and did not leave it: the test of every route that acts for a player. */
export const isSeated = (row: Pick<GameRow, "players">, playerId: string | null | undefined): boolean =>
  !!playerId && row.players.some((player) => player.id === playerId && !hasLeft(player))

/** Whether two lists of players are the same seats in the same order: a table read before a check and written after it must not have changed in between. */
export const sameSeats = (a: readonly Pick<PublicPlayer, "id">[], b: readonly Pick<PublicPlayer, "id">[]): boolean => a.length === b.length && a.every((player, index) => player.id === b[index]?.id)

type Leaving = Pick<GameRow, "status" | "players" | "host_id" | "ready_at" | "ready_deadline">

/** Where a player was when they left: a table that was starting or being played (a lobby is left with no word to say). */
export type Departure = "starting" | "playing"

/**
 * What a player's leaving writes, null when it changes nothing: they do not sit at the table (or already left it), or it is over, which holds nobody.
 *   - in the lobby they are unseated, and the table has another host if they were it;
 *   - in its ready check they are unseated and the check is over, since the game was set up for the seats it had (`withdrawPatch`, PLT-107);
 *   - in a game in progress their seat is marked `left`, and stays.
 */
export function leavePatch(row: Leaving, playerId: string): Partial<GameRow> | null {
  if (!isSeated(row, playerId)) return null
  switch (row.status) {
    case "lobby": {
      const players = row.players.filter((player) => player.id !== playerId)
      return { players, host_id: row.host_id === playerId ? (players[0]?.id ?? row.host_id) : row.host_id }
    }
    case "starting":
      return withdrawPatch(row, playerId)
    case "playing":
      return { players: row.players.map((player) => (player.id === playerId ? { ...player, left: true } : player)) }
    default:
      return null
  }
}

/** The most steps the server plays in a row for the players who left: far above what a game asks of one, and a stop for an engine that never moves on. */
export const MAX_SETTLE_STEPS = 200

/**
 * Plays the steps that the game waits for from players who left, one after the other, until it waits for someone who is still there, or is over (`GAME.autoPlayFor`, as the takeover does for an absent player: the move is the
 * engine's own, never the server's). Nothing is played when everybody left (the table is abandoned and the game is not played out alone), when the game cannot be played for a player, or when the engine refuses: the others
 * can then vote to play for them as usual. Returns the state and the players it played for, in the order it first did, and what the plays said happened when the game says it (`events`, for the log of the table). `at` is the time the
 * server plays them at, for a game with a clock.
 */
export function settleLeavers<State>(GAME: AnyGameDefinition, state: State, players: readonly Pick<PublicPlayer, "id" | "left">[], at?: number): { state: State; played: string[]; events?: readonly LogEntry<unknown>[] } {
  const left = new Set(players.filter(hasLeft).map((player) => player.id))
  const played: string[] = []
  if (left.size === 0 || left.size >= players.length || !canPlayFor(GAME)) return { state, played }
  let current = state
  const events: LogEntry<unknown>[] = []
  for (let step = 0; step < MAX_SETTLE_STEPS; step++) {
    const target = waitingPlayers(GAME, current).find((id) => left.has(id))
    if (target === undefined) break
    try {
      const done = playStepFor(GAME, current, target, at)
      current = done.state as State
      events.push(...done.events)
    } catch (error) {
      if (isEngineError(error)) break
      throw error
    }
    if (!played.includes(target)) played.push(target)
  }
  return { state: current, played, ...(events.length ? { events } : {}) }
}

/** Where a player left a table from, for the event that says so; null for a lobby or a table that is over. */
export const departureOf = (status: GameRow["status"]): Departure | null => (status === "starting" || status === "playing" ? status : null)
