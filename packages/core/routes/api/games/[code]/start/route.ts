import type { NextRequest } from "next/server"
import { loadSettings } from "../../../../../lib/settings-server"
import { ApiError, handle } from "../../../../../server/api"
import { getPlayerId } from "../../../../../server/player"
import { loadSetupData, readGame, updateGame, newGame, publicGame } from "../../../../../server/games"

export const POST = handle(async (_request: NextRequest, ctx: { params: Promise<{ code: string }> }) => {
  const { code } = await ctx.params
  const id = await getPlayerId()
  const { minPlayers } = await loadSettings()
  const data = await loadSetupData((await readGame(code)).options)
  const row = await updateGame(code, (game) => {
    if (game.host_id !== id) throw new ApiError("HOST_ONLY", 403)
    if (game.status !== "lobby") throw new ApiError("GAME_IN_PROGRESS", 409)
    if (game.players.length < minPlayers) throw new ApiError("NOT_ENOUGH_PLAYERS")
    return newGame(game, data)
  })
  return publicGame(row, id)
})
