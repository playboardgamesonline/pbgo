import { stepOf } from "@pbgo/engine-kit"
import { after } from "next/server"
import type { GameRouteContext } from "../../../../../lib/binding"
import { trackGameFinished } from "../../../../../server/analytics"
import { ApiError, handle, notPlaying, readJson } from "../../../../../server/api"
import { servedGame, updateGame } from "../../../../../server/games"
import { getPlayerId } from "../../../../../server/player"
import { markSeen } from "../../../../../server/presence"
import { rateLimit } from "../../../../../server/rate-limit"
import { recordGameResult } from "../../../../../server/results"

export const POST = handle(async (request: Request, { game, params }: GameRouteContext) => {
  await rateLimit(game.slug, request, "action")
  const { GAME } = game.binding
  const id = await getPlayerId(game.slug)
  if (!id) throw new ApiError("UNKNOWN_PLAYER", 401)
  const action = await readJson<{ type?: string }>(request)
  if (!action.type || !(GAME.clientActions as readonly string[]).includes(action.type)) throw new ApiError("INVALID_ACTION")

  const row = await updateGame(game, params.code ?? "", (row) => {
    if (!row.state || row.status !== "playing") throw notPlaying(row)
    // A game that says what its moves did (`step`) has it written in the log of the table with the move; one that does not has nothing to write
    const { state, events } = stepOf(GAME, row.state, { ...action, playerId: id })
    return { state, status: GAME.isOver(state) ? "over" : "playing", ...(events.length ? { log: { entries: events } } : {}) }
  })
  after(() => markSeen(game, row, id))
  // The modifier only runs on a table in play, so an `over` table is the one this move has just ended. Two moves that end the game together cannot both get here: the version check lets one write through, and the other
  // finds the table over and is refused (`GAME_OVER`), so the game is written down once
  if (row.status === "over") {
    trackGameFinished(game.slug, row, id)
    after(() => recordGameResult(game, row))
  }
  return servedGame(game, row, id)
})
