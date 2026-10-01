import { GAME } from "@pbgo/binding"
import type { NextRequest } from "next/server"
import { loadSettings } from "../../../../../lib/settings-server"
import { ApiError, handle } from "../../../../../server/api"
import { getPlayerId } from "../../../../../server/player"
import { publicGame, takeoverEntry, takeoverVotes, updateGame } from "../../../../../server/games"

/**
 * Joue le tour d'un joueur absent : vote de tous les autres membres (unanimité), et seulement si la partie n'a pas bougé depuis le délai réglé dans l'admin.
 * Chaque appel enregistre le vote de l'appelant ; le dernier vote déclenche le coup. Utilise `GAME.autoPlay`, sinon `GAME.debug.turn`.
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
    const votes = new Set(takeoverVotes(game))
    votes.add(id)
    const others = game.players.filter((p) => p.id !== active)
    if (!others.every((p) => votes.has(p.id))) {
      if (takeoverVotes(game).includes(id)) return null
      return { replay: [...game.replay, takeoverEntry(game.state, id)] }
    }
    const state = play(game.state)
    return { state, status: GAME.isOver(state) ? "over" : "playing", replay: game.replay.filter((v) => !v.startsWith("t:")) }
  }, { quiet: true })
  return publicGame(row, id)
})
