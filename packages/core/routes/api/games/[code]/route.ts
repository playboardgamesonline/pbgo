import type { GameRouteContext } from "../../../../lib/binding"
import { handle } from "../../../../server/api"
import { publicGame, readGame } from "../../../../server/games"
import { getPlayerId } from "../../../../server/player"

export const GET = handle(async (_request: Request, { game, params }: GameRouteContext) => {
  return publicGame(game, await readGame(game, params.code ?? ""), await getPlayerId(game.slug))
})
