import type { NextRequest } from "next/server"
import { gameOptions } from "../../../../../lib/settings"
import { loadSettings } from "../../../../../lib/settings-server"
import { ApiError, handle, readJson } from "../../../../../server/api"
import { getPlayerId } from "../../../../../server/player"
import { updateGame, publicGame } from "../../../../../server/games"

export const POST = handle(async (request: NextRequest, ctx: { params: Promise<{ code: string }> }) => {
  const { code } = await ctx.params
  const id = await getPlayerId()
  const settings = await loadSettings()
  const { options } = await readJson<{ options?: unknown }>(request)
  const row = await updateGame(code, (game) => {
    if (game.host_id !== id) throw new ApiError("HOST_ONLY", 403)
    if (game.status === "playing") throw new ApiError("GAME_IN_PROGRESS", 409)
    return { options: gameOptions(settings.options, { ...game.options, ...(options as object) }) }
  })
  return publicGame(row, id)
})
