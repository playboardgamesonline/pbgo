import "server-only"
import { after } from "next/server"
import type { PlayableGame } from "../lib/binding"
import { trackGameFinished } from "./analytics"
import { deadlineDue, deadlinePatch } from "./deadlines"
import { type GameRow, settleReadyCheck, updateGame } from "./games"
import { markTakenOver, recordGameResult } from "./results"

/**
 * A table whose game has a deadline that has passed plays it (`deadlinePatch`): the first request that looks at the table does, since nothing runs on a timer. The write carries the version, so of several requests that look at once one plays it
 * and the others find nothing due; the realtime ping of that write tells the others. A game it ends is written down like any other, and the players the clock played for count for no rating, as the players the others played for do. A table with no
 * game, a game with no clock and a deadline that has not come cost no write.
 */
export async function settleClock(game: PlayableGame, row: GameRow, now = Date.now()): Promise<GameRow> {
  const { GAME } = game.binding
  if (!deadlineDue(GAME, row, now)) return row
  // What the write of the modifier's last run did: it runs again when it loses a race, so it starts from nothing each time
  const outcome = { played: false, playedFor: [] as string[] }
  const next = await updateGame(game, row.code, (current) => {
    outcome.played = false
    outcome.playedFor = []
    const settled = deadlinePatch(GAME, current, now)
    if (!settled) return null
    outcome.played = true
    outcome.playedFor = settled.playedFor
    return settled.patch
  })
  if (!outcome.played) return next
  const playedFor = outcome.playedFor
  if (next.status === "over") trackGameFinished(game.slug, next, next.host_id)
  if (playedFor.length || next.status === "over") {
    after(async () => {
      await markTakenOver(game, next.code, playedFor)
      if (next.status === "over") await recordGameResult(game, next, { takenOver: playedFor })
    })
  }
  return next
}

/** What every request that looks at a table passes it through: the ready check that ran out of time is ended, then the deadline of the game that has passed is played */
export async function settleTable(game: PlayableGame, row: GameRow, now = Date.now()): Promise<GameRow> {
  return settleClock(game, await settleReadyCheck(game, row, now), now)
}
