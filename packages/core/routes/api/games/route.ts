import { after } from "next/server"
import type { AgeRulesSource } from "../../../lib/age-rules"
import type { GameRouteContext } from "../../../lib/binding"
import { getLocale } from "../../../lib/locale-server"
import { gameOptions } from "../../../lib/settings"
import { loadSettings } from "../../../lib/settings-server"
import { ageGateFor } from "../../../server/age-gate"
import { trackAfter } from "../../../server/analytics"
import { handle, readJson } from "../../../server/api"
import { createGame, publicGame } from "../../../server/games"
import { getOrCreatePlayerId } from "../../../server/player"
import { seatMember } from "../../../server/presence"
import { type ProfileInput, resolveSeat } from "../../../server/profile"
import { rateLimit } from "../../../server/rate-limit"

/**
 * `POST /api/<slug>/games`: opens a table. `ageRules` is where the age that the game and its expansions ask comes from (the app hands it in: core cannot read the hub's catalog): a table that asks for an age is opened only by somebody who has it,
 * and the check runs before anything is written (`server/age-gate.ts`, PLT-125).
 */
export const postGame = (ageRules: AgeRulesSource) =>
  handle(async (request: Request, { game }: GameRouteContext) => {
    await rateLimit(game.slug, request, "create")
    const seat = await resolveSeat(await readJson<ProfileInput>(request))
    const { profile, memberId } = seat
    const id = await getOrCreatePlayerId(game.slug)
    const { options, maxPlayers } = await loadSettings(game)
    // The options a table opens with are the admin's defaults: one of them may switch an expansion for adults on, and then the table is a table for adults
    const tableOptions = gameOptions(game.binding, options)
    const gate = await ageGateFor(ageRules, game, seat)
    gate.assertMay(gate.tableAge(tableOptions))
    const row = await createGame(game, { id, ...profile }, tableOptions)
    // A member's seat says whose it is, for the players online: apart from the table the others see, and after the response. A table that asks for an age is the exception: the check of its next change reads who sits where, so the seat is written first
    if (gate.restricted) await seatMember(game, row.code, id, memberId)
    else after(() => seatMember(game, row.code, id, memberId))
    trackAfter("game_created", id, { game: game.slug, options: row.options, max_players: maxPlayers, locale: await getLocale() })
    return publicGame(game, row, id)
  })
