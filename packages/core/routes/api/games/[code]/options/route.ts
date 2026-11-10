import type { AgeRulesSource } from "../../../../../lib/age-rules"
import type { GameRouteContext } from "../../../../../lib/binding"
import { gameOptions } from "../../../../../lib/settings"
import { loadSettings } from "../../../../../lib/settings-server"
import { isLocked } from "../../../../../lib/table-settings"
import { ageGateFor } from "../../../../../server/age-gate"
import { ApiError, handle, readJson } from "../../../../../server/api"
import { normalizeCode } from "../../../../../server/code"
import { publicGame, readGame, updateGame, type GameRow } from "../../../../../server/games"
import { getPlayerId } from "../../../../../server/player"
import { resolveActor } from "../../../../../server/profile"
import { rateLimit } from "../../../../../server/rate-limit"
import { readTableSettingsOf } from "../../../../../server/table-settings"

/**
 * `POST /api/<slug>/games/<code>/options`: the host sets the options of the table (the speed, the expansions it is played with, the aids). `ageRules` is where the age that the game and its expansions ask comes from (the app hands it in): switching on an
 * expansion for adults makes the table a table for adults, which the host must have the age for and so must everybody already seated (`server/age-gate.ts`, PLT-125). Switching one off, or changing anything else, asks nothing.
 * A ranked table is not changed: 403 `RANKED_TABLE_LOCKED`.
 */
export const postOptions = (ageRules: AgeRulesSource) =>
  handle(async (request: Request, { game, params }: GameRouteContext) => {
    await rateLimit(game.slug, request, "options")
    const id = await getPlayerId(game.slug)
    const settings = await loadSettings(game)
    const { options } = await readJson<{ options?: unknown }>(request)
    const code = params.code ?? ""
    // A ranked table is fixed: its options (and so its helpers) are what the search opened it with
    if (isLocked(await readTableSettingsOf(game.slug, normalizeCode(code)))) throw new ApiError("RANKED_TABLE_LOCKED", 403)
    const gate = await ageGateFor(ageRules, game, await resolveActor())
    const merged = (row: Pick<GameRow, "options" | "players">) =>
      gameOptions(game.binding, settings.options, { ...row.options, ...(options as object) }, { playerCount: row.players.length })
    // When the options raise the age of the table, who sits at it besides the host is looked up before the write, with the table as it is read now: the modifier below cannot wait for the database. A game that asks for no age looks nobody up
    const read = gate.restricted ? await readGame(game, code) : null
    const seats = read && gate.raises(read.options, merged(read)) !== null ? await gate.seatsOf(read, id) : null
    const row = await updateGame(game, code, (row) => {
      if (row.host_id !== id) throw new ApiError("HOST_ONLY", 403)
      if (row.status === "starting" || row.status === "playing") throw new ApiError("GAME_IN_PROGRESS", 409)
      const next = merged(row)
      // The age of a table only goes up through here: then the host must have it, and so must everybody seated (one who sat down since the table was read throws a conflict, and the host asks again)
      const asked = gate.raises(row.options, next)
      if (asked !== null) {
        gate.assertMay(asked)
        gate.assertSeats(row, asked, seats)
      }
      return { options: next }
    })
    return publicGame(game, row, id)
  })
