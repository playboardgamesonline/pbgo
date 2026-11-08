import "server-only"
import { normalizeOptions, outcomesOf, type AnyGameDefinition, type OptionValues, type PlayerOutcome } from "@pbgo/engine-kit"
import type { CoreView, GameEntry, PlayableGame } from "../lib/binding"
import type { GameRow } from "./games"
import { supabaseAdmin } from "./supabase"

/**
 * How a game was written down once it was over (PLT-13): the history of the players, their totals and their ratings read it. The server tells the database what the engine says of the end (the public results of its view, read as an outcome
 * for each player by `outcomesOf`) and what the table knows (who sat where, with which options); the database adds the accounts, which it holds apart, and writes the game and its seats in one transaction (`record_game_result`, migration 0006).
 */

/** Why a game ended. Only `finished` is written for now: the others are for the button that leaves a game, the clock that runs out and a table that is closed (PLT-21), and `abandoned` is the platform's to say, never the engine's. */
export type EndReason = "finished" | "abandoned" | "timeout" | "cancelled"

/** One seat of a game that ended, as `record_game_result` takes it: the seat is the place at the table (the order they sat down), the player the id of that seat, and the rest what the engine's results say of it. */
export type ResultSeat = {
  seat: number
  player: string
  name: string
  avatar_url: string | null
  rank: number | null
  score: number | null
  outcome: PlayerOutcome
}

/** A game that ended, as `record_game_result` takes it (its `p_result`). The fields of the database are the ones of `docs/supabase-and-env.md`, Results. */
export type GameResultPayload = {
  /** `coop` when the table wins or loses together, else `elo`: the registry has no field for it yet, so it is the one the engine states */
  rating_kind: "elo" | "coop"
  end_reason: EndReason
  coop_outcome: "won" | "lost" | null
  coop_score: number | null
  engine_version: string
  options: OptionValues
  /** A debug command ended the game: it counts for no rating */
  debug?: boolean
  /** The players that the takeover that ended the game played for: their seats count for no rating */
  taken_over?: string[]
  participants: ResultSeat[]
}

export type ResultContext = {
  endReason?: EndReason
  debug?: boolean
  takenOver?: readonly string[]
  env?: Record<string, string | undefined>
}

/** The commit of the deployment that ran the game (Vercel names it), 12 characters; `dev` anywhere else. It stands for the engine's version until engines have one: it says which code played the game. */
export function engineVersion(env: Record<string, string | undefined> = process.env): string {
  return env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) || "dev"
}

/** A figure of the results as a whole number, null when the engine gave none (or not a number): the database holds whole numbers, and one that does not fit would lose the whole game. */
const whole = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? Math.round(value) : null)

/**
 * The game that has just ended at this table, ready to be written; null when its view has no results, which a game that is over always has (the conformance suite of the kit checks it). The seats are the players of the table, in the
 * order they sat down, each with the outcome `outcomesOf` gives: a player the results name and the table does not know is left out, since there is no seat for them.
 */
export function gameResultOf(GAME: AnyGameDefinition, row: Pick<GameRow, "players" | "options" | "state">, { endReason = "finished", debug = false, takenOver = [], env }: ResultContext = {}): GameResultPayload | null {
  if (!row.state) return null
  const results = (GAME.view(row.state, null) as CoreView | null)?.results
  if (!results) return null
  const outcomes = new Map(outcomesOf(results).map(({ playerId, outcome }) => [playerId, outcome]))
  const participants = results.players
    .flatMap((player): ResultSeat[] => {
      const seat = row.players.findIndex((seated) => seated.id === player.playerId)
      const outcome = outcomes.get(player.playerId)
      if (seat < 0 || !outcome) return []
      const rank = whole(player.rank)
      return [{ seat, player: player.playerId, name: row.players[seat]!.nickname, avatar_url: row.players[seat]!.avatarUrl ?? null, rank: rank !== null && rank >= 1 ? rank : null, score: whole(player.total), outcome }]
    })
    .sort((a, b) => a.seat - b.seat)
  if (!participants.length) return null
  return {
    rating_kind: results.coop ? "coop" : "elo",
    end_reason: endReason,
    coop_outcome: results.coop ?? null,
    // Every player of a table that plays together has the table's score as their total
    coop_score: results.coop ? whole(results.players[0]?.total) : null,
    engine_version: engineVersion(env),
    options: normalizeOptions(GAME.options, row.options, { playerCount: row.players.length }),
    ...(debug ? { debug: true } : {}),
    ...(takenOver.length ? { taken_over: [...takenOver] } : {}),
    participants,
  }
}

/** What goes to the log when the database refuses: its code and its message, never its detail, which holds the row, names included. */
const refusal = (error: { code?: string; message?: string }) => ({ code: error.code, message: error.message })

/**
 * Writes down the game that has just ended at `row`, the table as the write that ended it returned it. Call it from `after()` of `next/server`, once, from the request whose write turned the table `over`: only one request can (the version
 * check lets a single write through), and the database writes a game once even if it were called twice (`record_game_result` answers nothing the second time). Never throws, like `markSeen`: the players have been answered and a failure, or
 * a project where migration 0006 is not applied yet, is logged and the game goes on unrecorded.
 */
export async function recordGameResult(game: PlayableGame, row: GameRow, context: ResultContext = {}): Promise<void> {
  try {
    if (!row.created_at || !row.updated_at) {
      console.error("A game result was not written: the table has no dates", { game: game.slug })
      return
    }
    const result = gameResultOf(game.binding.GAME, row, context)
    if (!result) {
      console.error("A game result was not written: the game is over and its view has no results", { game: game.slug })
      return
    }
    const { error } = await supabaseAdmin().rpc("record_game_result", {
      p_game: game.slug,
      p_code: row.code,
      p_table_created_at: row.created_at,
      p_finished_at: row.updated_at,
      p_result: result,
    })
    if (error) console.error("A game result was not written", { game: game.slug }, refusal(error))
  } catch (error) {
    console.error("A game result was not written", { game: game.slug }, error instanceof Error ? error.message : error)
  }
}

/**
 * Tells the database that play began at this table (the last board was ready, or the rematch was agreed), at the instant of the write that began it, for the duration of the game. Never throws: a failure only leaves the duration of
 * the game unknown. Call it from `after()`.
 */
export async function markGameStarted(game: Pick<GameEntry, "slug">, row: Pick<GameRow, "code" | "updated_at">): Promise<void> {
  if (!row.updated_at) return
  try {
    const { error } = await supabaseAdmin().rpc("mark_game_started", { p_game: game.slug, p_code: row.code, p_at: row.updated_at })
    if (error) console.error("The start of a game was not written", { game: game.slug }, refusal(error))
  } catch (error) {
    console.error("The start of a game was not written", { game: game.slug }, error instanceof Error ? error.message : error)
  }
}

/** Tells the database which players the others played for (the takeover), so that their seats count for no rating. Never throws; nothing is written for no player. Call it from `after()`, before `recordGameResult` when the same request ends the game. */
export async function markTakenOver(game: Pick<GameEntry, "slug">, code: string, players: readonly string[]): Promise<void> {
  if (!players.length) return
  try {
    const { error } = await supabaseAdmin().rpc("mark_taken_over", { p_game: game.slug, p_code: code, p_players: [...players] })
    if (error) console.error("A takeover was not written", { game: game.slug }, refusal(error))
  } catch (error) {
    console.error("A takeover was not written", { game: game.slug }, error instanceof Error ? error.message : error)
  }
}
