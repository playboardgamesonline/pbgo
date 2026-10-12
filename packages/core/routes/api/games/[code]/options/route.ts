import type { GameRouteContext } from "../../../../../lib/binding"
import { gameOptions } from "../../../../../lib/settings"
import { loadSettings } from "../../../../../lib/settings-server"
import { ApiError, handle, readJson } from "../../../../../server/api"
import { publicGame, updateGame } from "../../../../../server/games"
import { getPlayerId } from "../../../../../server/player"
import { rateLimit } from "../../../../../server/rate-limit"

export const POST = handle(async (request: Request, { game, params }: GameRouteContext) => {
  await rateLimit(game.slug, request, "options")
  const id = await getPlayerId(game.slug)
  const settings = await loadSettings(game)
  const { options } = await readJson<{ options?: unknown }>(request)
  const row = await updateGame(game, params.code ?? "", (row) => {
    if (row.host_id !== id) throw new ApiError("HOST_ONLY", 403)
    if (row.status === "playing") throw new ApiError("GAME_IN_PROGRESS", 409)
    return { options: gameOptions(game.binding, settings.options, { ...row.options, ...(options as object) }, { playerCount: row.players.length }) }
  })
  return publicGame(game, row, id)
})
