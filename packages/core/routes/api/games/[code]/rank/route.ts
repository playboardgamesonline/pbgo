import { getAccount } from "@pbgo/accounts/server"
import type { GameRouteContext } from "../../../../../lib/binding"
import { NO_RANK_CHANGE, type RankChange } from "../../../../../lib/rank-change"
import { handle } from "../../../../../server/api"
import { readGame } from "../../../../../server/games"
import { getPlayerId } from "../../../../../server/player"
import { readRankChange, readStartedAt } from "../../../../../server/rank-change"
import { rateLimit } from "../../../../../server/rate-limit"
import { isSeated } from "../../../../../server/table-rules"

/**
 * `GET /api/<slug>/games/<code>/rank`: what the game that has just ended at this table did to the rank points of the member who asks, for the end screen (`RankChange`). The game is written down a moment after the request that ended it, so
 * `recorded` is false until then and the screen asks again. Nothing is known of a table that is not over, of a visitor who does not sit at it, and of one with no account to rate (a guest): the answer is the same for all of them, so that it says
 * nothing about the table. The rating is never in it, only the points.
 */
export const GET = handle(async (request: Request, { game, params }: GameRouteContext): Promise<RankChange> => {
  await rateLimit(game.slug, request, "rank")
  const id = await getPlayerId(game.slug)
  const row = await readGame(game, params.code ?? "")
  if (row.status !== "over" || !isSeated(row, id) || !row.created_at) return NO_RANK_CHANGE
  const account = await getAccount()
  if (!account) return NO_RANK_CHANGE
  return readRankChange({ game: game.slug, userId: account.id, tableCreatedAt: row.created_at, startedAt: await readStartedAt(game.slug, row.code) })
})
