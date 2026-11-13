import type { AgeRulesSource } from "../../../lib/age-rules"
import type { GameRouteContext } from "../../../lib/binding"
import { gameOptions } from "../../../lib/settings"
import { loadSettings } from "../../../lib/settings-server"
import { checkTableSettings, defaultTableSettings } from "../../../lib/table-settings"
import { ageGateFor } from "../../../server/age-gate"
import { ApiError, handle, readJson } from "../../../server/api"
import { servedGame } from "../../../server/games"
import { getOrCreatePlayerId } from "../../../server/player"
import { type ProfileInput, resolveSeat } from "../../../server/profile"
import { rateLimit } from "../../../server/rate-limit"
import { openTable } from "../../../server/table-seat"

/**
 * `POST /api/<slug>/games`: opens a table (`openTable`). `ageRules` is where the age that the game and its expansions ask comes from (the app hands it in: core cannot read the hub's catalog): a table that asks for an age is opened only by somebody who has it,
 * and the check runs before anything is written (`server/age-gate.ts`, PLT-125). The body may carry `settings`, what the host chose before the table existed (who may join, the speed, the seats: `checkTableSettings`, PLT-21): they are checked
 * before anything is written too, and kept with the table, so that a table opened public is listed from its first moment. A body with no `settings` opens a private table of the usual speed with the median of the game's players for seats (`defaultTableSettings`).
 */
export const postGame = (ageRules: AgeRulesSource) =>
  handle(async (request: Request, { game }: GameRouteContext) => {
    await rateLimit(game.slug, request, "create")
    const body = await readJson<ProfileInput & { settings?: unknown }>(request)
    const seat = await resolveSeat(body)
    const { profile, memberId } = seat
    const id = await getOrCreatePlayerId(game.slug)
    const { options, minPlayers, maxPlayers } = await loadSettings(game)
    const checked = body.settings === undefined ? null : checkTableSettings(body.settings, { min: minPlayers, max: maxPlayers, seated: 1 })
    if (checked && !checked.ok) throw new ApiError(checked.code)
    // The options a table opens with are the admin's defaults: one of them may switch an expansion for adults on, and then the table is a table for adults
    const gate = await ageGateFor(ageRules, game, seat)
    const row = await openTable(game, { id, profile, memberId }, { gate, options: gameOptions(game.binding, options), settings: checked?.settings ?? defaultTableSettings({ min: minPlayers, max: maxPlayers }), maxPlayers })
    return servedGame(game, row, id)
  })
