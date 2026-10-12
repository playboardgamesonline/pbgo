import type { GameRouteContext } from "../../../../../lib/binding"
import { handle } from "../../../../../server/api"
import { publicGame, updateGame } from "../../../../../server/games"
import { getPlayerId } from "../../../../../server/player"
import { rateLimit } from "../../../../../server/rate-limit"

export const POST = handle(async (request: Request, { game, params }: GameRouteContext) => {
  await rateLimit(game.slug, request, "leave")
  const id = await getPlayerId(game.slug)
  const row = await updateGame(game, params.code ?? "", (row) => {
    if (row.status !== "lobby" || !row.players.some((j) => j.id === id)) return null
    const players = row.players.filter((j) => j.id !== id)
    const host_id = row.host_id === id ? (players[0]?.id ?? row.host_id) : row.host_id
    return { players, host_id }
  })
  return publicGame(game, row, id)
})
