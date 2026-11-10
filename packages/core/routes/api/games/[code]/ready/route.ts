import { beginOf } from "@pbgo/engine-kit"
import { after } from "next/server"
import type { GameRouteContext } from "../../../../../lib/binding"
import { visibilityOf } from "../../../../../lib/table-settings"
import { trackAfter } from "../../../../../server/analytics"
import { ApiError, handle } from "../../../../../server/api"
import { servedGame, updateGame } from "../../../../../server/games"
import { getPlayerId } from "../../../../../server/player"
import { rateLimit } from "../../../../../server/rate-limit"
import { readyExpired, readyPatch, expirePatch } from "../../../../../server/ready"
import { markGameStarted } from "../../../../../server/results"
import { leaveOtherLobbies } from "../../../../../server/table-seat"
import { readTableSettingsOf } from "../../../../../server/table-settings"

/**
 * "I'm ready" (PLT-107): sent by a player's board once the player has pressed "I'm here" on the start screen and the board is loaded. Nothing sends it by itself: a player who does not press is not ready, and is unseated when the time is up. The last of them to say it begins the game, and the answer says so (`status` is `playing`). Saying it again, or saying it for a table that is
 * not in a ready check any more (it began without them, or went back to the lobby), changes nothing and answers with the table as it is, so the board shows where it stands. A player who is not at the table is refused. If the time was up
 * when the player said it, the check ends instead, as it would on any look at the table: the ones who were not ready are unseated and the table is back in the lobby. When the game begins, its players leave every other lobby where they sit
 * (`leaveOtherLobbies`).
 */
export const POST = handle(async (request: Request, { game, params }: GameRouteContext) => {
  await rateLimit(game.slug, request, "ready")
  const id = await getPlayerId(game.slug)

  // Set by the run of the modifier that the write came from: a write lost to a concurrent request runs it again
  const outcome = { began: false }
  const { GAME } = game.binding
  const row = await updateGame(game, params.code ?? "", (row) => {
    outcome.began = false
    if (!id || !row.players.some((player) => player.id === id)) throw new ApiError("UNKNOWN_PLAYER", 403)
    const now = Date.now()
    if (readyExpired(row, now)) return expirePatch(row)
    const patch = readyPatch(row, id, now)
    outcome.began = patch?.status === "playing"
    // The game is live from this moment: the clock of its first step, if it has one, starts now and not when the host started the table
    return patch && outcome.began && GAME.begin ? { ...patch, state: beginOf(GAME, row.state, now) } : patch
  })
  // The host is the one who started it, whoever was the last to be ready. Who may find the table is kept apart from it: it is read once, for the count, when the game begins
  if (outcome.began) {
    const kept = await readTableSettingsOf(game.slug, row.code)
    trackAfter("game_started", row.host_id, { game: game.slug, players: row.players.length, options: row.options, visibility: visibilityOf(kept) })
    after(() => markGameStarted(game, row))
    // The people who play leave the other lobbies where they sit: a player in a game cannot begin another, so they would only block them
    after(() => leaveOtherLobbies(game, row))
  }
  return servedGame(game, row, id)
})
