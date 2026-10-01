import type { NextRequest } from "next/server"
import { ApiError, handle } from "../../../../../server/api"
import { getPlayerId } from "../../../../../server/player"
import { loadSetupData, readGame, updateGame, newGame, publicGame, replayVotes } from "../../../../../server/games"

export const POST = handle(async (_request: NextRequest, ctx: { params: Promise<{ code: string }> }) => {
  const { code } = await ctx.params
  const id = await getPlayerId()
  const data = await loadSetupData((await readGame(code)).options)
  const row = await updateGame(code, (game) => {
    if (game.status !== "over") throw new ApiError("GAME_NOT_OVER", 409)
    if (!id || !game.players.some((j) => j.id === id)) throw new ApiError("UNKNOWN_PLAYER", 403)
    const votes = replayVotes(game)
    if (votes.includes(id)) return null
    const replay = [...votes, id]
    if (replay.length < game.players.length) return { replay }
    return newGame(game, data)
  })
  return publicGame(row, id)
})
