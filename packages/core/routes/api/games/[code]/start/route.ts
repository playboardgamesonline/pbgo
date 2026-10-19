import type { GameRouteContext } from "../../../../../lib/binding"
import { loadSettings } from "../../../../../lib/settings-server"
import { trackAfter } from "../../../../../server/analytics"
import { ApiError, handle } from "../../../../../server/api"
import { loadSetupData, newGame, publicGame, readGame, updateGame } from "../../../../../server/games"
import { getPlayerId } from "../../../../../server/player"
import { rateLimit } from "../../../../../server/rate-limit"

export const POST = handle(async (request: Request, { game, params }: GameRouteContext) => {
  await rateLimit(game.slug, request, "start")
  const code = params.code ?? ""
  const id = await getPlayerId(game.slug)
  const { minPlayers } = await loadSettings(game)
  const data = await loadSetupData(game, (await readGame(game, code)).options)
  const row = await updateGame(game, code, (row) => {
    if (row.host_id !== id) throw new ApiError("HOST_ONLY", 403)
    if (row.status !== "lobby") throw new ApiError("GAME_IN_PROGRESS", 409)
    if (row.players.length < minPlayers) throw new ApiError("NOT_ENOUGH_PLAYERS")
    return newGame(game, row, data)
  })
  trackAfter("game_started", id, { game: game.slug, players: row.players.length, options: row.options })
  return publicGame(game, row, id)
})
