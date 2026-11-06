import { after } from "next/server"
import type { GameRouteContext } from "../../../../lib/binding"
import { handle } from "../../../../server/api"
import { publicGame, readGame, settleReadyCheck } from "../../../../server/games"
import { getPlayerId } from "../../../../server/player"
import { markSeen } from "../../../../server/presence"

export const GET = handle(async (_request: Request, { game, params }: GameRouteContext) => {
  // A ready check that ran out of time is ended by whoever looks first (every board polls this route)
  const row = await settleReadyCheck(game, await readGame(game, params.code ?? ""))
  const id = await getPlayerId(game.slug)
  // Every client reads its table every few seconds: that is what tells the takeover who is present
  after(() => markSeen(game, row, id))
  return publicGame(game, row, id)
})
