import type { GameRouteContext } from "../../../../../lib/binding"
import { trackAfter } from "../../../../../server/analytics"
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
  // `newGame` is the only way out of `over`: a repeated vote, or one still waiting for the others, leaves the table over
  if (row.status === "playing") trackAfter("rematch_started", id, { game: game.slug })
  return publicGame(game, row, id)
})
