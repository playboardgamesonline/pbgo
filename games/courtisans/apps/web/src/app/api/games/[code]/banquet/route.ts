import { type GameState, startWithoutWaiting } from "@courtisans/engine"
import { loadSettings } from "@pbgo/core/lib/settings-server"
import { ApiError, handle } from "@pbgo/core/server/api"
import { publicGame, takeoverEntry, takeoverVotes, updateGame } from "@pbgo/core/server/games"
import { getPlayerId } from "@pbgo/core/server/player"
import { rateLimit } from "@pbgo/core/server/rate-limit"
import type { NextRequest } from "next/server"

/**
 * Lance le banquet sans attendre les joueurs qui n'ont pas validé leurs missions : vote de TOUS les joueurs déjà prêts (unanimité),
 * et seulement si la partie n'a pas bougé depuis le délai réglé dans l'admin (le même que pour un joueur absent).
 * Chaque appel enregistre le vote de l'appelant (colonne `takeover_votes`, périmée dès qu'un joueur valide à son tour) ;
 * le dernier vote lance le banquet, les retardataires étant comptés comme ayant lu.
 */
export const POST = handle(async (request: NextRequest, ctx: { params: Promise<{ code: string }> }) => {
  await rateLimit(request, "vote")
  const { code } = await ctx.params
  const id = await getPlayerId()
  const { turnTimeout } = await loadSettings()
  const row = await updateGame(
    code,
    (game) => {
      if (!id || !game.players.some((p) => p.id === id)) throw new ApiError("UNKNOWN_PLAYER", 403)
      if (game.status !== "playing" || !game.state) throw new ApiError("GAME_NOT_STARTED", 409)
      const state = game.state as GameState
      // le banquet a déjà commencé (le dernier joueur vient de valider) : ce vote n'a plus d'objet
      if (state.phase !== "missions") return null
      if (!state.players.find((p) => p.id === id)?.missionsRead) throw new ApiError("NOT_READY", 403)
      const idle = (Date.now() - new Date(game.updated_at ?? 0).getTime()) / 1000
      if (idle < turnTimeout - 2) throw new ApiError("NOT_STALLED", 409)

      const votes = new Set(takeoverVotes(game))
      if (votes.has(id)) return null
      votes.add(id)
      const ready = state.players.filter((p) => p.missionsRead)
      if (!ready.every((p) => votes.has(p.id))) return { takeover_votes: [...votes].map((p) => takeoverEntry(state, p)) }
      return { state: startWithoutWaiting(state), status: "playing", takeover_votes: [] }
    },
    { quiet: true },
  )
  return publicGame(row, id)
})
