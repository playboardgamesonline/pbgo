import type { DebugCommand } from "@pbgo/engine-kit"
import { after } from "next/server"
import type { GameRouteContext } from "../../../../../lib/binding"
import { ApiError, handle, readJson } from "../../../../../server/api"
import { loadSetupData, newGame, publicGame, readGame, updateGame } from "../../../../../server/games"
import { getPlayerId } from "../../../../../server/player"
import { markGameStarted, recordGameResult } from "../../../../../server/results"

export const POST = handle(async (request: Request, { game, params }: GameRouteContext) => {
  if (process.env.NODE_ENV === "production" && process.env.DEBUG_GAMES !== "1") throw new ApiError("DEBUG_DISABLED", 403)
  const { GAME } = game.binding
  const code = params.code ?? ""
  const id = await getPlayerId(game.slug)
  const { command } = await readJson<{ command: "start" | DebugCommand }>(request)

  const data = await loadSetupData(game, (await readGame(game, code)).options)
  // Whether the table was over before the write of the modifier's last run: it runs again when it loses a race, so it starts from nothing each time
  let wasOver = false
  const row = await updateGame(game, code, (row) => {
    wasOver = row.status === "over"
    if (!id || !row.players.some((j) => j.id === id)) throw new ApiError("UNKNOWN_PLAYER", 403)
    if (command === "start") return newGame(game, row, data)
    const step = GAME.debug?.[command]
    if (!step) throw new ApiError("INVALID_ACTION")
    if (!row.state) throw new ApiError("GAME_NOT_STARTED", 409)
    const state = step(row.state)
    return { state, status: GAME.isOver(state) ? "over" : "playing" }
  })
  // A command can end the game, or start a new one. One that finds the table over again ends nothing, so the game is not written twice. A debug game counts for no rating
  if (!wasOver && row.status === "over") after(() => recordGameResult(game, row, { debug: true }))
  if (command === "start") after(() => markGameStarted(game, row))
  return publicGame(game, row, id)
})
