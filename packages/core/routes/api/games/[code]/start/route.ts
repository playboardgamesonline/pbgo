import type { GameRouteContext } from "../../../../../lib/binding"
import { loadSettings } from "../../../../../lib/settings-server"
import { ApiError, handle } from "../../../../../server/api"
import { loadSetupData, newGame, publicGame, readGame, settleReadyCheck, updateGame } from "../../../../../server/games"
import { getPlayerId } from "../../../../../server/player"
import { rateLimit } from "../../../../../server/rate-limit"
import { startingPatch } from "../../../../../server/ready"

/**
 * The host starts the table: the game is set up with the players seated now and the table is `starting`, for the players to come to its board, which loads behind the platform's start screen and says when it is (`POST …/ready`). `game_started` is sent when the last of them has.
 * A table whose last ready check ran out of time is back in the lobby before this looks at it, so the host can start again.
 */
export const POST = handle(async (request: Request, { game, params }: GameRouteContext) => {
  await rateLimit(game.slug, request, "start")
  const code = params.code ?? ""
  const id = await getPlayerId(game.slug)
  const { minPlayers } = await loadSettings(game)
  const data = await loadSetupData(game, (await settleReadyCheck(game, await readGame(game, code))).options)
  const row = await updateGame(game, code, (row) => {
    if (row.host_id !== id) throw new ApiError("HOST_ONLY", 403)
    if (row.status !== "lobby") throw new ApiError("GAME_IN_PROGRESS", 409)
    if (row.players.length < minPlayers) throw new ApiError("NOT_ENOUGH_PLAYERS")
    return startingPatch(newGame(game, row, data), Date.now())
  })
  return publicGame(game, row, id)
})
