import { after } from "next/server"
import type { AgeRulesSource } from "../../../../../lib/age-rules"
import type { GameRouteContext } from "../../../../../lib/binding"
import { loadSettings } from "../../../../../lib/settings-server"
import { asksSomething, unmetCriteria, UNMET_CODES } from "../../../../../lib/table-settings"
import { ageGateFor } from "../../../../../server/age-gate"
import { trackAfter } from "../../../../../server/analytics"
import { ApiError, handle, readJson } from "../../../../../server/api"
import { normalizeCode } from "../../../../../server/code"
import { publicGame, updateGame } from "../../../../../server/games"
import { getOrCreatePlayerId } from "../../../../../server/player"
import { seatMember } from "../../../../../server/presence"
import { type ProfileInput, resolveSeat } from "../../../../../server/profile"
import { rateLimit } from "../../../../../server/rate-limit"
import { readTableSettingsOf, viewerFor } from "../../../../../server/table-settings"

/**
 * `POST /api/<slug>/games/<code>/join`: sits somebody down at a table that waits. `ageRules` is where the age that the game and its expansions ask comes from (the app hands it in): a table that asks for an age, by its game or by an expansion it
 * is played with, is not sat at by somebody who does not have it (`server/age-gate.ts`, PLT-125). A public table may ask for a minimum rank and a language, and a table may have been set for fewer seats than the game takes (`TableSettings`, PLT-21):
 * somebody who does not meet what it asks is refused (403 `RANK_TOO_LOW`, `LANGUAGE_MISMATCH`), and a table whose seats are all taken is full (409 `GAME_FULL`); a player who sits already is never asked again.
 */
export const postJoin = (ageRules: AgeRulesSource) =>
  handle(async (request: Request, { game, params }: GameRouteContext) => {
    await rateLimit(game.slug, request, "join")
    const seat = await resolveSeat(await readJson<ProfileInput>(request))
    const { profile, memberId } = seat
    const id = await getOrCreatePlayerId(game.slug)
    const { maxPlayers } = await loadSettings(game)
    const gate = await ageGateFor(ageRules, game, seat)
    // What the host set for the table: its seats, and the rank and the language it asks of a public table. Who the visitor is for those is looked up only when it asks for something
    const settings = await readTableSettingsOf(game.slug, normalizeCode(params.code ?? ""))
    const viewer = asksSomething(settings) ? await viewerFor(game.slug, memberId, settings) : null

    // Set by the run of the modifier that the write came from: renaming oneself in the lobby is not a join
    const joined = { added: false }
    const row = await updateGame(game, params.code ?? "", (row) => {
      // Before anything else, and on the table as it is when the write lands: the host may have switched an expansion for adults on since the page was drawn
      gate.assertMay(gate.tableAge(row.options))
      joined.added = false
      const existing = row.players.find((j) => j.id === id)
      if (existing) {
        if (row.status !== "lobby") return null
        return { players: row.players.map((j) => (j.id === id ? { id, ...profile } : j)) }
      }
      if (row.status !== "lobby") throw new ApiError("GAME_IN_PROGRESS", 409)
      const unmet = viewer ? unmetCriteria(settings, viewer) : null
      if (unmet) throw new ApiError(UNMET_CODES[unmet], 403)
      if (row.players.length >= Math.min(maxPlayers, settings.seats ?? maxPlayers)) throw new ApiError("GAME_FULL", 409)
      joined.added = true
      // A lobby that a ready check emptied has no host: whoever sits down first is it
      return { players: [...row.players, { id, ...profile }], ...(row.players.length === 0 ? { host_id: id } : {}) }
    })
    // A member's seat says whose it is, for the players online: apart from the table the others see, and after the response. A game that has an age to ask is the exception: the host may switch an expansion for adults on at any moment, and that check
    // reads who sits where, so the seat is written first
    if (gate.restricted) await seatMember(game, row.code, id, memberId)
    else after(() => seatMember(game, row.code, id, memberId))
    if (joined.added) trackAfter("player_joined", id, { game: game.slug, seat: row.players.findIndex((j) => j.id === id), players: row.players.length })
    return publicGame(game, row, id)
  })
