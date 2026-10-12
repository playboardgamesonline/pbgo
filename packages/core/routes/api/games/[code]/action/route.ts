import { after } from "next/server"
import type { GameRouteContext } from "../../../../../lib/binding"
import { ApiError, handle, readJson } from "../../../../../server/api"
import { publicGame, updateGame } from "../../../../../server/games"
import { getPlayerId } from "../../../../../server/player"
import { markSeen } from "../../../../../server/presence"
import { rateLimit } from "../../../../../server/rate-limit"

export const POST = handle(async (request: Request, { game, params }: GameRouteContext) => {
  await rateLimit(game.slug, request, "action")
  const { GAME } = game.binding
  const id = await getPlayerId(game.slug)
  if (!id) throw new ApiError("UNKNOWN_PLAYER", 401)
  const action = await readJson<{ type?: string }>(request)
  if (!action.type || !(GAME.clientActions as readonly string[]).includes(action.type)) throw new ApiError("INVALID_ACTION")

  const row = await updateGame(game, params.code ?? "", (row) => {
    if (!row.state || row.status !== "playing") throw new ApiError("GAME_NOT_STARTED", 409)
    const state = GAME.apply(row.state, { ...action, playerId: id })
    return { state, status: GAME.isOver(state) ? "over" : "playing" }
  })
  after(() => markSeen(game, row, id))
  return publicGame(game, row, id)
})
