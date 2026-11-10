import type { AgeRulesSource } from "../../../../../lib/age-rules"
import type { GameRouteContext } from "../../../../../lib/binding"
import { loadSettings } from "../../../../../lib/settings-server"
import { ageGateFor } from "../../../../../server/age-gate"
import { ApiError, handle } from "../../../../../server/api"
import { loadSetupData, newGame, publicGame, readGame, settleReadyCheck, updateGame } from "../../../../../server/games"
import { getPlayerId } from "../../../../../server/player"
import { resolveActor } from "../../../../../server/profile"
import { rateLimit } from "../../../../../server/rate-limit"
import { startingPatch } from "../../../../../server/ready"
import { sameSeats } from "../../../../../server/table-rules"
import { busySeats } from "../../../../../server/tables"

/**
 * The host starts the table: the game is set up with the players seated now and the table is `starting`, for the players to come to its board, which loads behind the platform's start screen and says when it is (`POST …/ready`). `game_started` is sent when the last of them has.
 * A table whose last ready check ran out of time is back in the lobby before this looks at it, so the host can start again.
 * A table does not start while one of its players is in a game somewhere else (`PLAYER_BUSY`, PLT-120): who is, is asked of the database before the write, like the age, with the table as it was read; a table whose seats changed in between is not
 * started on that look (`CONFLICT`: the host presses again), so nobody who sat down meanwhile is let through unchecked. A look that cannot be had lets the table start.
 * `ageRules` is where the age that the game and its expansions ask comes from (the app hands it in): a table that asks for an age does not start with somebody seated who does not have it, the last look before the game begins (`server/age-gate.ts`, PLT-125).
 */
export const postStart = (ageRules: AgeRulesSource) =>
  handle(async (request: Request, { game, params }: GameRouteContext) => {
    await rateLimit(game.slug, request, "start")
    const code = params.code ?? ""
    const id = await getPlayerId(game.slug)
    const { minPlayers } = await loadSettings(game)
    const settled = await settleReadyCheck(game, await readGame(game, code))
    const data = await loadSetupData(game, settled.options)
    // Who sits at a table that asks for an age is looked up before the write, with the table as it was read: the modifier below cannot wait for the database. A table that asks for no age looks nobody up
    const gate = await ageGateFor(ageRules, game, await resolveActor())
    const seats = gate.tableAge(settled.options) !== null ? await gate.seatsOf(settled, id) : null
    const busy = settled.status === "lobby" ? await busySeats(game, code) : []
    const row = await updateGame(game, code, (row) => {
      if (row.host_id !== id) throw new ApiError("HOST_ONLY", 403)
      if (row.status !== "lobby") throw new ApiError("GAME_IN_PROGRESS", 409)
      if (row.players.length < minPlayers) throw new ApiError("NOT_ENOUGH_PLAYERS")
      gate.assertSeats(row, gate.tableAge(row.options), seats)
      if (!sameSeats(row.players, settled.players)) throw new ApiError("CONFLICT", 409)
      if (busy.length) throw new ApiError("PLAYER_BUSY", 409)
      return startingPatch(newGame(game, row, data), Date.now())
    })
    return publicGame(game, row, id)
  })
