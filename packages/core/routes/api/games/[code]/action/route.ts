import { type Action, GAME } from "@pbgo/binding"
import type { NextRequest } from "next/server"
import { ApiError, handle, readJson } from "../../../../../server/api"
import { getPlayerId } from "../../../../../server/player"
import { updateGame, publicGame } from "../../../../../server/games"

export const POST = handle(async (request: NextRequest, ctx: { params: Promise<{ code: string }> }) => {
  const { code } = await ctx.params
  const id = await getPlayerId()
  if (!id) throw new ApiError("UNKNOWN_PLAYER", 401)
  const action = await readJson<{ type?: string }>(request)
  if (!action.type || !(GAME.clientActions as readonly string[]).includes(action.type)) throw new ApiError("INVALID_ACTION")

  const row = await updateGame(code, (game) => {
    if (!game.state || game.status !== "playing") throw new ApiError("GAME_NOT_STARTED", 409)
    const state = GAME.apply(game.state, { ...action, playerId: id } as Action)
    return { state, status: GAME.isOver(state) ? "over" : "playing" }
  })
  return publicGame(row, id)
})
