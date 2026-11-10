import type { GameRouteContext } from "../../../../../lib/binding"
import { handle } from "../../../../../server/api"
import { readGame, servedGame } from "../../../../../server/games"
import { getPlayerId } from "../../../../../server/player"
import { rateLimit } from "../../../../../server/rate-limit"
import { settleTable } from "../../../../../server/settle"

/**
 * The countdown of the table's deadline came to 0 on a board (`PublicGame.deadlineInMs`): the deadline is played if the server's clock says it has passed, and the answer is the table as it stands, so the board shows what the clock did. It
 * carries nothing: a client cannot say that time has passed, it can only ask the server to look, and a table with no deadline due costs no write. Several boards send it at once and the write carries the version, so one plays it and the others find
 * it played. A table that is not in play answers as it is. The read every board polls does the same, so a board that never sends it is moved on within a few seconds.
 */
export const POST = handle(async (request: Request, { game, params }: GameRouteContext) => {
  await rateLimit(game.slug, request, "tick")
  const id = await getPlayerId(game.slug)
  const row = await settleTable(game, await readGame(game, params.code ?? ""))
  return servedGame(game, row, id)
})
