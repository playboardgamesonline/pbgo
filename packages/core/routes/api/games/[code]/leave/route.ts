import type { NextRequest } from "next/server"
import { handle } from "../../../../../server/api"
import { getPlayerId } from "../../../../../server/player"
import { rateLimit } from "../../../../../server/rate-limit"
import { updateGame, publicGame } from "../../../../../server/games"

export const POST = handle(async (request: NextRequest, ctx: { params: Promise<{ code: string }> }) => {
  await rateLimit(request, "leave")
  const { code } = await ctx.params
  const id = await getPlayerId()
  const row = await updateGame(code, (game) => {
    if (game.status !== "lobby" || !game.players.some((j) => j.id === id)) return null
    const players = game.players.filter((j) => j.id !== id)
    const host_id = game.host_id === id ? (players[0]?.id ?? game.host_id) : game.host_id
    return { players, host_id }
  })
  return publicGame(row, id)
})
