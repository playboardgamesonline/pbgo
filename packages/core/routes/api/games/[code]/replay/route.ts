import type { GameRouteContext } from "../../../../../lib/binding"
import { ApiError, handle } from "../../../../../server/api"
import { loadSetupData, newGame, publicGame, readGame, updateGame } from "../../../../../server/games"
import { getPlayerId } from "../../../../../server/player"
import { rateLimit } from "../../../../../server/rate-limit"

export const POST = handle(async (request: Request, { game, params }: GameRouteContext) => {
  await rateLimit(game.slug, request, "replay")
  const code = params.code ?? ""
  const id = await getPlayerId(game.slug)
  const data = await loadSetupData(game, (await readGame(game, code)).options)
  const row = await updateGame(game, code, (row) => {
    if (row.status !== "over") throw new ApiError("GAME_NOT_OVER", 409)
    if (!id || !row.players.some((j) => j.id === id)) throw new ApiError("UNKNOWN_PLAYER", 403)
    if (row.replay.includes(id)) return null
    const replay = [...row.replay, id]
    if (replay.length < row.players.length) return { replay }
    return newGame(game, row, data)
  })
  return publicGame(game, row, id)
})
