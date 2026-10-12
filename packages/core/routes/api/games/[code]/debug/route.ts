import type { DebugCommand } from "@pbgo/engine-kit"
import type { GameRouteContext } from "../../../../../lib/binding"
import { ApiError, handle, readJson } from "../../../../../server/api"
import { loadSetupData, newGame, publicGame, readGame, updateGame } from "../../../../../server/games"
import { getPlayerId } from "../../../../../server/player"

export const POST = handle(async (request: Request, { game, params }: GameRouteContext) => {
  if (process.env.NODE_ENV === "production" && process.env.DEBUG_GAMES !== "1") throw new ApiError("DEBUG_DISABLED", 403)
  const { GAME } = game.binding
  const code = params.code ?? ""
  const id = await getPlayerId(game.slug)
  const { command } = await readJson<{ command: "start" | DebugCommand }>(request)

  const data = await loadSetupData(game, (await readGame(game, code)).options)
  const row = await updateGame(game, code, (row) => {
    if (!id || !row.players.some((j) => j.id === id)) throw new ApiError("UNKNOWN_PLAYER", 403)
    if (command === "start") return newGame(game, row, data)
    const step = GAME.debug?.[command]
    if (!step) throw new ApiError("INVALID_ACTION")
    if (!row.state) throw new ApiError("GAME_NOT_STARTED", 409)
    const state = step(row.state)
    return { state, status: GAME.isOver(state) ? "over" : "playing" }
  })
  return publicGame(game, row, id)
})
