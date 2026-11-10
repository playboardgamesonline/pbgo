import { after } from "next/server"
import type { AgeRulesSource } from "../../../lib/age-rules"
import type { GameRouteContext } from "../../../lib/binding"
import { getLocale } from "../../../lib/locale-server"
import { gameOptions } from "../../../lib/settings"
import { loadSettings } from "../../../lib/settings-server"
import { checkTableSettings } from "../../../lib/table-settings"
import { ageGateFor } from "../../../server/age-gate"
import { trackAfter } from "../../../server/analytics"
import { ApiError, handle, readJson } from "../../../server/api"
import { createGame, publicGame } from "../../../server/games"
import { getOrCreatePlayerId } from "../../../server/player"
import { seatMember } from "../../../server/presence"
import { type ProfileInput, resolveSeat } from "../../../server/profile"
import { rateLimit } from "../../../server/rate-limit"

/**
 * `POST /api/<slug>/games`: opens a table. `ageRules` is where the age that the game and its expansions ask comes from (the app hands it in: core cannot read the hub's catalog): a table that asks for an age is opened only by somebody who has it,
 * and the check runs before anything is written (`server/age-gate.ts`, PLT-125). The body may carry `settings`, what the host chose before the table existed (who may join, the speed, the seats: `checkTableSettings`, PLT-21): they are checked
 * before anything is written too, and kept with the table, so that a table opened public is listed from its first moment.
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
    const tableOptions = gameOptions(game.binding, options)
    const gate = await ageGateFor(ageRules, game, seat)
    gate.assertMay(gate.tableAge(tableOptions))
    const row = await createGame(game, { id, ...profile }, tableOptions, { settings: checked?.settings })
    // A member's seat says whose it is, for the players online: apart from the table the others see, and after the response. A table that asks for an age is the exception: the check of its next change reads who sits where, so the seat is written first
    if (gate.restricted) await seatMember(game, row.code, id, memberId)
    else after(() => seatMember(game, row.code, id, memberId))
    trackAfter("game_created", id, { game: game.slug, options: row.options, max_players: maxPlayers, locale: await getLocale() })
    return publicGame(game, row, id)
  })
