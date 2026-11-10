import { after } from "next/server"
import type { AgeRulesSource } from "../../../../../lib/age-rules"
import type { GameRouteContext } from "../../../../../lib/binding"
import { loadSettings } from "../../../../../lib/settings-server"
import { ageGateFor } from "../../../../../server/age-gate"
import { trackAfter } from "../../../../../server/analytics"
import { ApiError, handle, readJson } from "../../../../../server/api"
import { servedGame, updateGame } from "../../../../../server/games"
import { getOrCreatePlayerId } from "../../../../../server/player"
import { seatMember } from "../../../../../server/presence"
import { type ProfileInput, resolveSeat } from "../../../../../server/profile"
import { rateLimit } from "../../../../../server/rate-limit"

/**
 * `POST /api/<slug>/games/<code>/join`: sits somebody down at a table that waits. `ageRules` is where the age that the game and its expansions ask comes from (the app hands it in): a table that asks for an age, by its game or by an expansion it
 * is played with, is not sat at by somebody who does not have it (`server/age-gate.ts`, PLT-125).
 */
export const postJoin = (ageRules: AgeRulesSource) =>
  handle(async (request: Request, { game, params }: GameRouteContext) => {
    await rateLimit(game.slug, request, "join")
    const seat = await resolveSeat(await readJson<ProfileInput>(request))
    const { profile, memberId } = seat
    const id = await getOrCreatePlayerId(game.slug)
    const { maxPlayers } = await loadSettings(game)
    const gate = await ageGateFor(ageRules, game, seat)

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
      if (row.players.length >= maxPlayers) throw new ApiError("GAME_FULL", 409)
      joined.added = true
      // A lobby that a ready check emptied has no host: whoever sits down first is it
      return { players: [...row.players, { id, ...profile }], ...(row.players.length === 0 ? { host_id: id } : {}) }
    })
    // A member's seat says whose it is, for the players online: apart from the table the others see, and after the response. A game that has an age to ask is the exception: the host may switch an expansion for adults on at any moment, and that check
    // reads who sits where, so the seat is written first
    if (gate.restricted) await seatMember(game, row.code, id, memberId)
    else after(() => seatMember(game, row.code, id, memberId))
    if (joined.added) trackAfter("player_joined", id, { game: game.slug, seat: row.players.findIndex((j) => j.id === id), players: row.players.length })
    return servedGame(game, row, id)
  })
