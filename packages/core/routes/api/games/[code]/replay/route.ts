import { after } from "next/server"
import type { GameRouteContext } from "../../../../../lib/binding"
import { loadSettings } from "../../../../../lib/settings-server"
import { trackAfter } from "../../../../../server/analytics"
import { ApiError, handle } from "../../../../../server/api"
import { loadSetupData, newGame, publicGame, readGame, updateGame } from "../../../../../server/games"
import { getPlayerId } from "../../../../../server/player"
import { rateLimit } from "../../../../../server/rate-limit"
import { markGameStarted } from "../../../../../server/results"
import { isSeated, sameSeats, seatedPlayers } from "../../../../../server/table-rules"
import { busySeats } from "../../../../../server/tables"

/**
 * `POST /api/<slug>/games/<code>/replay`: the player votes for another game at the same table; it begins when every player who is still there has voted. A player who left the game (PLT-120) is not asked: the rematch is played by those who
 * stayed, and the table keeps only them. Like the start of a table it does not begin while one of those players is in a game somewhere else (`PLAYER_BUSY`), nor with fewer players than the game needs (`NOT_ENOUGH_PLAYERS`). Who is busy is
 * asked of the database before the write, with the table as it was read (the seats of a table that is over do not change, so a table that did is not started on that look: `CONFLICT`), and a look that cannot be had lets the rematch begin.
 */
export const POST = handle(async (request: Request, { game, params }: GameRouteContext) => {
  await rateLimit(game.slug, request, "replay")
  const code = params.code ?? ""
  const id = await getPlayerId(game.slug)
  const read = await readGame(game, code)
  const data = await loadSetupData(game, read.options)
  const { minPlayers } = await loadSettings(game)
  const busy = read.status === "over" ? await busySeats(game, code) : []
  const row = await updateGame(game, code, (row) => {
    if (row.status !== "over") throw new ApiError("GAME_NOT_OVER", 409)
    if (!id || !isSeated(row, id)) throw new ApiError("UNKNOWN_PLAYER", 403)
    if (row.replay.includes(id)) return null
    const replay = [...row.replay, id]
    const players = seatedPlayers(row.players)
    if (!players.every((player) => replay.includes(player.id))) return { replay }
    // This vote begins the rematch, with the players who stayed
    if (!sameSeats(row.players, read.players)) throw new ApiError("CONFLICT", 409)
    if (players.length < minPlayers) throw new ApiError("NOT_ENOUGH_PLAYERS")
    if (busy.length) throw new ApiError("PLAYER_BUSY", 409)
    const host_id = players.some((player) => player.id === row.host_id) ? row.host_id : players[0]!.id
    return { ...newGame(game, { ...row, players }, data), players, host_id }
  })
  // `newGame` is the only way out of `over`: a repeated vote, or one still waiting for the others, leaves the table over
  if (row.status === "playing") {
    trackAfter("rematch_started", id, { game: game.slug })
    after(() => markGameStarted(game, row))
  }
  return publicGame(game, row, id)
})
