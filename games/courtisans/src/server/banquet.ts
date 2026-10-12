import "server-only"
import { type GameState, startWithoutWaiting } from "@courtisans/engine"
import type { GameRouteContext } from "@pbgo/core/lib/binding"
import { loadSettings } from "@pbgo/core/lib/settings-server"
import { ApiError, handle } from "@pbgo/core/server/api"
import { publicGame, takeoverEntry, takeoverVotes, updateGame } from "@pbgo/core/server/games"
import { getPlayerId } from "@pbgo/core/server/player"
import { rateLimit } from "@pbgo/core/server/rate-limit"

/**
 * Starts the banquet without waiting for the players who have not confirmed their missions: unanimous vote of every player
 * already ready, and only when the game has not moved for the delay set in the admin (the same as for an absent player).
 * Each call records the caller's vote (`takeover_votes` column, stale as soon as a player confirms); the last vote starts
 * the banquet, latecomers counted as having read. Served at `POST /api/courtisans/games/<code>/banquet`.
 */
export const banquet = handle(async (request: Request, { game, params }: GameRouteContext) => {
  await rateLimit(game.slug, request, "vote")
  const id = await getPlayerId(game.slug)
  const { turnTimeout } = await loadSettings(game)
  const row = await updateGame(
    game,
    params.code ?? "",
    (row) => {
      if (!id || !row.players.some((p) => p.id === id)) throw new ApiError("UNKNOWN_PLAYER", 403)
      if (row.status !== "playing" || !row.state) throw new ApiError("GAME_NOT_STARTED", 409)
      const state = row.state as GameState
      // the banquet has already started (the last player just confirmed): this vote has no object anymore
      if (state.phase !== "missions") return null
      if (!state.players.find((p) => p.id === id)?.missionsRead) throw new ApiError("NOT_READY", 403)
      const idle = (Date.now() - new Date(row.updated_at ?? 0).getTime()) / 1000
      if (idle < turnTimeout - 2) throw new ApiError("NOT_STALLED", 409)

      const votes = new Set(takeoverVotes(row))
      if (votes.has(id)) return null
      votes.add(id)
      const ready = state.players.filter((p) => p.missionsRead)
      if (!ready.every((p) => votes.has(p.id))) return { takeover_votes: [...votes].map((p) => takeoverEntry(state, p)) }
      return { state: startWithoutWaiting(state), status: "playing", takeover_votes: [] }
    },
    { quiet: true },
  )
  return publicGame(game, row, id)
})
