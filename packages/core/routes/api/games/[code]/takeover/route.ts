import { GAME } from "@pgo/binding"
import type { NextRequest } from "next/server"
import { loadSettings } from "../../../../../lib/settings-server"
import { ApiError, handle } from "../../../../../server/api"
import { getPlayerId } from "../../../../../server/player"
import { publicGame, updateGame } from "../../../../../server/games"

/**
 * Joue le tour d'un joueur absent : réservé aux autres membres, et seulement si la partie n'a pas bougé depuis le délai réglé dans l'admin (Mechanics).
 * Utilise `GAME.autoPlay`, sinon `GAME.debug.turn`.
 */
export const POST = handle(async (_request: NextRequest, ctx: { params: Promise<{ code: string }> }) => {
  const { code } = await ctx.params
  const id = await getPlayerId()
  const { turnTimeout } = await loadSettings()
  const play = GAME.autoPlay ?? GAME.debug?.turn
  if (!play || !GAME.activePlayer) throw new ApiError("TAKEOVER_UNSUPPORTED", 400)
  const row = await updateGame(code, (game) => {
    if (!id || !game.players.some((p) => p.id === id)) throw new ApiError("UNKNOWN_PLAYER", 403)
    if (game.status !== "playing" || !game.state) throw new ApiError("GAME_NOT_STARTED", 409)
    const active = GAME.activePlayer!(game.state)
    if (!active || active === id) throw new ApiError("NOT_STALLED", 409)
    const idle = (Date.now() - new Date(game.updated_at ?? 0).getTime()) / 1000
    if (idle < turnTimeout - 2) throw new ApiError("NOT_STALLED", 409)
    const state = play(game.state)
    return { state, status: GAME.isOver(state) ? "over" : "playing" }
  })
  return publicGame(row, id)
})
