import type { NextRequest } from "next/server"
import { loadSettings } from "../../../../../lib/settings-server"
import { ApiError, handle, readJson } from "../../../../../server/api"
import { getOrCreatePlayerId } from "../../../../../server/player"
import { rateLimit } from "../../../../../server/rate-limit"
import { updateGame, publicGame } from "../../../../../server/games"
import { type ProfileInput, validateProfile } from "../../../../../server/profile"

export const POST = handle(async (request: NextRequest, ctx: { params: Promise<{ code: string }> }) => {
  await rateLimit(request, "join")
  const { code } = await ctx.params
  const profile = validateProfile(await readJson<ProfileInput>(request))
  const id = await getOrCreatePlayerId()
  const { maxPlayers } = await loadSettings()

  const row = await updateGame(code, (game) => {
    const existing = game.players.find((j) => j.id === id)
    if (existing) {
      if (game.status !== "lobby") return null
      return { players: game.players.map((j) => (j.id === id ? { id, ...profile } : j)) }
    }
    if (game.status !== "lobby") throw new ApiError("GAME_IN_PROGRESS", 409)
    if (game.players.length >= maxPlayers) throw new ApiError("GAME_FULL", 409)
    return { players: [...game.players, { id, ...profile }] }
  })
  return publicGame(row, id)
})
