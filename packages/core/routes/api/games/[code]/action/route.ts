import { stepOf } from "@pbgo/engine-kit"
import { after } from "next/server"
import type { GameRouteContext } from "../../../../../lib/binding"
import { trackGameFinished } from "../../../../../server/analytics"
import { ApiError, handle, notPlaying, readJson } from "../../../../../server/api"
import { playDueSafely } from "../../../../../server/deadlines"
import { servedGame, updateGame } from "../../../../../server/games"
import { getPlayerId } from "../../../../../server/player"
import { markSeen } from "../../../../../server/presence"
import { rateLimit } from "../../../../../server/rate-limit"
import { markTakenOver, recordGameResult } from "../../../../../server/results"

export const POST = handle(async (request: Request, { game, params }: GameRouteContext) => {
  await rateLimit(game.slug, request, "action")
  const { GAME } = game.binding
  const id = await getPlayerId(game.slug)
  if (!id) throw new ApiError("UNKNOWN_PLAYER", 401)
  const action = await readJson<{ type?: string }>(request)
  if (!action.type || !(GAME.clientActions as readonly string[]).includes(action.type)) throw new ApiError("INVALID_ACTION")

  // Whom the clock played for in the write of the modifier's last run (it runs again when it loses a race)
  const outcome = { playedFor: [] as string[] }
  const row = await updateGame(game, params.code ?? "", (row) => {
    if (!row.state || row.status !== "playing") throw notPlaying(row)
    const now = Date.now()
    // What the clock owes the table comes first: a deadline that has passed is played before the move, which is then judged on the table as it stands. The server writes the time of the move, whatever the client sent
    const due = playDueSafely(GAME, row.state, now)
    outcome.playedFor = due.playedFor
    // A game that says what its moves did (`step`) has it written in the log of the table with the move; one that does not has nothing to write
    const { state, events } = stepOf(GAME, due.state, { ...action, playerId: id, at: now })
    const entries = [...due.events, ...events]
    return { state, status: GAME.isOver(state) ? "over" : "playing", ...(entries.length ? { log: { entries } } : {}) }
  })
  after(() => markSeen(game, row, id))
  // The players the clock played for count for no rating, as the players the others played for do
  if (outcome.playedFor.length) after(() => markTakenOver(game, row.code, outcome.playedFor))
  // The modifier only runs on a table in play, so an `over` table is the one this move has just ended. Two moves that end the game together cannot both get here: the version check lets one write through, and the other
  // finds the table over and is refused (`GAME_OVER`), so the game is written down once
  if (row.status === "over") {
    trackGameFinished(game.slug, row, id)
    after(() => (outcome.playedFor.length ? recordGameResult(game, row, { takenOver: outcome.playedFor }) : recordGameResult(game, row)))
  }
  return servedGame(game, row, id)
})
