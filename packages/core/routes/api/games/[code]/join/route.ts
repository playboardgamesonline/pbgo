import type { GameRouteContext } from "../../../../../lib/binding"
import { loadSettings } from "../../../../../lib/settings-server"
import { trackAfter } from "../../../../../server/analytics"
import { ApiError, handle, readJson } from "../../../../../server/api"
import { publicGame, updateGame } from "../../../../../server/games"
import { getOrCreatePlayerId } from "../../../../../server/player"
import { type ProfileInput, validateProfile } from "../../../../../server/profile"
import { rateLimit } from "../../../../../server/rate-limit"

export const POST = handle(async (request: Request, { game, params }: GameRouteContext) => {
  await rateLimit(game.slug, request, "join")
  const profile = validateProfile(await readJson<ProfileInput>(request))
  const id = await getOrCreatePlayerId(game.slug)
  const { maxPlayers } = await loadSettings(game)

  // Set by the run of the modifier that the write came from: renaming oneself in the lobby is not a join
  const seat = { added: false }
  const row = await updateGame(game, params.code ?? "", (row) => {
    seat.added = false
    const existing = row.players.find((j) => j.id === id)
    if (existing) {
      if (row.status !== "lobby") return null
      return { players: row.players.map((j) => (j.id === id ? { id, ...profile } : j)) }
    }
    if (row.status !== "lobby") throw new ApiError("GAME_IN_PROGRESS", 409)
    if (row.players.length >= maxPlayers) throw new ApiError("GAME_FULL", 409)
    seat.added = true
    return { players: [...row.players, { id, ...profile }] }
  })
  if (seat.added) trackAfter("player_joined", id, { game: game.slug, seat: row.players.findIndex((j) => j.id === id), players: row.players.length })
  return publicGame(game, row, id)
})
