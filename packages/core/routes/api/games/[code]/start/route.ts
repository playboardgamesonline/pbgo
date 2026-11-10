import type { AgeRulesSource } from "../../../../../lib/age-rules"
import type { GameRouteContext } from "../../../../../lib/binding"
import { handle } from "../../../../../server/api"
import { publicGame } from "../../../../../server/games"
import { getPlayerId } from "../../../../../server/player"
import { resolveActor } from "../../../../../server/profile"
import { rateLimit } from "../../../../../server/rate-limit"
import { beginTable } from "../../../../../server/table-seat"

/**
 * The host starts the table (`beginTable`): the game is set up with the players seated now and the table is `starting`, for the players to come to its board, which loads behind the platform's start screen and says when it is (`POST …/ready`). `game_started` is sent when the last of them has.
 * A table whose last ready check ran out of time is back in the lobby before this looks at it, so the host can start again. A ranked table is not started by its host before it is full (409 `RANKED_TABLE_NOT_FULL`).
 * A table does not start while one of its players is in a game somewhere else (`PLAYER_BUSY`, PLT-120): who is, is asked of the database before the write, like the age, with the table as it was read; a table whose seats changed in between is not
 * started on that look (`CONFLICT`: the host presses again), so nobody who sat down meanwhile is let through unchecked. A look that cannot be had lets the table start.
 * `ageRules` is where the age that the game and its expansions ask comes from (the app hands it in): a table that asks for an age does not start with somebody seated who does not have it, the last look before the game begins (`server/age-gate.ts`, PLT-125).
 */
export const postStart = (ageRules: AgeRulesSource) =>
  handle(async (request: Request, { game, params }: GameRouteContext) => {
    await rateLimit(game.slug, request, "start")
    const id = await getPlayerId(game.slug)
    const row = await beginTable(game, params.code ?? "", { ageRules, actor: await resolveActor(), self: id, byHost: true })
    return publicGame(game, row, id)
  })
