import { after } from "next/server"
import type { GameRouteContext } from "../../../../../lib/binding"
import { trackAfter, trackAnonymously, trackGameFinished } from "../../../../../server/analytics"
import { handle } from "../../../../../server/api"
import { deleteEmptyTable, publicGame, updateGame } from "../../../../../server/games"
import { getPlayerId } from "../../../../../server/player"
import { rateLimit } from "../../../../../server/rate-limit"
import { markTakenOver, recordGameResult } from "../../../../../server/results"
import { type Departure, departureOf, leavePatch, settleLeavers } from "../../../../../server/table-rules"

/**
 * `POST /api/<slug>/games/<code>/leave`: the player leaves the table (PLT-120). What it does depends on where the table is:
 *   - in the lobby the player is unseated, and the table has another host if they were it;
 *   - in its ready check the player is unseated and the check is over, since the game was set up for the seats it had (PLT-107);
 *   - in a game in progress the seat stays, marked `left`, and the server plays it from then on (`GAME.autoPlayFor`, as for an absent player), so that the others can finish. The seat counts for no rating, whoever's move it was, and
 *     the player may open another game at once: a table that holds a player who left holds nobody. If the steps the game now waits for are all theirs, it goes on until it waits for somebody who is there, and if that is the end
 *     of the game the game is written down with the others'. Nothing is played when everybody left: the table is abandoned, not played out alone;
 *   - a table that is over holds nobody and has nothing to leave: nothing changes.
 * Leaving twice, or leaving a table one does not sit at, changes nothing and answers with the table as it is.
 * The last player who leaves a table (a lobby, a ready check, or a game in progress that everybody left) leaves a table that holds nobody and that nobody can come back to: it is deleted at once, and not by the nightly clean-up (PLT-21,
 * `deleteEmptyTable`). A game that this leave ended is the exception: it is written down from its row after the response, and the nightly job takes it.
 */
export const POST = handle(async (request: Request, { game, params }: GameRouteContext) => {
  await rateLimit(game.slug, request, "leave")
  const { GAME } = game.binding
  const id = await getPlayerId(game.slug)

  // Set by the run of the modifier that the write came from: a write lost to a concurrent request runs it again
  const outcome = { from: null as Departure | null, left: false, ended: false, played: [] as string[], changed: false }
  const row = await updateGame(game, params.code ?? "", (row) => {
    outcome.from = null
    outcome.left = false
    outcome.ended = false
    outcome.played = []
    outcome.changed = false
    const patch = id ? leavePatch(row, id) : null
    if (!patch) return null
    outcome.changed = true
    outcome.from = departureOf(row.status)
    outcome.left = row.status === "playing"
    if (!outcome.left || !row.state || !patch.players) return patch
    // The seat is the server's from now on: the steps that the game waits for from players who left are played at once
    const settled = settleLeavers(GAME, row.state, patch.players)
    outcome.played = settled.played
    if (!settled.played.length) return patch
    outcome.ended = GAME.isOver(settled.state)
    return { ...patch, state: settled.state, status: outcome.ended ? "over" : "playing", takeover_votes: [] }
  })

  // Only a leave that wrote something can have emptied the table: a request that changed nothing never deletes one
  if (outcome.changed && (await deleteEmptyTable(game, row))) {
    trackAnonymously("table_deleted", { game: game.slug, reason: outcome.from === "playing" ? "game_left" : outcome.from === "starting" ? "ready_check_left" : "lobby_left" })
  }
  if (outcome.from) trackAfter("game_left", id, { game: game.slug, phase: outcome.from })
  if (outcome.left && id) {
    // The seat counts for no rating, and neither do those the server played for after it
    const takenOver = [id, ...outcome.played.filter((player) => player !== id)]
    if (outcome.ended) trackGameFinished(game.slug, row, id)
    after(async () => {
      await markTakenOver(game, row.code, takenOver)
      if (outcome.ended) await recordGameResult(game, row, { takenOver })
    })
  }
  return publicGame(game, row, id)
})
