import type { GameRouteContext } from "../../../../../lib/binding"
import { loadSettings } from "../../../../../lib/settings-server"
import { ApiError, handle } from "../../../../../server/api"
import { publicGame, takeoverEntry, takeoverVotes, updateGame } from "../../../../../server/games"
import { getPlayerId } from "../../../../../server/player"
import { rateLimit } from "../../../../../server/rate-limit"

/**
 * Plays the turn of an absent player: every other member votes (unanimity), and only when the game has not moved for the
 * delay set in the admin. Each call records the caller's vote; the last vote plays the move, with `GAME.autoPlay`, else `GAME.debug.turn`.
 */
export const POST = handle(async (request: Request, { game, params }: GameRouteContext) => {
  await rateLimit(game.slug, request, "vote")
  const { GAME } = game.binding
  const id = await getPlayerId(game.slug)
  const { turnTimeout } = await loadSettings(game)
  const play = GAME.autoPlay ?? GAME.debug?.turn
  const activePlayer = GAME.activePlayer
  if (!play || !activePlayer) throw new ApiError("TAKEOVER_UNSUPPORTED", 400)
  const row = await updateGame(
    game,
    params.code ?? "",
    (row) => {
      if (!id || !row.players.some((p) => p.id === id)) throw new ApiError("UNKNOWN_PLAYER", 403)
      if (row.status !== "playing" || !row.state) throw new ApiError("GAME_NOT_STARTED", 409)
      const active = activePlayer(row.state)
      if (!active || active === id) throw new ApiError("NOT_STALLED", 409)
      const idle = (Date.now() - new Date(row.updated_at ?? 0).getTime()) / 1000
      if (idle < turnTimeout - 2) throw new ApiError("NOT_STALLED", 409)
      const votes = new Set(takeoverVotes(row))
      votes.add(id)
      const others = row.players.filter((p) => p.id !== active)
      if (!others.every((p) => votes.has(p.id))) {
        if (takeoverVotes(row).includes(id)) return null
        return { takeover_votes: [...(row.takeover_votes ?? []), takeoverEntry(row.state, id)] }
      }
      const state = play(row.state)
      return { state, status: GAME.isOver(state) ? "over" : "playing", takeover_votes: [] }
    },
    { quiet: true },
  )
  return publicGame(game, row, id)
})
