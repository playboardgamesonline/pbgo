import { after } from "next/server"
import type { GameRouteContext } from "../../../lib/binding"
import { getLocale } from "../../../lib/locale-server"
import { gameOptions } from "../../../lib/settings"
import { loadSettings } from "../../../lib/settings-server"
import { trackAfter } from "../../../server/analytics"
import { handle, readJson } from "../../../server/api"
import { createGame, publicGame } from "../../../server/games"
import { getOrCreatePlayerId } from "../../../server/player"
import { seatMember } from "../../../server/presence"
import { type ProfileInput, resolveSeat } from "../../../server/profile"
import { rateLimit } from "../../../server/rate-limit"

export const POST = handle(async (request: Request, { game }: GameRouteContext) => {
  await rateLimit(game.slug, request, "create")
  const { profile, memberId } = await resolveSeat(await readJson<ProfileInput>(request))
  const id = await getOrCreatePlayerId(game.slug)
  const { options, maxPlayers } = await loadSettings(game)
  const row = await createGame(game, { id, ...profile }, gameOptions(game.binding, options))
  // A member's seat says whose it is, for the players online: apart from the table the others see, and after the response
  after(() => seatMember(game, row.code, id, memberId))
  trackAfter("game_created", id, { game: game.slug, options: row.options, max_players: maxPlayers, locale: await getLocale() })
  return publicGame(game, row, id)
})
