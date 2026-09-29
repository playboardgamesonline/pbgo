import { type DebugCommand, GAME } from "@pgo/binding"
import type { NextRequest } from "next/server"
import { ApiError, handle, readJson } from "../../../../../server/api"
import { getPlayerId } from "../../../../../server/player"
import { updateGame, newGame, publicGame } from "../../../../../server/games"

export const POST = handle(async (request: NextRequest, ctx: { params: Promise<{ code: string }> }) => {
  if (process.env.NODE_ENV === "production" && process.env.DEBUG_GAMES !== "1") throw new ApiError("DEBUG_DISABLED", 403)
  const { code } = await ctx.params
  const id = await getPlayerId()
  const { command } = await readJson<{ command: "start" | DebugCommand }>(request)

  const row = await updateGame(code, (game) => {
    if (!id || !game.players.some((j) => j.id === id)) throw new ApiError("UNKNOWN_PLAYER", 403)
    if (command === "start") return newGame(game)
    const step = GAME.debug?.[command]
    if (!step) throw new ApiError("INVALID_ACTION")
    if (!game.state) throw new ApiError("GAME_NOT_STARTED", 409)
    const state = step(game.state)
    return { state, status: GAME.isOver(state) ? "over" : "playing" }
  })
  return publicGame(row, id)
})
