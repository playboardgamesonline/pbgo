import { after } from "next/server"
import type { GameRouteContext } from "../../../../lib/binding"
import { handle } from "../../../../server/api"
import { publicGame, readGame } from "../../../../server/games"
import { getPlayerId } from "../../../../server/player"
import { markSeen } from "../../../../server/presence"

export const GET = handle(async (_request: Request, { game, params }: GameRouteContext) => {
  const row = await readGame(game, params.code ?? "")
  const id = await getPlayerId(game.slug)
  // Every client reads its table every few seconds: that is what tells the takeover who is present
  after(() => markSeen(game, row, id))
  return publicGame(game, row, id)
})
