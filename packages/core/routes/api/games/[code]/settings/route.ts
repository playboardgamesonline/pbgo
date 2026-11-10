import type { GameRouteContext } from "../../../../../lib/binding"
import { checkTableSettings, isLocked } from "../../../../../lib/table-settings"
import { loadSettings } from "../../../../../lib/settings-server"
import { ApiError, handle, readJson } from "../../../../../server/api"
import { normalizeCode } from "../../../../../server/code"
import { isMissingColumn } from "../../../../../server/db-error"
import { publicGame, updateGame } from "../../../../../server/games"
import { getPlayerId } from "../../../../../server/player"
import { rateLimit } from "../../../../../server/rate-limit"
import { seatedPlayers } from "../../../../../server/table-rules"
import { readTableSettingsOf } from "../../../../../server/table-settings"

/**
 * `POST /api/<slug>/games/<code>/settings`: the host sets who may join the table (public, listed with the open tables of the game, or private, reached by its link, and for a public one the least rank and the language it asks of its players),
 * how fast it is played and how many seats it has (PLT-21, `games.settings`, migration 0014). The body is `{ settings }` with every setting at once (`TableSettingsInput`): what the panel shows is what is kept, and the server checks it
 * (`checkTableSettings`: 400 `INVALID_REQUEST`, and 400 `INVALID_PLAYERS` for a number of seats the game does not take or that is under the people who sit). Only the host sets it (403 `HOST_ONLY`) and only while the table waits
 * (409 `GAME_IN_PROGRESS`). The write is a version of the table like any other, so the people at it see it move (`TableSync`). A project where the migration is not applied yet answers 503 `SETTINGS_UNAVAILABLE`.
 * A ranked table is not changed: 403 `RANKED_TABLE_LOCKED`.
 */
export const POST = handle(async (request: Request, { game, params }: GameRouteContext) => {
  await rateLimit(game.slug, request, "settings")
  const id = await getPlayerId(game.slug)
  const { settings: input } = await readJson<{ settings?: unknown }>(request)
  const { minPlayers, maxPlayers } = await loadSettings(game)
  // A ranked table is fixed: it stays public, with the seats it opened with
  if (isLocked(await readTableSettingsOf(game.slug, normalizeCode(params.code ?? "")))) throw new ApiError("RANKED_TABLE_LOCKED", 403)
  try {
    const row = await updateGame(game, params.code ?? "", (row) => {
      if (row.host_id !== id) throw new ApiError("HOST_ONLY", 403)
      if (row.status !== "lobby") throw new ApiError("GAME_IN_PROGRESS", 409)
      const checked = checkTableSettings(input, { min: minPlayers, max: maxPlayers, seated: seatedPlayers(row.players).length })
      if (!checked.ok) throw new ApiError(checked.code)
      return { settings: checked.settings }
    })
    return publicGame(game, row, id)
  } catch (error) {
    // The write is the first thing that needs the column: a project where the migration is not applied says so
    if (isMissingColumn(error as { code?: string })) throw new ApiError("SETTINGS_UNAVAILABLE", 503)
    throw error
  }
})
