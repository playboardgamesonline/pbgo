import { after } from "next/server"
import type { GameRouteContext } from "../../../../../lib/binding"
import { trackGameFinished } from "../../../../../server/analytics"
import { ApiError, handle, notPlaying, readJson } from "../../../../../server/api"
import { publicGame, updateGame } from "../../../../../server/games"
import { getPlayerId } from "../../../../../server/player"
import { markSeen } from "../../../../../server/presence"
import { rateLimit } from "../../../../../server/rate-limit"
import { recordGameResult } from "../../../../../server/results"
import { hasLeft, settleLeavers } from "../../../../../server/table-rules"

export const POST = handle(async (request: Request, { game, params }: GameRouteContext) => {
  await rateLimit(game.slug, request, "action")
  const { GAME } = game.binding
  const id = await getPlayerId(game.slug)
  if (!id) throw new ApiError("UNKNOWN_PLAYER", 401)
  const action = await readJson<{ type?: string }>(request)
  if (!action.type || !(GAME.clientActions as readonly string[]).includes(action.type)) throw new ApiError("INVALID_ACTION")

  const row = await updateGame(game, params.code ?? "", (row) => {
    if (!row.state || row.status !== "playing") throw notPlaying(row)
    // A player who left the game has no part in it any more (PLT-120)
    if (row.players.some((player) => player.id === id && hasLeft(player))) throw new ApiError("LEFT_GAME", 403)
    // The step that follows may be one that the game waits for from a player who left: the server plays it at once, so that the others are never kept waiting for a seat nobody is at
    const { state } = settleLeavers(GAME, GAME.apply(row.state, { ...action, playerId: id }), row.players)
    return { state, status: GAME.isOver(state) ? "over" : "playing" }
  })
  after(() => markSeen(game, row, id))
  // The modifier only runs on a table in play, so an `over` table is the one this move has just ended. Two moves that end the game together cannot both get here: the version check lets one write through, and the other
  // finds the table over and is refused (`GAME_OVER`), so the game is written down once
  if (row.status === "over") {
    trackGameFinished(game.slug, row, id)
    after(() => recordGameResult(game, row))
  }
  return publicGame(game, row, id)
})
