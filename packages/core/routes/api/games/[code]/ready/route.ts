import type { GameRouteContext } from "../../../../../lib/binding"
import { trackAfter } from "../../../../../server/analytics"
import { ApiError, handle } from "../../../../../server/api"
import { publicGame, updateGame } from "../../../../../server/games"
import { getPlayerId } from "../../../../../server/player"
import { rateLimit } from "../../../../../server/rate-limit"
import { readyExpired, readyPatch, expirePatch } from "../../../../../server/ready"

/**
 * "I'm ready" (PLT-107): sent by a player's board by itself once it is loaded, no click. The last of them to say it begins the game, and the answer says so (`status` is `playing`). Saying it again, or saying it for a table that is
 * not in a ready check any more (it began without them, or went back to the lobby), changes nothing and answers with the table as it is, so the board shows where it stands. A player who is not at the table is refused. If the time was up
 * when the player said it, the check ends instead, as it would on any look at the table: the ones who were not ready are unseated and the table is back in the lobby.
 */
export const POST = handle(async (request: Request, { game, params }: GameRouteContext) => {
  await rateLimit(game.slug, request, "ready")
  const id = await getPlayerId(game.slug)

  // Set by the run of the modifier that the write came from: a write lost to a concurrent request runs it again
  const outcome = { began: false }
  const row = await updateGame(game, params.code ?? "", (row) => {
    outcome.began = false
    if (!id || !row.players.some((player) => player.id === id)) throw new ApiError("UNKNOWN_PLAYER", 403)
    const now = Date.now()
    if (readyExpired(row, now)) return expirePatch(row)
    const patch = readyPatch(row, id, now)
    outcome.began = patch?.status === "playing"
    return patch
  })
  // The host is the one who started it, whoever was the last to be ready
  if (outcome.began) trackAfter("game_started", row.host_id, { game: game.slug, players: row.players.length, options: row.options })
  return publicGame(game, row, id)
})
