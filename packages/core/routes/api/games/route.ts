import { handle, readJson } from "../../../server/api"
import { getOrCreatePlayerId } from "../../../server/player"
import { createGame, publicGame } from "../../../server/games"
import { type ProfileInput, validateProfile } from "../../../server/profile"

export const POST = handle(async (request: Request) => {
  const profile = validateProfile(await readJson<ProfileInput>(request))
  const id = await getOrCreatePlayerId()
  const row = await createGame({ id, ...profile })
  return publicGame(row, id)
})
