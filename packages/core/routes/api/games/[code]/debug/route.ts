import { waitingPlayers, type DebugCommand } from "@pbgo/engine-kit"
import { after } from "next/server"
import type { GameRouteContext, PlayableGame } from "../../../../../lib/binding"
import { ApiError, handle, readJson } from "../../../../../server/api"
import { debugEnabled, restoreState, saveState } from "../../../../../server/debug-table"
import { type GameRow, loadSetupData, newGame, servedGame, readGame, updateGame } from "../../../../../server/games"
import { getPlayerId } from "../../../../../server/player"
import { markGameStarted, recordGameResult } from "../../../../../server/results"
import { isSeated } from "../../../../../server/table-rules"

/**
 * A saved state for the seats of this table (`restoreState`), once the game has taken a look at it: a state that the engine cannot read is refused (`INVALID_STATE`) instead of being written. Debug tools only.
 */
function loadable(game: PlayableGame, row: GameRow, saved: unknown): unknown {
  const { GAME } = game.binding
  const ids = row.players.map((j) => j.id)
  try {
    const state = restoreState(saved, game.slug, ids)
    GAME.isOver(state)
    waitingPlayers(GAME, state)
    for (const id of ids) GAME.view(state, id)
    return state
  } catch {
    throw new ApiError("INVALID_STATE")
  }
}

/**
 * `POST /api/<slug>/games/<code>/debug`: the commands of the game (`GAME.debug`: `turn`, `over`, its own) and the ones of the platform, for a player who sits at the table and where `debugEnabled` allows it.
 * - `start`: a new game with the players seated.
 * - `state`: the state of the table, saved (`SavedState`: the seats in order and the state), to keep.
 * - `load`: a saved state put in the place of the state of the table, its seats mapped on the table's in the same order; the log starts again.
 */
export const POST = handle(async (request: Request, { game, params }: GameRouteContext) => {
  if (!debugEnabled()) throw new ApiError("DEBUG_DISABLED", 403)
  const { GAME } = game.binding
  const code = params.code ?? ""
  const id = await getPlayerId(game.slug)
  const body = await readJson<{ command: "start" | "state" | "load" | DebugCommand; saved?: unknown }>(request)
  const { command } = body

  // What writes nothing to the table: read its state
  if (command === "state") {
    const row = await readGame(game, code)
    if (!id || !row.players.some((j) => j.id === id)) throw new ApiError("UNKNOWN_PLAYER", 403)
    if (!row.state) throw new ApiError("GAME_NOT_STARTED", 409)
    return saveState(game.slug, row.players.map((j) => j.id), row.state)
  }

  const data = await loadSetupData(game, (await readGame(game, code)).options)
  // Whether the table was over before the write of the modifier's last run: it runs again when it loses a race, so it starts from nothing each time
  let wasOver = false
  const row = await updateGame(game, code, (row) => {
    wasOver = row.status === "over"
    if (!id || !isSeated(row, id)) throw new ApiError("UNKNOWN_PLAYER", 403)
    if (command === "start") return newGame(game, row, data)
    if (command === "load") {
      const state = loadable(game, row, body.saved)
      return { state, status: GAME.isOver(state) ? "over" : "playing", takeover_votes: [], ...(GAME.step ? { log: { reset: true } } : {}) }
    }
    const step = GAME.debug?.[command]
    if (!step) throw new ApiError("INVALID_ACTION")
    if (!row.state) throw new ApiError("GAME_NOT_STARTED", 409)
    const state = step(row.state)
    return { state, status: GAME.isOver(state) ? "over" : "playing" }
  })
  // A command can end the game, or start a new one. One that finds the table over again ends nothing, so the game is not written twice. A debug game counts for no rating
  if (!wasOver && row.status === "over") after(() => recordGameResult(game, row, { debug: true }))
  if (command === "start") after(() => markGameStarted(game, row))
  return servedGame(game, row, id)
})
