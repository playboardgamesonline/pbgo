import { gameOptions } from "../../../lib/settings"
import { loadSettings } from "../../../lib/settings-server"
import { handle, readJson } from "../../../server/api"
import { getOrCreatePlayerId } from "../../../server/player"
import { rateLimit } from "../../../server/rate-limit"
import { createGame, publicGame } from "../../../server/games"
import { type ProfileInput, validateProfile } from "../../../server/profile"

export const POST = handle(async (request: Request) => {
  await rateLimit(request, "create")
  const profile = validateProfile(await readJson<ProfileInput>(request))
  const id = await getOrCreatePlayerId()
  const { options } = await loadSettings()
  const row = await createGame({ id, ...profile }, gameOptions(options))
  return publicGame(row, id)
})
